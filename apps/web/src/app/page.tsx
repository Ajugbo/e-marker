import Link from "next/link";
const metrics = [
  { label: "Active exams", value: "08", note: "Across 4 classes", color: "bg-mint" },
  { label: "Scripts received", value: "246", note: "This term", color: "bg-[#f9e5d9]" },
  { label: "Awaiting review", value: "19", note: "AI-graded scripts", color: "bg-[#e8e9d5]" },
  { label: "Credits remaining", value: "1,284", note: "Across your account", color: "bg-[#dfe9ee]" },
];

const activity = [
  { title: "Algebra II · Midterm", detail: "Class 10B · 32 scripts", status: "Grading", time: "12 min ago", progress: "72%" },
  { title: "Biology · Cell structure", detail: "Class 9A · 28 scripts", status: "Review needed", time: "Yesterday", progress: "100%" },
  { title: "English · Persuasive writing", detail: "Class 11C · 24 scripts", status: "Ready", time: "Yesterday", progress: "100%" },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col justify-between gap-5 border-b border-ink/10 pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-forest">Monday, October 5, 2026</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Good morning</h1>
          <p className="mt-2 text-sm text-ink/60">Here is the grading activity across your workspace.</p>
        </div>
        <Link href="/exams/new" className="w-fit rounded-md bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#17483c] inline-block">
          Create an exam <span aria-hidden="true" className="ml-2">+</span>
        </Link>
      </header>

      <section aria-label="Workspace metrics" className="grid gap-px overflow-hidden rounded-lg border border-ink/10 bg-ink/10 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink/65">{metric.label}</p>
              <span className={`h-2.5 w-2.5 rounded-full ${metric.color}`} />
            </div>
            <p className="mt-5 text-3xl font-semibold tabular-nums text-ink">{metric.value}</p>
            <p className="mt-1 text-xs text-ink/45">{metric.note}</p>
          </article>
        ))}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Recent exams</h2>
            <p className="mt-1 text-sm text-ink/55">Track submissions and review status.</p>
          </div>
          <a href="/api/exams" className="text-sm font-semibold text-forest hover:underline">View API</a>
        </div>
        <div className="overflow-x-auto rounded-lg border border-ink/10 bg-white">
          <div className="grid min-w-[680px] grid-cols-[minmax(220px,1.5fr)_1fr_140px_110px] border-b border-ink/10 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-ink/40">
            <span>Exam</span><span>Progress</span><span>Status</span><span>Updated</span>
          </div>
          {activity.map((item) => (
            <article key={item.title} className="grid min-w-[680px] grid-cols-[minmax(220px,1.5fr)_1fr_140px_110px] items-center border-b border-ink/5 px-5 py-4 last:border-0">
              <div>
                <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-1 text-xs text-ink/50">{item.detail}</p>
              </div>
              <div className="flex items-center gap-3 pr-6">
                <div className="h-1.5 flex-1 rounded-full bg-paper"><div className="h-1.5 rounded-full bg-forest" style={{ width: item.progress }} /></div>
                <span className="w-9 text-right text-xs tabular-nums text-ink/55">{item.progress}</span>
              </div>
              <span className="text-xs font-medium text-forest">{item.status}</span>
              <span className="text-xs text-ink/45">{item.time}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}