import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface GroqModelsResponse {
  data: Array<{ id: string }>;
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Please sign in to continue" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const details = await response.text();
      return NextResponse.json(
        { error: `Groq API Error: ${response.status}`, details },
        { status: response.status },
      );
    }

    const data: unknown = await response.json();
    if (
      typeof data !== "object"
      || data === null
      || !("data" in data)
      || !Array.isArray(data.data)
      || !data.data.every((model) =>
        typeof model === "object"
        && model !== null
        && "id" in model
        && typeof model.id === "string"
      )
    ) {
      console.error("[api:debug-models] Groq returned an invalid models response");
      return NextResponse.json({ error: "Groq returned an invalid models response" }, { status: 502 });
    }

    const modelData = data as GroqModelsResponse;
    return NextResponse.json({
      available_models: modelData.data.map((model) => model.id),
      raw: modelData,
    });
  } catch (error) {
    console.error("[api:debug-models] Failed to fetch Groq models", error);
    return NextResponse.json({ error: "Failed to fetch models from Groq" }, { status: 502 });
  }
}
