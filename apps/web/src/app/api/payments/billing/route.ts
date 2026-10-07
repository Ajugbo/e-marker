import { Plan } from "@exam-marker/database";
import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);

    const now = new Date();
    const subscriptionExpired =
      user.plan !== Plan.FREE
      && user.subscriptionEndsAt !== null
      && user.subscriptionEndsAt <= now;
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [transactions, monthlyUsage] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          reference: true,
          type: true,
          createdAt: true,
        },
      }),
      prisma.creditTransaction.count({
        where: {
          userId: user.id,
          type: { in: ["deduction", "plan_usage"] },
          amount: { lte: 0 },
          createdAt: { gte: currentMonth },
        },
      }),
    ]);
    const plan = subscriptionExpired ? Plan.FREE : user.plan;
    const monthlyLimit = plan === Plan.FREE ? 10 : plan === Plan.BASIC ? 100 : null;

    if (subscriptionExpired) {
      await prisma.user.update({
        where: { id: user.id },
        data: { plan: Plan.FREE, subscriptionStatus: "PAST_DUE" },
      });
    }

    return NextResponse.json({
      plan,
      credits: user.credits,
      subscriptionStatus: subscriptionExpired ? "PAST_DUE" : user.subscriptionStatus,
      subscriptionEndsAt: user.subscriptionEndsAt,
      monthlyUsage,
      monthlyLimit,
      transactions,
    });
  } catch (error) {
    return errorResponse(error, "payments/billing");
  }
}
