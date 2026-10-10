"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

type Product = "STANDARD" | "PREMIUM" | "TOPUP";
const CheckoutButton = dynamic(() => import("./checkout-button"), { ssr: false });

const bundles: {
  id: Product;
  name: string;
  price: string;
  scripts: number;
  action: string;
  featured?: boolean;
}[] = [
  {
    id: "STANDARD",
    name: "Standard Bundle",
    price: "₦4,999",
    scripts: 150,
    action: "Buy 150 Scripts",
  },
  {
    id: "PREMIUM",
    name: "Premium Bundle",
    price: "₦9,999",
    scripts: 300,
    action: "Buy 300 Scripts",
    featured: true,
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-3 border-b border-primary/20 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Pricing</h1>
        </div>
        <Link href="/settings/billing" className="text-sm font-semibold text-primary hover:underline">View payment history</Link>
      </header>

      <section aria-label="Credit bundles" className="mt-8 grid gap-5 lg:grid-cols-[0.75fr_1.25fr_1.25fr]">
        <article className="flex flex-col self-center rounded-xl border border-primary/10 bg-blue-50/60 p-5">
          <h2 className="mt-3 text-lg font-semibold text-ink">Free Trial</h2>
          <p className="mt-2 text-3xl font-semibold text-ink">10 scripts</p>
          <p className="mt-1 text-sm text-ink/60">Free</p>
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
            <h2 className="mt-1 text-xl font-semibold text-ink">{bundle.name}</h2>
            <p className="mt-2 text-3xl font-semibold text-ink">{bundle.price}</p>
            <p className="mt-3 text-sm text-ink/60">{bundle.scripts} scripts</p>
            {bundle.featured && <p className="mt-2 text-xs text-ink/60">Lower cost per script for financial convenience.</p>}
            <CheckoutButton
              product={bundle.id}
              label={bundle.action}
              className="mt-7 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
            />
          </article>
        ))}
      </section>
    </div>
  );
}
