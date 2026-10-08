import { randomUUID } from "node:crypto";
import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { getCreditBundle } from "@/lib/payments";
import { ApiError, errorResponse, readJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

const initializeSchema = z.object({
  product: z.enum(["STANDARD", "PREMIUM", "TOPUP"]),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);
    const { product } = await readJsonBody(request, initializeSchema);
    const bundle = getCreditBundle(product);
    const reference = `em_${randomUUID()}`;

    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: bundle.amount,
        currency: "NGN",
        status: "pending",
        reference,
        type: "credit_purchase",
      },
    });

    return NextResponse.json({
      reference,
      amount: bundle.amount,
      currency: "NGN",
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    return errorResponse(error, "payments/initialize");
  }
}
