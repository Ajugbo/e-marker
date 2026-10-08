"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navigation = [
  ["Overview", "/dashboard", "01"],
  ["Exams", "/exams", "02"],
  ["Scripts", "/scripts", "03"],
  ["Review", "/review", "04"],
  ["Billing", "/settings/billing", "05"],
  ["Pricing", "/pricing", "06"],
] as const;

type AccountSummary = {
  credits: number;
};

export default function SidebarNavigation() {
  const pathname = usePathname();
  const [account, setAccount] = useState<AccountSummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/payments/billing", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as AccountSummary;
        setAccount(data);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("[sidebar:billing] Could not load account summary", error);
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <>
      <nav className="flex gap-2 overflow-x-auto lg:flex-col">
      {navigation.map(([label, href, number]) => {
        const isActive = href === "/dashboard"
          ? pathname === "/" || pathname.startsWith("/dashboard")
          : pathname.startsWith(href);

        return (
          <Link
            key={label}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-w-fit items-center gap-3 rounded-md px-3 py-2.5 text-sm ${
              isActive
                ? "bg-white/15 font-semibold text-white ring-1 ring-inset ring-white/10"
                : "text-blue-100/75 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="font-mono text-[10px] opacity-60">{number}</span>
            {label}
          </Link>
        );
      })}
      </nav>
      {account && (
        <div className="mt-3 rounded-lg border border-white/15 bg-white/10 p-3 text-white lg:mt-5 lg:p-4">
          <p className="text-xs text-blue-100/75">Credits: <span className="font-semibold text-white">{account.credits}</span></p>
          <Link href="/pricing" className="mt-2 inline-block text-[10px] font-semibold text-blue-100 underline hover:text-white">Buy Credits</Link>
        </div>
      )}
    </>
  );
}
