import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    return NextResponse.json({
      user: user ? { id: user.id, email: user.email, name: user.name } : null,
    });
  } catch (error) {
    return errorResponse(error, "auth/session");
  }
}
