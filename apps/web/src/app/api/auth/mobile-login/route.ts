import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken } from "@/lib/auth";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";
import { verifyGoogleIdToken } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://fuzzy-bassoon-r4vgj9w4vj75c5gj-8081.app.github.dev",
};

const mobileLoginSchema = z.object({
  credential: z.string().min(1, "Google credential is required"),
}).strict();

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const data = await readJsonBody(request, mobileLoginSchema);
    const clientIds = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
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

    return NextResponse.json(
      {
        token: createSessionToken(user.id),
        user: { id: user.id, email: user.email, name: user.name },
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    const response = errorResponse(error, "auth/mobile-login");
    response.headers.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
    return response;
  }
}
