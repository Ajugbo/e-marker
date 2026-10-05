import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

const purchaseSchema = z.object({}).strict();

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);
    await readJsonBody(request, purchaseSchema);

    const updatedUser = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { id: user.id },
        data: { credits: { increment: 50 } },
      });
      await transaction.creditTransaction.create({
        data: {
          userId: user.id,
          amount: 50,
          type: "purchase",
          description: "Demo credit purchase",
        },
      });
      return updated;
    });
    return NextResponse.json({ credits: updatedUser.credits, added: 50 });
  } catch (error) {
    return errorResponse(error, "credits/purchase");
  }
}