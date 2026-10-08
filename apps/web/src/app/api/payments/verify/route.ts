import { PaymentStatus, prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { getCreditBundleForAmount } from "@/lib/payments";

export const dynamic = "force-dynamic";

const verificationSchema = z.object({
  status: z.boolean(),
  data: z.object({
    reference: z.string(),
    status: z.string(),
    amount: z.number().int().nonnegative(),
    currency: z.string(),
    customer: z.object({ email: z.string().email() }),
  }),
});

function redirectTo(request: NextRequest, destination: string) {
  return NextResponse.redirect(new URL(destination, request.url));
}

export async function GET(request: NextRequest) {
  const referenceResult = z.string().min(1).max(200).safeParse(
    request.nextUrl.searchParams.get("reference"),
  );
  if (!referenceResult.success) {
    return redirectTo(request, "/pricing?payment=failed");
  }

  try {
    const user = await getRequestUser(request);
    if (!user) return redirectTo(request, "/pricing?payment=failed");

    const payment = await prisma.transaction.findUnique({
      where: { reference: referenceResult.data },
    });
    if (!payment || payment.userId !== user.id) {
      console.warn("[payments:verify] Unknown payment reference for signed-in user", {
        reference: referenceResult.data,
      });
      return redirectTo(request, "/pricing?payment=failed");
    }
    if (payment.status === PaymentStatus.success) {
      return redirectTo(request, "/dashboard?payment=success");
    }
    if (payment.status !== PaymentStatus.pending) {
      return redirectTo(request, "/pricing?payment=failed");
    }

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not configured");

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(payment.reference)}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        cache: "no-store",
      },
    );
    const payload: unknown = await response.json();
    const parsed = verificationSchema.safeParse(payload);
    if (!response.ok || !parsed.success || !parsed.data.status) {
      console.warn("[payments:verify] Paystack verification failed", {
        reference: payment.reference,
        status: response.status,
      });
      return redirectTo(request, "/pricing?payment=failed");
    }

    const verified = parsed.data.data;
    if (
      verified.status !== "success"
      || verified.reference !== payment.reference
      || verified.amount !== payment.amount
      || verified.currency !== payment.currency
      || verified.customer.email.trim().toLowerCase() !== user.email.trim().toLowerCase()
    ) {
      console.warn("[payments:verify] Paystack transaction did not match pending payment", {
        reference: payment.reference,
      });
      return redirectTo(request, "/pricing?payment=failed");
    }

    const bundle = payment.type === "credit_purchase"
      ? getCreditBundleForAmount(payment.amount)
      : null;
    if (!bundle) {
      console.error("[payments:verify] Payment product is invalid", {
        reference: payment.reference,
      });
      return redirectTo(request, "/pricing?payment=failed");
    }

    const fulfilled = await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.transaction.updateMany({
        where: { id: payment.id, status: PaymentStatus.pending },
        data: { status: PaymentStatus.success },
      });
      if (claimed.count === 0) return false;

      if (payment.type === "credit_purchase") {
        await transaction.user.update({
          where: { id: payment.userId },
          data: { credits: { increment: bundle.credits } },
        });
        await transaction.creditTransaction.create({
          data: {
            userId: payment.userId,
            amount: bundle.credits,
            type: "purchase",
            description: `Paystack ${bundle.credits}-credit bundle (${payment.reference})`,
          },
        });
      }
      return true;
    });

    if (fulfilled) return redirectTo(request, "/dashboard?payment=success");

    const updatedPayment = await prisma.transaction.findUnique({
      where: { id: payment.id },
      select: { status: true },
    });
    return redirectTo(
      request,
      updatedPayment?.status === PaymentStatus.success
        ? "/dashboard?payment=success"
        : "/pricing?payment=failed",
    );
  } catch (error) {
    console.error("[payments:verify] Failed to verify or fulfill payment", {
      reference: referenceResult.data,
      error,
    });
    return redirectTo(request, "/pricing?payment=failed");
  }
}
