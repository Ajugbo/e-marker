import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

const signInSchema = z.object({ credential: z.string().min(1, "Google credential is required") });
const googleProfileSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.string().optional(),
  name: z.string().optional(),
  aud: z.string(),
});

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

    const tokenInfoUrl = new URL("https://oauth2.googleapis.com/tokeninfo");
    tokenInfoUrl.searchParams.set("id_token", credential);
    const googleResponse = await fetch(tokenInfoUrl, { cache: "no-store" });
    if (!googleResponse.ok) throw new ApiError("Google credential is invalid or expired", 401);

    const profile = googleProfileSchema.safeParse(await googleResponse.json());
    if (
      !profile.success ||
      profile.data.aud !== clientId ||
      profile.data.email_verified !== "true"
    ) {
      throw new ApiError("Google account could not be verified", 401);
    }

    const user = await prisma.user.upsert({
      where: { email: profile.data.email },
      create: {
        email: profile.data.email,
        name: profile.data.name || profile.data.email.split("@")[0],
      },
      update: { name: profile.data.name || profile.data.email.split("@")[0] },
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