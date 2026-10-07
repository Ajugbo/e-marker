import { Plan } from "@exam-marker/database";
import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);
    if (user.plan === Plan.FREE) throw new ApiError("There is no paid subscription to cancel");

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: Plan.FREE,
        subscriptionStatus: "CANCELLED",
        subscriptionEndsAt: null,
      },
      select: { plan: true, subscriptionStatus: true, credits: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error, "payments/cancel");
  }
}
