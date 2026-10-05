import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);
    return NextResponse.json({ credits: user.credits });
  } catch (error) {
    return errorResponse(error, "credits/get");
  }
}