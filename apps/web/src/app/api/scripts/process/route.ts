import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";
import { processScriptFile } from "@/lib/scripts";

export const dynamic = "force-dynamic";

const processSchema = z.object({ scriptId: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);
    const { scriptId } = await readJsonBody(request, processSchema);
    const script = await processScriptFile(scriptId, user.id);
    return NextResponse.json({ id: script.id, status: script.status, extractedText: script.extractedText });
  } catch (error) {
    return errorResponse(error, "scripts/process");
  }
}