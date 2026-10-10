import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { parseExamQuestions, questionsFromRows, validateMarkingSchemes } from "@/lib/exam-questions";
import { aiGradeSchema, gradingInstructions, validateAiGrade } from "@/lib/grading-contract";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";
import { prisma } from "@exam-marker/database";

export const dynamic = "force-dynamic";

const frameSchema = z.object({
  type: z.enum(["metadata", "content"]).optional(),
  pageType: z.enum(["metadata", "content"]).optional(),
  image: z.string().trim().min(1).max(14_000_000),
}).strict().refine((frame) => frame.type || frame.pageType, {
  message: "Each frame must include a metadata or content page type",
});

const processSchema = z.object({
  rubricId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  frames: z.array(frameSchema).min(1).max(20),
}).strict();

const metadataSchema = z.object({
  institution: z.string().nullable(),
  class: z.string().nullable(),
  term: z.string().nullable(),
  studentName: z.string().nullable(),
  examNumber: z.string().nullable(),
  course: z.string().nullable(),
}).strict();

const metadataPrompt =
  "Extract ONLY this JSON from the exam header: {institution, class, term, studentName, examNumber, course}. Return valid JSON. Use null for fields that are absent.";

function visionClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new ApiError("GROQ_API_KEY is not configured", 500);
  }
  return new OpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
  });
}

function imageUrl(value: string) {
  if (value.startsWith("data:image/")) {
    if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) {
      throw new ApiError("Frames must be valid base64-encoded JPEG, PNG, or WebP images");
    }
    return value;
  }
  if (/^[A-Za-z0-9+/]+=*$/.test(value)) {
    return `data:image/jpeg;base64,${value}`;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError("Frames must be base64-encoded images or HTTPS image URLs");
  }
  if (url.protocol !== "https:") {
    throw new ApiError("Frame image URLs must use HTTPS");
  }
  return url.toString();
}

async function requestJson<T extends z.ZodType>(
  client: OpenAI,
  prompt: string,
  frames: { image: string }[],
  schema: T,
  context?: unknown,
  systemPrompt?: string,
): Promise<z.infer<T>> {
  const content = [
    {
      type: "text" as const,
      text: context === undefined
        ? prompt
        : `${prompt}\n\nTeacher-provided questions and marking schemes:\n${JSON.stringify(context)}`,
    },
    ...frames.map((frame) => ({
      type: "image_url" as const,
      image_url: { url: imageUrl(frame.image) },
    })),
  ];
  const completion = await client.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    response_format: { type: "json_object" },
    messages: [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      { role: "user", content },
    ],
    max_tokens: 4096,
  });
  const response = completion.choices[0]?.message.content;
  if (!response) throw new ApiError("The grading service returned an empty response", 502);

  let decoded: unknown;
  try {
    decoded = JSON.parse(response) as unknown;
  } catch {
    throw new ApiError("The grading service returned invalid JSON", 502);
  }
  const parsed = schema.safeParse(decoded);
  if (!parsed.success) {
    throw new ApiError("The grading service returned a response with an invalid JSON shape", 502);
  }
  return parsed.data;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);
    const data = await readJsonBody(request, processSchema);
    if (data.userId && data.userId !== user.id) {
      throw new ApiError("You can only process grading requests for your account", 403);
    }

    const rubricExam = await prisma.exam.findFirst({
      where: { id: data.rubricId, creatorId: user.id },
      select: {
        rubricJson: true,
        questions: { orderBy: [{ parentQuestionId: "asc" }, { sortOrder: "asc" }] },
      },
    });
    if (!rubricExam) throw new ApiError("Rubric not found", 404);

    const questions = rubricExam.questions.length > 0
      ? questionsFromRows(rubricExam.questions)
      : parseExamQuestions(rubricExam.rubricJson);
    validateMarkingSchemes(questions);

    const metadataFrames = data.frames.filter((frame) => (frame.type ?? frame.pageType) === "metadata");
    const contentFrames = data.frames.filter((frame) => (frame.type ?? frame.pageType) === "content");
    if (contentFrames.length === 0) throw new ApiError("At least one content frame is required");

    const client = visionClient();
    const metadata = metadataFrames.length > 0
      ? await requestJson(client, metadataPrompt, metadataFrames, metadataSchema)
      : { institution: null, class: null, term: null, studentName: null, examNumber: null, course: null };
    const gradeResponse = await requestJson(
      client,
      gradingInstructions,
      contentFrames,
      aiGradeSchema,
      questions,
      gradingInstructions,
    );
    const grade = validateAiGrade(gradeResponse, questions);

    return NextResponse.json({
      metadata: Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [key, value ?? ""]),
      ),
      ...grade,
    });
  } catch (error) {
    return errorResponse(error, "grading/process");
  }
}
