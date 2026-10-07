"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type BillingData = {
  plan: "FREE" | "BASIC" | "PRO";
  credits: number;
  subscriptionStatus: "ACTIVE" | "CANCELLED" | "PAST_DUE";
  subscriptionEndsAt: string | null;
  monthlyUsage: number;
  monthlyLimit: number | null;
  transactions: {
    id: string;
    amount: number;
    currency: string;
    status: "pending" | "success" | "failed";
    reference: string;
    type: "credit_purchase" | "subscription";
    createdAt: string;
  }[];
};

const planLabel = { FREE: "Free", BASIC: "Basic", PRO: "Pro" } as const;
const statusLabel = { ACTIVE: "Active", CANCELLED: "Cancelled", PAST_DUE: "Past due" } as const;

function formatNaira(amountInKobo: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amountInKobo / 100);
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadBilling = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/payments/billing", { cache: "no-store", signal });
    const result = (await response.json()) as BillingData & { error?: string };
    if (!response.ok) throw new Error(result.error || "Could not load billing information.");
    setBilling(result);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadBilling(controller.signal).catch((loadError: unknown) => {
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Could not load billing information.");
    });
    return () => controller.abort();
  }, [loadBilling]);

  const cancelSubscription = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/payments/cancel", { method: "POST" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not cancel subscription.");
      setMessage("Your paid plan has been cancelled.");
      await loadBilling();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Could not cancel subscription.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-col gap-3 border-b border-primary/20 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-forest">Account settings</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Billing</h1>
          <p className="mt-2 text-sm text-ink/60">Review your plan, available credits, and payment history.</p>
        </div>
        <Link href="/pricing" className="rounded-md bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-700">Explore plans</Link>
      </header>

      {error && <p role="alert" className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-6 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">{message}</p>}

      {billing ? (
        <>
          <section className="mt-7 grid gap-4 sm:grid-cols-3" aria-label="Current billing summary">
            <article className="rounded-lg border border-primary/15 bg-white p-5">
              <p className="text-sm text-ink/55">Current plan</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{planLabel[billing.plan]}</p>
            </article>
            <article className="rounded-lg border border-primary/15 bg-white p-5">
              <p className="text-sm text-ink/55">Credits remaining</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{billing.credits}</p>
            </article>
            <article className="rounded-lg border border-primary/15 bg-white p-5">
              <p className="text-sm text-ink/55">Subscription status</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{statusLabel[billing.subscriptionStatus]}</p>
              {billing.subscriptionEndsAt && <p className="mt-1 text-xs text-ink/50">Until {new Date(billing.subscriptionEndsAt).toLocaleDateString("en-NG")}</p>}
            </article>
          </section>

          <section className="mt-6 flex flex-col gap-4 rounded-lg border border-primary/15 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-ink">Monthly grading usage</h2>
              <p className="mt-1 text-sm text-ink/60">
                {billing.monthlyLimit === null
                  ? `${billing.monthlyUsage} scripts graded this month · unlimited plan`
                  : `${billing.monthlyUsage} of ${billing.monthlyLimit} scripts used this month`}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/pricing" className="rounded-md border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-blue-50">Buy credits</Link>
              {billing.plan !== "FREE" && (
                <button type="button" onClick={() => void cancelSubscription()} disabled={busy} className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
                  {busy ? "Cancelling…" : "Cancel plan"}
                </button>
              )}
            </div>
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
                        <td className="px-4 py-3">{transaction.type === "subscription" ? "Monthly plan" : "20 script credits"}</td>
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
        <p className="mt-7 rounded-lg border border-primary/15 bg-white p-5 text-sm text-ink/60">Loading billing details…</p>
      ) : null}
    </div>
  );
}
