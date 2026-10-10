import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken } from "@/lib/auth";
import { ApiError, readJsonBody } from "@/lib/http";
import { verifyGoogleIdToken } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

const mobileLoginSchema = z.object({
  credential: z.string().min(1, "Google credential is required"),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const data = await readJsonBody(request, mobileLoginSchema);
    const clientIds = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
      "146885349224-ies7rf9mur3114a6chuue7hnq3tu8jto.apps.googleusercontent.com",
    ].filter((clientId): clientId is string => Boolean(clientId));
    if (clientIds.length === 0) {
      throw new ApiError("Google Sign-In is not configured", 500);
    }

    const profile = await verifyGoogleIdToken(data.credential, clientIds);
    const name = profile.name || profile.email.split("@")[0];
    const user = await prisma.user.upsert({
      where: { email: profile.email },
      create: { email: profile.email, name },
      update: { name },
    });

    return NextResponse.json({
      token: createSessionToken(user.id),
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error("Mobile login failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
