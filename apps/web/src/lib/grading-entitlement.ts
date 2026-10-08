import { prisma } from "@exam-marker/database";

export async function getGradingAvailability(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { credits: true },
  });

  return { allowed: user.credits > 0 } as const;
}
