import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id, type: "credit_purchase" },
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
    });

    return NextResponse.json({ credits: user.credits, transactions });
  } catch (error) {
    return errorResponse(error, "payments/billing");
  }
}
