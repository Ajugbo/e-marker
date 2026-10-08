import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

const metadataSchema = z.object({
  institution: z.string().trim().max(200).nullable().optional(),
  class: z.string().trim().max(100).nullable().optional(),
  term: z.string().trim().max(100).nullable().optional(),
  studentName: z.string().trim().max(160).nullable().optional(),
  examNumber: z.string().trim().max(100).nullable().optional(),
  course: z.string().trim().max(160).nullable().optional(),
}).strict();

const gradeSchema = z.object({
  score: z.number().finite().int().nonnegative(),
  maxScore: z.number().finite().positive(),
  feedback: z.string().max(5000),
  breakdown: z.array(z.object({
    criterion: z.string().trim().min(1).max(200),
    score: z.number().finite().nonnegative(),
    maxScore: z.number().finite().nonnegative(),
    feedback: z.string().max(5000),
  }).strict()).max(100),
}).strict().refine((grade) => grade.score <= grade.maxScore, {
  message: "score cannot exceed maxScore",
  path: ["score"],
});

const confirmSchema = z.object({
  userId: z.string().uuid().optional(),
  rubricId: z.string().uuid(),
  metadata: metadataSchema,
  grade: gradeSchema,
}).strict();

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);
    const data = await readJsonBody(request, confirmSchema);
    if (data.userId && data.userId !== user.id) {
      throw new ApiError("You can only save grading results for your account", 403);
    }

    const exam = await prisma.exam.findFirst({
      where: { id: data.rubricId, creatorId: user.id },
      select: { id: true, title: true },
    });
    if (!exam) throw new ApiError("Rubric not found", 404);

    await prisma.$transaction(async (transaction) => {
      const debit = await transaction.user.updateMany({
        where: { id: user.id, credits: { gte: 1 } },
        data: { credits: { decrement: 1 } },
      });
      if (debit.count === 0) {
        throw new ApiError("You are out of credits. Buy more credits to continue grading.", 402);
      }

      const script = await transaction.script.create({
        data: {
          examId: exam.id,
          studentName: data.metadata.studentName ?? null,
          matricNumber: data.metadata.examNumber?.trim() || "Not provided",
          class: data.metadata.class ?? null,
          institution: data.metadata.institution ?? null,
          term: data.metadata.term ?? null,
          examNumber: data.metadata.examNumber ?? null,
          course: data.metadata.course ?? null,
          totalPages: 0,
          status: "graded",
          reviewStatus: "REVIEWED",
          score: data.grade.score,
          feedback: data.grade.feedback,
        },
      });

      await transaction.grade.create({
        data: {
          scriptId: script.id,
          questionScores: JSON.stringify(data.grade.breakdown),
          totalScore: data.grade.score,
          aiConfidence: 1,
          reviewedBy: user.id,
          isApproved: true,
          feedback: data.grade.feedback,
        },
      });

      await transaction.creditTransaction.create({
        data: {
          userId: user.id,
          amount: -1,
          type: "deduction",
          description: `AI grading for ${data.metadata.studentName?.trim() || "student"} (${exam.title})`,
        },
      });

      await transaction.exam.update({
        where: { id: exam.id },
        data: { totalCreditsDeducted: { increment: 1 } },
      });
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "grading/confirm");
  }
}
