import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

export async function GET(
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
      include: { grade: true, exam: { select: { id: true, title: true } } },
    });
    if (!script) throw new ApiError("Script not found", 404);
    return NextResponse.json({ script });
  } catch (error) {
    return errorResponse(error, "scripts/get");
  }
}