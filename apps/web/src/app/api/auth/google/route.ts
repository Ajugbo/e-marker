import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";
import { verifyGoogleIdToken } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

const signInSchema = z.object({ credential: z.string().min(1, "Google credential is required") });

export async function GET() {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new ApiError("Google Sign-In is not configured", 500);
    return NextResponse.json({ clientId });
  } catch (error) {
    return errorResponse(error, "auth/google/config");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { credential } = await readJsonBody(request, signInSchema);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new ApiError("Google Sign-In is not configured", 500);
    const profile = await verifyGoogleIdToken(credential, clientId);

    const user = await prisma.user.upsert({
      where: { email: profile.email },
      create: {
        email: profile.email,
        name: profile.name || profile.email.split("@")[0],
      },
      update: { name: profile.name || profile.email.split("@")[0] },
    });
    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, credits: user.credits },
    });
    setSessionCookie(response, createSessionToken(user.id));
    return response;
  } catch (error) {
    return errorResponse(error, "auth/google");
  }
}