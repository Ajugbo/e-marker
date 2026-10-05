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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);
    const scriptId = z.string().uuid().safeParse(params.id);
    if (!scriptId.success) throw new ApiError("Invalid script ID");
    const data = await readJsonBody(request, reviewSchema);

    const existingGrade = await prisma.grade.findFirst({
      where: { scriptId: scriptId.data, script: { exam: { creatorId: user.id } } },
    });
    if (!existingGrade) throw new ApiError("Graded script not found", 404);

    const grade = await prisma.grade.update({
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
    return NextResponse.json({ grade });
  } catch (error) {
    return errorResponse(error, "scripts/review");
  }
}