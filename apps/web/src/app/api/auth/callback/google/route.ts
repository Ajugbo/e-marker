import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/http";
import { verifyGoogleIdToken } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

const OAUTH_COOKIE = "exam_marker_oauth";
const OAUTH_COOKIE_PATH = "/api/auth/callback/google";

function clearOAuthCookie(response: NextResponse) {
  response.cookies.set(OAUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: 0,
  });
}

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const oauthCookie = request.cookies.get(OAUTH_COOKIE)?.value;
    const [expectedState, expectedNonce, verifier, extra] = oauthCookie?.split(".") ?? [];

    if (!clientId || !clientSecret) {
      throw new ApiError("Google Sign-In is not configured", 500);
    }
    if (
      request.nextUrl.searchParams.has("error") ||
      !code ||
      !state ||
      !expectedState ||
      !expectedNonce ||
      !verifier ||
      extra ||
      state !== expectedState
    ) {
      throw new ApiError("Google Sign-In could not be completed. Please try again.", 401);
    }

    const redirectUri = new URL(OAUTH_COOKIE_PATH, request.nextUrl.origin).toString();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) {
      throw new ApiError("Google authorization could not be verified. Please try again.", 401);
    }

    const tokenResult = (await tokenResponse.json()) as { id_token?: unknown };
    if (typeof tokenResult.id_token !== "string") {
      throw new ApiError("Google did not return a valid sign-in credential.", 401);
    }
    const profile = await verifyGoogleIdToken(tokenResult.id_token, clientId, expectedNonce);
    const user = await prisma.user.upsert({
      where: { email: profile.email },
      create: {
        email: profile.email,
        name: profile.name || profile.email.split("@")[0],
      },
      update: { name: profile.name || profile.email.split("@")[0] },
    });

    const response = NextResponse.redirect(new URL("/", request.nextUrl.origin));
    setSessionCookie(response, createSessionToken(user.id));
    clearOAuthCookie(response);
    return response;
  } catch (error) {
    const response = errorResponse(error, "auth/callback/google");
    clearOAuthCookie(response);
    return response;
  }
}
