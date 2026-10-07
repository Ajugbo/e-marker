import type { PaymentType, Plan } from "@exam-marker/database";

export const CREDIT_BUNDLE = {
  amount: 50_000,
  credits: 20,
} as const;

export const SUBSCRIPTION_PRICES = {
  BASIC: 200_000,
  PRO: 500_000,
} as const satisfies Record<Exclude<Plan, "FREE">, number>;

export function getPaymentType(product: "CREDITS" | "BASIC" | "PRO"): PaymentType {
  return product === "CREDITS" ? "credit_purchase" : "subscription";
}

export function getPlanForSubscriptionAmount(amount: number): Exclude<Plan, "FREE"> | null {
  if (amount === SUBSCRIPTION_PRICES.BASIC) return "BASIC";
  if (amount === SUBSCRIPTION_PRICES.PRO) return "PRO";
  return null;
}

export function addOneMonth(date: Date) {
  const result = new Date(date);
  const dayOfMonth = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + 1);
  const lastDayOfMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(dayOfMonth, lastDayOfMonth));
  return result;
}
