import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { parseExamQuestions, questionCreateRows, validateMarkingSchemes } from "@/lib/exam-questions";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
const updateExamSchema = z.object({
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);

    const parsedId = idSchema.safeParse(params.id);
    if (!parsedId.success) throw new ApiError("Invalid exam ID");

    const exam = await prisma.exam.findFirst({
      where: { id: parsedId.data, creatorId: user.id },
      select: { id: true, title: true, rubricJson: true },
    });
    if (!exam) throw new ApiError("Exam not found", 404);

    return NextResponse.json({ exam });
  } catch (error) {
    return errorResponse(error, "exams/get");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);

    const parsedId = idSchema.safeParse(params.id);
    if (!parsedId.success) throw new ApiError("Invalid exam ID");
    const data = await readJsonBody(request, updateExamSchema);
    const questions = parseExamQuestions(data.rubricJson);
    validateMarkingSchemes(questions);

    const existingExam = await prisma.exam.findFirst({
      where: { id: parsedId.data, creatorId: user.id },
      select: { id: true },
    });
    if (!existingExam) throw new ApiError("Exam not found", 404);

    const exam = await prisma.$transaction(async (transaction) => {
      await transaction.question.deleteMany({ where: { examId: existingExam.id } });
      const updatedExam = await transaction.exam.update({
        where: { id: existingExam.id },
        data: { title: data.title, rubricJson: data.rubricJson },
        select: { id: true, title: true, rubricJson: true },
      });
      await transaction.question.createMany({
        data: questionCreateRows(questions, updatedExam.id),
      });
      return updatedExam;
    });

    return NextResponse.json({ exam });
  } catch (error) {
    return errorResponse(error, "exams/patch");
  }
}
