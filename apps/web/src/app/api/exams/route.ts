import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@exam-marker/database";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { parseExamQuestions, questionCreateRows, validateMarkingSchemes } from "@/lib/exam-questions";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

const createExamSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  rubricJson: z.string().trim().min(2, "rubricJson is required").refine((value) => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }, "rubricJson must contain valid JSON"),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);
    const exams = await prisma.exam.findMany({
      where: { creatorId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        rubricJson: true,
      },
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
    const questions = parseExamQuestions(data.rubricJson);
    validateMarkingSchemes(questions);

    const exam = await prisma.$transaction(async (transaction) => {
      const createdExam = await transaction.exam.create({
        data: {
          title: data.title,
          rubricJson: data.rubricJson,
          creatorId: user.id,
        },
      });
      await transaction.question.createMany({
        data: questionCreateRows(questions, createdExam.id),
      });
      return createdExam;
    });

    return NextResponse.json(
      { message: "Exam created successfully", examId: exam.id },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error, "exams/post");
  }
}
