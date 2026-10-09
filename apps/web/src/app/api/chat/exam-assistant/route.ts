import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

const examAssistantSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  context: z.object({
    subject: z.string().max(160).optional(),
    question: z.string().max(5000).optional(),
    markingScheme: z.string().max(20000).optional(),
  }).optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);

    const { message } = await readJsonBody(request, examAssistantSchema);
    if (!process.env.GROQ_API_KEY) {
      throw new ApiError("GROQ_API_KEY is not configured", 500);
    }

    const client = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    });
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: "You are an expert teacher assistant. Help refine exam questions and marking schemes.",
        },
        { role: "user", content: message },
      ],
    });
    const reply = completion.choices[0]?.message?.content?.trim() || "No response from AI.";

    return NextResponse.json({ reply });
  } catch (error) {
    return errorResponse(error, "chat/exam-assistant/post");
  }
}
