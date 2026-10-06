import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

const examIdSchema = z.string().uuid();
const bulkReviewSchema = z.object({
  adjustmentPoints: z.number().int().safe(),
  adjustmentReason: z.string().trim().min(1).max(1000),
  adjustedBy: z.string().trim().min(1).max(200),
  reviewStatus: z.enum(["PENDING", "GRADED", "AWAITING_REVIEW", "REVIEWED"]).optional(),
}).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);

    const parsedId = examIdSchema.safeParse(params.id);
    if (!parsedId.success) throw new ApiError("Invalid exam ID");
    const data = await readJsonBody(request, bulkReviewSchema);
    const exam = await prisma.exam.findFirst({
      where: { id: parsedId.data, creatorId: user.id },
      select: { id: true },
    });
    if (!exam) throw new ApiError("Exam not found", 404);

    const result = await prisma.script.updateMany({
      where: { examId: exam.id },
      data: {
        adjustmentPoints: data.adjustmentPoints,
        adjustmentReason: data.adjustmentReason,
        adjustedBy: data.adjustedBy,
        adjustedAt: new Date(),
        ...(data.reviewStatus !== undefined && { reviewStatus: data.reviewStatus }),
      },
    });
    return NextResponse.json({ success: true, updatedCount: result.count });
  } catch (error) {
    return errorResponse(error, "exams/bulk-review");
  }
}
