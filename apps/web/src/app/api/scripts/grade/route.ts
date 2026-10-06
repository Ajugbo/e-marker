import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, readJsonBody } from "@/lib/http";
import { POST as gradeById } from "../[id]/grade/route";

export const dynamic = "force-dynamic";

const gradeSchema = z.object({ scriptId: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const { scriptId } = await readJsonBody(request, gradeSchema);
    return await gradeById(request, { params: { id: scriptId } });
  } catch (error) {
    return errorResponse(error, "scripts/grade");
  }
}