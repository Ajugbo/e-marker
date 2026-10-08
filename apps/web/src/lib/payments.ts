export const CREDIT_BUNDLES = {
  STANDARD: { amount: 250_000, credits: 150 },
  PREMIUM: { amount: 500_000, credits: 350 },
  TOPUP: { amount: 50_000, credits: 20 },
} as const;

export type CreditProduct = keyof typeof CREDIT_BUNDLES;

export function getCreditBundle(product: CreditProduct) {
  return CREDIT_BUNDLES[product];
}

export function getCreditBundleForAmount(amount: number) {
  return Object.values(CREDIT_BUNDLES).find((bundle) => bundle.amount === amount) ?? null;
}
