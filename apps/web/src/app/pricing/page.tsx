"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

type Product = "STANDARD" | "PREMIUM" | "TOPUP";
const CheckoutButton = dynamic(() => import("./checkout-button"), { ssr: false });

const bundles: {
  id: Product;
  name: string;
  price: string;
  description: string;
  features: string[];
  action: string;
  featured?: boolean;
}[] = [
  {
    id: "STANDARD",
    name: "Standard Bundle",
    price: "₦2,500",
    description: "For individual teachers and lecturers",
    features: [
      "150 grading credits",
      "Full AI grading & rubric generation",
      "Manual review and adjustment workflow",
    ],
    action: "Buy 150 Credits",
  },
  {
    id: "PREMIUM",
    name: "Premium Bundle",
    price: "₦5,000",
    description: "For individual teachers and lecturers",
    features: [
      "350 grading credits",
      "Full AI grading & rubric generation",
      "Manual review and adjustment workflow",
      "Priority processing",
    ],
    action: "Buy 350 Credits",
    featured: true,
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-3 border-b border-primary/20 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-forest">Made for Nigerian classrooms</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Simple grading credits, when you need them.</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink/60">
            Buy credits once and use them whenever you grade. Payments are processed securely by Paystack.
          </p>
        </div>
        <Link href="/settings/billing" className="text-sm font-semibold text-primary hover:underline">View payment history</Link>
      </header>

      <section aria-label="Credit bundles" className="mt-8 grid gap-5 lg:grid-cols-[0.75fr_1.25fr_1.25fr]">
        <article className="flex flex-col self-center rounded-xl border border-primary/10 bg-blue-50/60 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink/45">Try it free</p>
          <h2 className="mt-3 text-lg font-semibold text-ink">Free Trial</h2>
          <p className="mt-2 text-sm text-ink/60">Get started with 50 free scripts to test the platform.</p>
          <Link href="/dashboard" className="mt-6 rounded-md border border-primary/20 px-4 py-2.5 text-center text-sm font-semibold text-primary hover:bg-blue-50">
            Start Grading
          </Link>
        </article>

        {bundles.map((bundle) => (
          <article
            key={bundle.id}
            className={`relative flex flex-col rounded-xl border bg-white p-6 shadow-sm ${
              bundle.featured ? "border-primary ring-2 ring-primary/20" : "border-primary/15"
            }`}
          >
            {bundle.featured && <span className="absolute -top-3 right-5 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Best Value</span>}
            <h2 className="mt-1 text-xl font-semibold text-ink">{bundle.name}</h2>
            <p className="mt-2 text-3xl font-semibold text-ink">{bundle.price}</p>
            <p className="mt-3 min-h-10 text-sm text-ink/60">{bundle.description}</p>
            <ul className="mt-5 flex-1 space-y-3 text-sm text-ink/75">
              {bundle.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
            </ul>
            <CheckoutButton
              product={bundle.id}
              label={bundle.action}
              className="mt-7 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
            />
          </article>
        ))}
      </section>

      <section aria-label="Credit top-up" className="mt-8 flex flex-col gap-5 rounded-xl border border-primary/10 bg-blue-50/50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Need a quick top-up?</h2>
          <p className="mt-1 text-sm text-ink/60">Buy 20 credits for ₦500.</p>
        </div>
        <CheckoutButton
          product="TOPUP"
          label="Buy 20 Credits"
          className="shrink-0 rounded-md border border-primary/25 bg-white px-5 py-3 text-sm font-semibold text-primary hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
        />
      </section>
    </div>
  );
}
