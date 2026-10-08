"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type BillingData = {
  credits: number;
  transactions: {
    id: string;
    amount: number;
    currency: string;
    status: "pending" | "success" | "failed";
    reference: string;
    createdAt: string;
  }[];
};

function formatNaira(amountInKobo: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amountInKobo / 100);
}

function bundleName(amountInKobo: number) {
  if (amountInKobo === 250_000) return "Standard Bundle · 150 credits";
  if (amountInKobo === 500_000) return "Premium Bundle · 350 credits";
  if (amountInKobo === 50_000) return "Top-up · 20 credits";
  return "Credit purchase";
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [error, setError] = useState("");

  const loadBilling = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/payments/billing", { cache: "no-store", signal });
    const result = (await response.json()) as BillingData & { error?: string };
    if (!response.ok) throw new Error(result.error || "Could not load payment information.");
    setBilling(result);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadBilling(controller.signal).catch((loadError: unknown) => {
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Could not load payment information.");
    });
    return () => controller.abort();
  }, [loadBilling]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-col gap-3 border-b border-primary/20 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-forest">Account settings</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Credits and payments</h1>
          <p className="mt-2 text-sm text-ink/60">Review your available grading credits and payment history.</p>
        </div>
        <Link href="/pricing" className="rounded-md bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-700">Buy Credits</Link>
      </header>

      {error && <p role="alert" className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}

      {billing ? (
        <>
          <section className="mt-7 rounded-lg border border-primary/15 bg-white p-5" aria-label="Credit balance">
            <p className="text-sm text-ink/55">Credits remaining</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{billing.credits}</p>
          </section>

          <section className="mt-9">
            <h2 className="text-lg font-semibold text-ink">Payment history</h2>
            {billing.transactions.length === 0 ? (
              <p className="mt-3 rounded-lg border border-primary/15 bg-white p-5 text-sm text-ink/55">No payments yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-primary/15 bg-white">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-blue-100/60 text-xs uppercase tracking-wide text-ink/55">
                    <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Reference</th></tr>
                  </thead>
                  <tbody>
                    {billing.transactions.map((transaction) => (
                      <tr key={transaction.id} className="border-t border-primary/10">
                        <td className="whitespace-nowrap px-4 py-3">{new Date(transaction.createdAt).toLocaleDateString("en-NG")}</td>
                        <td className="px-4 py-3">{bundleName(transaction.amount)}</td>
                        <td className="whitespace-nowrap px-4 py-3">{formatNaira(transaction.amount)}</td>
                        <td className="px-4 py-3 capitalize">{transaction.status}</td>
                        <td className="max-w-44 truncate px-4 py-3 font-mono text-xs text-ink/50">{transaction.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : !error ? (
        <p className="mt-7 rounded-lg border border-primary/15 bg-white p-5 text-sm text-ink/60">Loading payment details…</p>
      ) : null}
    </div>
  );
}
