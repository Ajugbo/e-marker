import type { Metadata } from "next";
import Link from "next/link";
import SidebarNavigation from "./sidebar-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "E-Marker | Dashboard",
  description: "Exam grading operations dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)] print:block print:min-h-0">
          <aside className="flex flex-col border-b border-blue-900 bg-gradient-to-b from-blue-900 to-blue-950 px-5 py-5 text-white lg:min-h-screen lg:border-b-0 lg:border-r lg:border-blue-950 lg:px-6 lg:py-8 print:hidden">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/15 text-sm font-bold text-white">EM</span>
              <span>
                <span className="block text-sm font-bold text-white">E-Marker</span>
                <span className="block text-xs text-blue-100/75">Grading workspace</span>
              </span>
            </Link>
            <p className="mb-3 mt-10 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100/60">Workspace</p>
            <SidebarNavigation />
            <div className="mt-auto hidden border-t border-white/15 pt-5 text-xs text-blue-100/60 lg:block">
              <p>E-Marker</p>
              <p className="mt-1">Teacher administration</p>
            </div>
          </aside>
          <main className="min-w-0 bg-blue-50/40 px-5 py-7 sm:px-8 lg:px-12 lg:py-10 print:bg-white print:px-0 print:py-0">{children}</main>
        </div>
      </body>
    </html>
  );
}