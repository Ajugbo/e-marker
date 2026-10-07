"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

type Product = "BASIC" | "PRO" | "CREDITS";
const CheckoutButton = dynamic(() => import("./checkout-button"), { ssr: false });

const plans: {
  id: Product;
  name: string;
  price: string;
  interval: string;
  description: string;
  features: string[];
  action: string;
  featured?: boolean;
}[] = [
  {
    id: "BASIC",
    name: "Basic",
    price: "₦2,000",
    interval: "/ month",
    description: "More room for busy classrooms.",
    features: ["100 scripts each month", "Full AI grading", "Bulk adjustment tools"],
    action: "Choose Basic",
  },
  {
    id: "PRO",
    name: "Pro",
    price: "₦5,000",
    interval: "/ month",
    description: "For departments and high-volume marking.",
    features: ["Unlimited scripts", "Priority grading", "Class and grading analytics"],
    action: "Choose Pro",
    featured: true,
  },
];

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-3 border-b border-primary/20 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-forest">Made for Nigerian classrooms</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Clear pricing, more time to teach.</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink/60">
            Choose a monthly plan or add script credits as you need them. Payments are processed securely by Paystack.
          </p>
        </div>
        <Link href="/settings/billing" className="text-sm font-semibold text-primary hover:underline">View billing</Link>
      </header>

      <section aria-label="Subscription plans" className="mt-8 grid gap-5 lg:grid-cols-3">
        <article className="flex flex-col rounded-xl border border-primary/15 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-ink/45">Start grading</p>
          <h2 className="mt-3 text-xl font-semibold text-ink">Free</h2>
          <p className="mt-2 text-3xl font-semibold text-ink">₦0 <span className="text-sm font-normal text-ink/50">/ always</span></p>
          <p className="mt-3 min-h-10 text-sm text-ink/60">Explore AI-assisted marking with a monthly allowance.</p>
          <ul className="mt-5 flex-1 space-y-3 text-sm text-ink/75">
            <li>✓ 10 scripts each month</li>
            <li>✓ Basic AI grading</li>
            <li>✓ Teacher review workflow</li>
          </ul>
          <Link href="/dashboard" className="mt-7 rounded-md border border-primary/20 px-4 py-2.5 text-center text-sm font-semibold text-primary hover:bg-blue-50">
            Go to dashboard
          </Link>
        </article>

        {plans.map((plan) => (
          <article
            key={plan.id}
            className={`relative flex flex-col rounded-xl border bg-white p-6 shadow-sm ${
              plan.featured ? "border-primary ring-2 ring-primary/20" : "border-primary/15"
            }`}
          >
            {plan.featured && <span className="absolute -top-3 right-5 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Best for departments</span>}
            <p className="text-xs font-bold uppercase tracking-wide text-ink/45">Monthly plan</p>
            <h2 className="mt-3 text-xl font-semibold text-ink">{plan.name}</h2>
            <p className="mt-2 text-3xl font-semibold text-ink">{plan.price} <span className="text-sm font-normal text-ink/50">{plan.interval}</span></p>
            <p className="mt-3 min-h-10 text-sm text-ink/60">{plan.description}</p>
            <ul className="mt-5 flex-1 space-y-3 text-sm text-ink/75">
              {plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
            </ul>
            <CheckoutButton
              product={plan.id}
              label={plan.action}
              className="mt-7 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
            />
          </article>
        ))}
      </section>

      <section className="mt-8 flex flex-col gap-5 rounded-xl border border-primary/15 bg-blue-100/50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-forest">Pay as you go</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">Need a few more scripts?</h2>
          <p className="mt-1 text-sm text-ink/60">Buy 20 grading credits for {formatNaira(500)}. Credits stay in your account until used.</p>
        </div>
        <CheckoutButton
          product="CREDITS"
          label="Buy 20 credits · ₦500"
          className="shrink-0 rounded-md border border-primary/25 bg-white px-5 py-3 text-sm font-semibold text-primary hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
        />
      </section>
      <p className="mt-5 text-center text-xs text-ink/45">Subscription plans are billed monthly through a new payment each month; they do not auto-renew.</p>
    </div>
  );
}
