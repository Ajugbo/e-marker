import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

const examAssistantSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  context: z.object({
    subject: z.string().max(160),
    question: z.string().max(5000),
    markingScheme: z.string().max(20000),
  }).strict(),
}).strict();

const systemPrompt =
  "You are an expert teacher. Suggest concise, pedagogically sound improvements or points to add to exam questions and marking schemes. Stay focused on the provided exam context.";

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);

    const { message, context } = await readJsonBody(request, examAssistantSchema);
    if (!process.env.GROQ_API_KEY) {
      throw new ApiError("GROQ_API_KEY is not configured", 500);
    }

    const prompt = `Based on this Subject: ${context.subject} and Question: ${context.question}, and the user's current Marking Scheme: ${context.markingScheme}, suggest improvements or points to add.\n\nTeacher's request: ${message}`;
    const client = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    });
    const completion = await client.chat.completions.create({
      model: "llama-3.1-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });
    const reply = completion.choices[0]?.message.content?.trim();
    if (!reply) throw new ApiError("The assistant returned an empty response", 502);

    return NextResponse.json({ reply });
  } catch (error) {
    return errorResponse(error, "chat/exam-assistant/post");
  }
}
