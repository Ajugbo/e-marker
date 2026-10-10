import { prisma } from "@exam-marker/database";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { parseExamQuestions, questionsFromRows, validateMarkingSchemes } from "@/lib/exam-questions";
import { getGradingAvailability } from "@/lib/grading-entitlement";
import { gradingInstructions, validateAiGrade } from "@/lib/grading-contract";
import { ApiError, errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

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
      include: {
        exam: {
          include: {
            questions: { orderBy: [{ parentQuestionId: "asc" }, { sortOrder: "asc" }] },
          },
        },
        grade: true,
      },
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
      throw new ApiError("You are out of credits. Buy more credits to continue grading.", 402);
    }
    const reviewStatus =
      script.reviewStatus === "AWAITING_REVIEW"
      || hasUncertainContent(script.extractedText)
        ? "AWAITING_REVIEW"
        : "GRADED";
    if (!process.env.GROQ_API_KEY) {
      throw new ApiError("GROQ_API_KEY is not configured", 500);
    }

    const questions = script.exam.questions.length > 0
      ? questionsFromRows(script.exam.questions)
      : parseExamQuestions(script.exam.rubricJson);
    validateMarkingSchemes(questions);

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
          { role: "system", content: gradingInstructions },
          {
            role: "user",
            content: JSON.stringify({
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
      const result = validateAiGrade(responseBody, questions);

      await prisma.$transaction(async (transaction) => {
        const latestUser = await transaction.user.findUniqueOrThrow({
          where: { id: user.id },
          select: { credits: true },
        });
        const hasCredits = latestUser.credits > 0;
        const balance = await transaction.user.updateMany({
          where: { id: user.id, credits: { gte: 1 } },
          data: { credits: { decrement: 1 } },
        });
        if (balance.count === 0) {
          throw new ApiError("You are out of credits. Buy more credits to continue grading.", 402);
        }

        await transaction.creditTransaction.create({
          data: {
            userId: user.id,
            amount: -1,
            type: "deduction",
            description: `AI grading for ${script.studentName}`,
          },
        });
        await transaction.grade.create({
          data: {
            scriptId: script.id,
            questionScores: JSON.stringify(result.breakdown),
            totalScore: result.score,
            aiConfidence: 0.5,
            feedback: result.feedback,
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
            score: result.score,
            feedback: result.feedback,
          },
        });
      }, { isolationLevel: "Serializable" });

      return NextResponse.json(result);
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
