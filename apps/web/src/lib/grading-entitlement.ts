import { Plan } from "@exam-marker/database";
import { prisma } from "@exam-marker/database";

export async function getGradingAvailability(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      credits: true,
      plan: true,
      subscriptionStatus: true,
      subscriptionEndsAt: true,
    },
  });
  if (user.credits > 0) return { allowed: true as const };

  const now = new Date();
  const paidPlanIsActive =
    user.plan !== Plan.FREE
    && user.subscriptionStatus === "ACTIVE"
    && user.subscriptionEndsAt !== null
    && user.subscriptionEndsAt > now;
  const plan = paidPlanIsActive ? user.plan : Plan.FREE;
  if (plan === Plan.PRO) return { allowed: true as const };

  const monthlyUsage = await prisma.creditTransaction.count({
    where: {
      userId,
      type: { in: ["deduction", "plan_usage"] },
      amount: { lte: 0 },
      createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
    },
  });
  const monthlyLimit = plan === Plan.BASIC ? 100 : 10;

  return {
    allowed: monthlyUsage < monthlyLimit,
    monthlyUsage,
    monthlyLimit,
  } as const;
}
