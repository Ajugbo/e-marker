import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";
import { createMockGrade } from "@/lib/grading";

export const dynamic = "force-dynamic";

const gradeSchema = z.object({ scriptId: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);
    const { scriptId } = await readJsonBody(request, gradeSchema);
    const grade = await createMockGrade(scriptId, user.id);
    return NextResponse.json({ grade });
  } catch (error) {
    return errorResponse(error, "scripts/grade");
  }
}