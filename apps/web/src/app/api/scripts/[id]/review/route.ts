import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  totalScore: z.number().finite().min(0),
  questionScores: z.union([
    z.string().min(2),
    z.record(z.string(), z.unknown()),
    z.array(z.unknown()),
  ]),
  feedback: z.string().trim().max(5000).optional(),
});

const reviewStatusSchema = z.enum([
  "PENDING",
  "GRADED",
  "AWAITING_REVIEW",
  "REVIEWED",
]);
const adjustmentSchema = z.object({
  reviewStatus: reviewStatusSchema.optional(),
  adjustmentPoints: z.number().int().safe().optional(),
  adjustmentReason: z.string().trim().max(1000).nullable().optional(),
  adjustedBy: z.string().trim().min(1).max(200).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, {
  message: "At least one review adjustment field is required",
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);
    const scriptId = z.string().uuid().safeParse(params.id);
    if (!scriptId.success) throw new ApiError("Invalid script ID");
    const data = await readJsonBody(request, z.union([reviewSchema, adjustmentSchema]));

    if ("totalScore" in data) {
      const existingGrade = await prisma.grade.findFirst({
        where: { scriptId: scriptId.data, script: { exam: { creatorId: user.id } } },
      });
      if (!existingGrade) throw new ApiError("Graded script not found", 404);

      const grade = await prisma.$transaction(async (transaction) => {
        const updatedGrade = await transaction.grade.update({
          where: { id: existingGrade.id },
          data: {
            totalScore: data.totalScore,
            questionScores: typeof data.questionScores === "string"
              ? data.questionScores
              : JSON.stringify(data.questionScores),
            feedback: data.feedback ?? null,
            reviewedBy: user.id,
            isApproved: true,
          },
        });
        await transaction.script.update({
          where: { id: scriptId.data },
          data: {
            score: data.totalScore,
            feedback: data.feedback ?? null,
            reviewStatus: "REVIEWED",
          },
        });
        return updatedGrade;
      });
      return NextResponse.json({ grade });
    }

    const existingScript = await prisma.script.findFirst({
      where: { id: scriptId.data, exam: { creatorId: user.id } },
      select: { id: true },
    });
    if (!existingScript) throw new ApiError("Script not found", 404);

    const updatedScript = await prisma.script.update({
      where: { id: existingScript.id },
      data: {
        ...(data.reviewStatus !== undefined && { reviewStatus: data.reviewStatus }),
        ...(data.adjustmentPoints !== undefined && { adjustmentPoints: data.adjustmentPoints }),
        ...(data.adjustmentReason !== undefined && { adjustmentReason: data.adjustmentReason }),
        ...(data.adjustedBy !== undefined && { adjustedBy: data.adjustedBy }),
        adjustedAt: new Date(),
      },
    });
    return NextResponse.json(updatedScript);
  } catch (error) {
    return errorResponse(error, "scripts/review");
  }
}