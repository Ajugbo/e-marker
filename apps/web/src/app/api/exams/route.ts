import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

const rubricSchema = z
  .union([z.string().min(2), z.record(z.string(), z.unknown()), z.array(z.unknown())])
  .refine((rubric) => {
    if (typeof rubric !== "string") return true;
    try {
      JSON.parse(rubric);
      return true;
    } catch {
      return false;
    }
  }, "Rubric must be valid JSON");

const createExamSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  rubric: rubricSchema,
});

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);
    const exams = await prisma.exam.findMany({
      where: { creatorId: user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { scripts: true } } },
    });
    return NextResponse.json({ exams });
  } catch (error) {
    return errorResponse(error, "exams/get");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);
    const data = await readJsonBody(request, createExamSchema);
    const exam = await prisma.exam.create({
      data: {
        title: data.title,
        description: data.description || null,
        rubricJson: typeof data.rubric === "string" ? data.rubric : JSON.stringify(data.rubric),
        creator: { connect: { id: user.id } },
      },
    });
    return NextResponse.json({ exam }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "exams/post");
  }
}