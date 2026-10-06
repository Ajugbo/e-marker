"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  ["Overview", "/", "01"],
  ["Exams", "/exams", "02"],
  ["Scripts", "/scripts", "03"],
  ["Credits", "/credits", "04"],
  ["Review", "/review", "05"],
] as const;

export default function SidebarNavigation() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto lg:flex-col">
      {navigation.map(([label, href, number]) => {
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

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
  );
}
