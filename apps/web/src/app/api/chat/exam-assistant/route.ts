import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

const examAssistantSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(5000),
  }).strict()).min(1).max(40),
  examContext: z.object({
    title: z.string().trim().min(1).max(160),
    subject: z.string().trim().min(1).max(160),
    classLevel: z.string().trim().min(1).max(200),
    rubric: z.string().max(20000).optional(),
    currentQuestionText: z.string().max(5000).optional(),
  }).strict(),
}).strict();

const systemPrompt =
  "You are an Exam Refinement Assistant. Your ONLY role is to help teachers structure exam questions, write precise rubrics, and create granular marking schemes. Reference the provided `examContext`. Reject any off-topic requests (general chat, non-academic topics, personal advice). Keep responses concise, pedagogically sound, and formatted for easy copy-pasting into the exam editor.";

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);

    const { messages, examContext } = await readJsonBody(request, examAssistantSchema);
    if (!process.env.GROQ_API_KEY) {
      throw new ApiError("GROQ_API_KEY is not configured", 500);
    }

    const client = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    });
    const completion = await client.chat.completions.create({
      model: "llama-3.1-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Exam context: ${JSON.stringify(examContext)}` },
        ...messages,
      ],
    });
    const reply = completion.choices[0]?.message.content?.trim();
    if (!reply) throw new ApiError("The assistant returned an empty response", 502);

    return NextResponse.json({ reply });
  } catch (error) {
    return errorResponse(error, "chat/exam-assistant/post");
  }
}
