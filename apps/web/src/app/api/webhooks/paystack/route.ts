import crypto, { timingSafeEqual } from "node:crypto";
import { PaymentStatus, prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addOneMonth, CREDIT_BUNDLE, getPlanForSubscriptionAmount } from "@/lib/payments";

export const dynamic = "force-dynamic";

const webhookSchema = z.object({
  event: z.string().min(1),
  data: z.object({
    reference: z.string().min(1),
    amount: z.number().int().nonnegative(),
    currency: z.string().min(1),
    status: z.string().min(1),
  }).passthrough(),
}).passthrough();

function hasValidSignature(body: string, signature: string | null, secret: string) {
  if (!signature || !/^[a-f\d]{128}$/i.test(signature)) return false;
  const expectedHash = crypto.createHmac("sha512", secret).update(body).digest("hex");
  const expected = Buffer.from(expectedHash, "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const signature = request.headers.get("x-paystack-signature");

  if (!secret) {
    console.error("[webhook:paystack] PAYSTACK_SECRET_KEY is not configured");
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 500 });
  }
  if (!hasValidSignature(rawBody, signature, secret)) {
    console.warn("[webhook:paystack] Rejected webhook with invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody) as unknown;
  } catch {
    console.warn("[webhook:paystack] Rejected signed webhook with invalid JSON");
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsedEvent = webhookSchema.safeParse(parsedBody);
  if (!parsedEvent.success) {
    console.warn("[webhook:paystack] Rejected signed webhook with invalid payload", parsedEvent.error.issues);
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const { event, data } = parsedEvent.data;
  console.info("[webhook:paystack] Event received", {
    event,
    reference: data.reference,
    status: data.status,
    receivedAt: new Date().toISOString(),
  });

  if (event !== "charge.success" && event !== "charge.failed") {
    return NextResponse.json({ received: true });
  }

  try {
    const payment = await prisma.transaction.findUnique({
      where: { reference: data.reference },
    });
    if (!payment) {
      return NextResponse.json({ error: "Unknown payment reference" }, { status: 400 });
    }
    if (data.amount !== payment.amount || data.currency !== payment.currency) {
      return NextResponse.json({ error: "Payment amount or currency does not match" }, { status: 400 });
    }

    if (event === "charge.failed") {
      if (data.status !== "failed") {
        return NextResponse.json({ error: "Failed charge status is invalid" }, { status: 400 });
      }
      if (payment.status === PaymentStatus.pending) {
        await prisma.transaction.updateMany({
          where: { id: payment.id, status: PaymentStatus.pending },
          data: { status: PaymentStatus.failed },
        });
      }
      return NextResponse.json({ received: true });
    }
    if (data.status !== "success") {
      return NextResponse.json({ error: "Successful charge status is invalid" }, { status: 400 });
    }
    if (payment.status === PaymentStatus.success) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (payment.status !== PaymentStatus.pending) {
      return NextResponse.json({ error: "Payment is not pending" }, { status: 400 });
    }

    const plan = payment.type === "subscription"
      ? getPlanForSubscriptionAmount(payment.amount)
      : null;
    if (
      (payment.type === "credit_purchase" && payment.amount !== CREDIT_BUNDLE.amount)
      || (payment.type === "subscription" && plan === null)
    ) {
      return NextResponse.json({ error: "Payment product is invalid" }, { status: 400 });
    }

    await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.transaction.updateMany({
        where: { id: payment.id, status: PaymentStatus.pending },
        data: { status: PaymentStatus.success },
      });
      if (claimed.count === 0) return;

      if (payment.type === "credit_purchase") {
        await transaction.user.update({
          where: { id: payment.userId },
          data: { credits: { increment: 20 } },
        });
        await transaction.creditTransaction.create({
          data: {
            userId: payment.userId,
            amount: 20,
            type: "purchase",
            description: `Paystack credit bundle (${payment.reference})`,
          },
        });
        return;
      }

      const user = await transaction.user.findUniqueOrThrow({
        where: { id: payment.userId },
        select: { plan: true, subscriptionEndsAt: true },
      });
      const now = new Date();
      const startsAt = user.subscriptionEndsAt && user.subscriptionEndsAt > now
        ? user.subscriptionEndsAt
        : now;
      const subscriptionEndsAt = addOneMonth(startsAt);
      const subscriptionPlan = getPlanForSubscriptionAmount(payment.amount);
      if (!subscriptionPlan) throw new Error("Subscription payment amount is invalid");
      await transaction.user.update({
        where: { id: payment.userId },
        data: {
          plan: subscriptionPlan,
          subscriptionStatus: "ACTIVE",
          subscriptionEndsAt,
        },
      });
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhook:paystack] Failed to process signed event", {
      reference: data.reference,
      event,
      error,
    });
    return NextResponse.json({ error: "Failed to process payment event" }, { status: 500 });
  }
}
