import { prisma } from "@exam-marker/database";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { getGradingAvailability } from "@/lib/grading-entitlement";
import { ApiError, errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
const gradingResultSchema = z.object({
  score: z.number().int().nonnegative(),
  feedback: z.string().trim().min(1).max(5000),
}).strict();

const systemPrompt =
  "You are an examiner. Grade this answer against the rubric. Return JSON ONLY: { score: number, feedback: string }";

function hasUncertainContent(content: string | null) {
  return Boolean(
    content?.includes("No readable text was detected")
    || content?.includes("OCR for video and PDF files is mocked"),
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);

    const parsedId = idSchema.safeParse(params.id);
    if (!parsedId.success) throw new ApiError("Invalid script ID");

    const script = await prisma.script.findFirst({
      where: { id: parsedId.data, exam: { creatorId: user.id } },
      include: { exam: true, grade: true },
    });
    if (!script) throw new ApiError("Script not found", 404);
    if (script.grade || script.status === "graded") {
      if (script.reviewStatus === "PENDING") {
        await prisma.script.update({
          where: { id: script.id },
          data: {
            reviewStatus: hasUncertainContent(script.extractedText)
              ? "AWAITING_REVIEW"
              : "GRADED",
          },
        });
      }
      return NextResponse.json({
        score: script.score ?? script.grade?.totalScore ?? null,
        feedback: script.feedback ?? script.grade?.feedback ?? null,
      });
    }
    if (!script.extractedText) {
      throw new ApiError("Process the script before grading", 400);
    }
    const availability = await getGradingAvailability(user.id);
    if (!availability.allowed) {
      throw new ApiError(
        `Your ${availability.monthlyLimit}-script monthly allowance is used. Upgrade or buy credits to continue.`,
        402,
      );
    }
    const reviewStatus =
      script.reviewStatus === "AWAITING_REVIEW"
      || hasUncertainContent(script.extractedText)
        ? "AWAITING_REVIEW"
        : "GRADED";
    if (!process.env.GROQ_API_KEY) {
      throw new ApiError("GROQ_API_KEY is not configured", 500);
    }

    let rubric: unknown;
    try {
      rubric = JSON.parse(script.exam.rubricJson) as unknown;
    } catch {
      throw new ApiError("The exam rubric is not valid JSON", 400);
    }
    const questions = typeof rubric === "object" && rubric !== null && "questions" in rubric
      ? rubric.questions
      : [];

    const lock = await prisma.script.updateMany({
      where: {
        id: script.id,
        status: { in: ["pending", "processed", "failed"] },
      },
      data: { status: "grading" },
    });
    if (lock.count === 0) {
      throw new ApiError("This script is already being graded", 409);
    }

    try {
      const client = new OpenAI({
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: process.env.GROQ_API_KEY,
      });
      const completion = await client.chat.completions.create({
        model: "llama-3.1-70b-versatile",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              rubric,
              questions,
              answer: script.extractedText,
            }),
          },
        ],
      });
      const content = completion.choices[0]?.message.content;
      if (!content) throw new ApiError("The grading service returned an empty response", 502);

      let responseBody: unknown;
      try {
        responseBody = JSON.parse(content) as unknown;
      } catch {
        throw new ApiError("The grading service returned invalid JSON", 502);
      }
      const result = gradingResultSchema.safeParse(responseBody);
      if (!result.success) {
        throw new ApiError("The grading service returned an invalid score or feedback", 502);
      }

      await prisma.$transaction(async (transaction) => {
        const latestUser = await transaction.user.findUniqueOrThrow({
          where: { id: user.id },
          select: {
            credits: true,
            plan: true,
            subscriptionStatus: true,
            subscriptionEndsAt: true,
          },
        });
        const currentTime = new Date();
        const paidPlanIsActive =
          latestUser.plan !== "FREE"
          && latestUser.subscriptionStatus === "ACTIVE"
          && latestUser.subscriptionEndsAt !== null
          && latestUser.subscriptionEndsAt > currentTime;
        const effectivePlan = paidPlanIsActive ? latestUser.plan : "FREE";
        const hasCredits = latestUser.credits > 0;
        if (!hasCredits && effectivePlan !== "PRO") {
          const monthlyUsage = await transaction.creditTransaction.count({
            where: {
              userId: user.id,
              type: { in: ["deduction", "plan_usage"] },
              amount: { lte: 0 },
              createdAt: { gte: new Date(currentTime.getFullYear(), currentTime.getMonth(), 1) },
            },
          });
          const monthlyLimit = effectivePlan === "BASIC" ? 100 : 10;
          if (monthlyUsage >= monthlyLimit) {
            throw new ApiError(
              `Your ${monthlyLimit}-script monthly allowance is used. Upgrade or buy credits to continue.`,
              402,
            );
          }
        }

        if (hasCredits) {
          const balance = await transaction.user.updateMany({
            where: { id: user.id, credits: { gte: 1 } },
            data: { credits: { decrement: 1 } },
          });
          if (balance.count === 0) {
            throw new ApiError("Insufficient credits to grade this script", 402);
          }
        }

        await transaction.creditTransaction.create({
          data: {
            userId: user.id,
            amount: hasCredits ? -1 : 0,
            type: hasCredits ? "deduction" : "plan_usage",
            description: `AI grading for ${script.studentName}`,
          },
        });
        await transaction.grade.create({
          data: {
            scriptId: script.id,
            questionScores: JSON.stringify([
              { question: "Overall response", score: result.data.score },
            ]),
            totalScore: result.data.score,
            aiConfidence: 0.5,
            feedback: result.data.feedback,
          },
        });
        await transaction.exam.update({
          where: { id: script.examId },
          data: { totalCreditsDeducted: { increment: 1 } },
        });
        await transaction.script.update({
          where: { id: script.id },
          data: {
            status: "graded",
            reviewStatus,
            score: result.data.score,
            feedback: result.data.feedback,
          },
        });
      }, { isolationLevel: "Serializable" });

      return NextResponse.json(result.data);
    } catch (error) {
      await prisma.script.updateMany({
        where: { id: script.id, status: "grading" },
        data: { status: "processed" },
      });
      throw error;
    }
  } catch (error) {
    return errorResponse(error, "scripts/auto-grade");
  }
}
