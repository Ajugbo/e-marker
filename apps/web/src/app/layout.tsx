import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Exam Marker | Dashboard",
  description: "Exam grading operations dashboard",
};

const navigation = [
  ["Overview", "/", "01"],
  ["Exams", "/exams", "02"],
  ["Scripts", "/scripts", "03"],
  ["Credits", "/credits", "04"],
  ["Review", "/review", "05"],
] as const;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)] print:block print:min-h-0">
          <aside className="flex flex-col border-b border-ink/10 bg-white px-5 py-5 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-6 lg:py-8 print:hidden">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-forest text-sm font-bold text-white">EM</span>
              <span>
                <span className="block text-sm font-bold text-ink">Exam Marker</span>
                <span className="block text-xs text-ink/55">Grading workspace</span>
              </span>
            </Link>
            <p className="mb-3 mt-10 text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40">Workspace</p>
            <nav className="flex gap-2 overflow-x-auto lg:flex-col">
              {navigation.map(([label, href, number], index) => (
                <Link
                  key={label}
                  href={href}
                  className={`flex min-w-fit items-center gap-3 rounded-md px-3 py-2.5 text-sm ${index === 0 ? "bg-mint font-semibold text-forest" : "text-ink/65 hover:bg-paper hover:text-ink"}`}
                >
                  <span className="font-mono text-[10px] opacity-60">{number}</span>
                  {label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto hidden border-t border-ink/10 pt-5 text-xs text-ink/45 lg:block">
              <p>Exam Marker</p>
              <p className="mt-1">Teacher administration</p>
            </div>
          </aside>
          <main className="min-w-0 px-5 py-7 sm:px-8 lg:px-12 lg:py-10 print:px-0 print:py-0">{children}</main>
        </div>
      </body>
    </html>
  );
}