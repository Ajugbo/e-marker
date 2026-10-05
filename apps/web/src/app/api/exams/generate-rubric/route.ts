import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

const generateRubricSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(160),
  subject: z.string().trim().min(1, "subject is required").max(160),
  topic: z.string().trim().min(1, "topic is required").max(200),
  sampleQuestions: z.string().trim().min(1, "sampleQuestions is required").max(10000),
});

export async function POST(request: Request) {
  try {
    const { title, subject, topic, sampleQuestions } = await readJsonBody(
      request,
      generateRubricSchema,
    );
    const questions = sampleQuestions
      .split(/\r?\n/)
      .map((question) => question.trim())
      .filter(Boolean);
    const pointsPerQuestion = Math.floor(100 / questions.length);
    const remainder = 100 % questions.length;

    const rubric = {
      title,
      subject,
      topic,
      totalPoints: 100,
      questions: questions.map((question, index) => ({
        id: index + 1,
        question,
        points: pointsPerQuestion + (index < remainder ? 1 : 0),
        criteria: ["Accuracy", "Reasoning", "Clarity"],
      })),
    };

    return NextResponse.json({ rubric });
  } catch (error) {
    return errorResponse(error, "exams/generate-rubric/post");
  }
}
