import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

const generateRubricSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(160),
  subject: z.string().trim().min(1, "subject is required").max(160),
  classLevel: z.string().trim().min(1, "classLevel is required").max(200),
  topic: z.string().trim().max(200).optional(),
  sampleQuestions: z.string().trim().min(1, "sampleQuestions is required").max(10000),
});

export async function POST(request: Request) {
  try {
    const { title, subject, classLevel, topic, sampleQuestions } = await readJsonBody(
      request,
      generateRubricSchema,
    );
    const questions = sampleQuestions
      .split(/\r?\n/)
      .map((question) => question.trim())
      .filter(Boolean);
    const totalPoints = Math.max(100, questions.length);
    const pointsPerQuestion = Math.floor(totalPoints / questions.length);
    const remainder = totalPoints % questions.length;

    const rubric = {
      title,
      subject,
      classLevel,
      ...(topic ? { topic } : {}),
      totalPoints,
      questions: questions.map((question, index) => ({
        questionNumber: String(index + 1),
        questionText: question,
        markingScheme: "",
        marks: pointsPerQuestion + (index < remainder ? 1 : 0),
      })),
    };

    return NextResponse.json({ rubric });
  } catch (error) {
    return errorResponse(error, "exams/generate-rubric/post");
  }
}
