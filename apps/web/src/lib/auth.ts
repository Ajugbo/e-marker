import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@exam-marker/database";
import type { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "exam_marker_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

type SessionClaims = {
  sub: string;
  exp: number;
};

function sessionSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not configured");
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readSessionToken(token: string): SessionClaims | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  try {
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionClaims;
    if (typeof claims.sub !== "string" || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export async function getRequestUser(request: NextRequest) {
  return getSessionUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export async function getSessionUser(token: string | undefined) {
  if (!token) return null;
  const claims = readSessionToken(token);
  if (!claims) return null;
  return prisma.user.findUnique({ where: { id: claims.sub } });
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}