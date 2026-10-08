"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

const metrics = [
  { label: "Active exams", value: "08", note: "Across 4 classes", color: "bg-mint" },
  { label: "Scripts received", value: "246", note: "This term", color: "bg-[#f9e5d9]" },
  { label: "Awaiting review", value: "19", note: "AI-graded scripts", color: "bg-[#e8e9d5]" },
];

const activity = [
  { title: "Algebra II · Midterm", detail: "Class 10B · 32 scripts", status: "Grading", time: "12 min ago", progress: "72%" },
  { title: "Biology · Cell structure", detail: "Class 9A · 28 scripts", status: "Review needed", time: "Yesterday", progress: "100%" },
  { title: "English · Persuasive writing", detail: "Class 11C · 24 scripts", status: "Ready", time: "Yesterday", progress: "100%" },
];

export default function DashboardPage() {
  const [greeting, setGreeting] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const [billingSummary, setBillingSummary] = useState<{
    plan: "FREE" | "BASIC" | "PRO";
    credits: number;
    subscriptionStatus: string;
    monthlyLimit: number | null;
  } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    const now = new Date();
    setGreeting(getGreeting(now.getHours()));
    setCurrentDate(now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }));
    setPaymentSuccess(new URLSearchParams(window.location.search).get("payment") === "success");
    const controller = new AbortController();
    void fetch("/api/payments/billing", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as {
          plan: "FREE" | "BASIC" | "PRO";
          credits: number;
          subscriptionStatus: string;
          monthlyLimit: number | null;
        };
        setBillingSummary(data);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("[dashboard:billing] Could not load account summary", error);
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col justify-between gap-5 border-b border-primary/20 pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-forest" suppressHydrationWarning>
            {currentDate ?? "\u00a0"}
          </p>
          <h1 className="mt-2 min-h-9 text-3xl font-semibold text-ink" aria-live="polite">
            {greeting ?? "\u00a0"}
          </h1>
          <p className="mt-2 text-sm text-ink/60">Here is the grading activity across your workspace.</p>
        </div>
        <Link href="/exams/new" className="w-fit rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 inline-block">
          Create an exam <span aria-hidden="true" className="ml-2">+</span>
        </Link>
      </header>

      {paymentSuccess && (
        <p role="status" className="mt-6 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Payment received. Your plan or credits will appear once Paystack confirms the transaction.
        </p>
      )}

      {billingSummary && (
        <section aria-label="Subscription plan" className="mt-6 flex flex-col gap-3 rounded-lg border border-primary/20 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-forest">Your subscription benefit</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">
              {billingSummary.plan === "PRO"
                ? "Pro Plan: Unlimited scripts"
                : `${billingSummary.plan === "BASIC" ? "Basic" : "Free"} Plan: ${billingSummary.monthlyLimit ?? (billingSummary.plan === "BASIC" ? 100 : 10)} scripts/month`}
            </h2>
          </div>
          <p className="text-sm text-ink/60">
            Subscription status: {billingSummary.subscriptionStatus.replace("_", " ").toLowerCase()}
          </p>
        </section>
      )}

      <section aria-label="Workspace metrics" className="mt-6 grid gap-px overflow-hidden rounded-lg border border-primary/15 bg-primary/15 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <article key={metric.label} className="bg-blue-50/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink/65">{metric.label}</p>
              <span className={`h-2.5 w-2.5 rounded-full ${metric.color}`} />
            </div>
            <p className="mt-5 text-3xl font-semibold tabular-nums text-ink">
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-ink/45">{metric.note}</p>
          </article>
        ))}
      </section>

      <section aria-label="Pay-as-you-go credits" className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-primary/10 bg-white/70 px-5 py-4">
        <div>
          <h2 className="text-sm font-medium text-ink/70">Pay-as-you-go Credits</h2>
          <p className="mt-1 text-xs text-ink/45">Purchased separately from your subscription plan.</p>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-ink/75">{billingSummary?.credits ?? "—"}</p>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Recent exams</h2>
            <p className="mt-1 text-sm text-ink/55">Track submissions and review status.</p>
          </div>
          <a href="/api/exams" className="text-sm font-semibold text-forest hover:underline">View API</a>
        </div>
        <div className="overflow-x-auto rounded-lg border border-primary/15 bg-blue-50/50 shadow-sm">
          <div className="grid min-w-[680px] grid-cols-[minmax(220px,1.5fr)_1fr_140px_110px] border-b border-primary/10 bg-blue-100/40 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-ink/55">
            <span>Exam</span><span>Progress</span><span>Status</span><span>Updated</span>
          </div>
          {activity.map((item) => (
            <article key={item.title} className="grid min-w-[680px] grid-cols-[minmax(220px,1.5fr)_1fr_140px_110px] items-center border-b border-primary/10 bg-white/60 px-5 py-4 last:border-0">
              <div>
                <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-1 text-xs text-ink/50">{item.detail}</p>
              </div>
              <div className="flex items-center gap-3 pr-6">
                <div className="h-1.5 flex-1 rounded-full bg-blue-100"><div className="h-1.5 rounded-full bg-primary" style={{ width: item.progress }} /></div>
                <span className="w-9 text-right text-xs tabular-nums text-ink/55">{item.progress}</span>
              </div>
              <span className="text-xs font-medium text-blue-800">{item.status}</span>
              <span className="text-xs text-ink/45">{item.time}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}