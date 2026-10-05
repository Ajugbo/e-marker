'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Exam {
  id: string;
  title: string;
  createdAt: string;
}

interface Submission {
  id: string;
  studentName: string;
  matricNumber: string;
  class: string;
  status: string;
  score: number | null;
}

interface ResultsResponse {
  exam?: Exam;
  submissions?: Submission[];
  error?: string;
}

export default function ExamResultsPage({ params }: { params: { id: string } }) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [printDate, setPrintDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    const fetchResults = async () => {
      try {
        const response = await fetch(`/api/exams/${params.id}/results`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as ResultsResponse;
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load exam results.');
        }

        setExam(data.exam ?? null);
        setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
        setPrintDate(new Date().toLocaleDateString());
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load exam results.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void fetchResults();
    return () => controller.abort();
  }, [params.id]);

  if (loading) {
    return <p className="py-12 text-center text-ink/60 print:hidden">Loading results...</p>;
  }

  if (error || !exam) {
    return (
      <div className="space-y-5">
        <Link href="/exams" className="text-sm font-semibold text-forest hover:underline print:hidden">
          ← Back to Exams
        </Link>
        <p role="alert" className="rounded-md border border-coral/30 bg-white p-4 text-coral print:hidden">
          {error || 'Exam not found.'}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-6 print:space-y-4">
      <style jsx global>{`
        @page {
          margin: 16mm;
        }

        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }

          .results-table thead {
            display: table-header-group;
          }

          .results-table tr {
            break-inside: avoid;
          }

          .results-table th,
          .results-table td {
            border-color: #d1d5db !important;
            background: transparent !important;
            color: #000 !important;
          }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link href="/exams" className="text-sm font-semibold text-forest hover:underline">
          ← Back to Exams
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#17483c]"
        >
          🖨️ Print Results
        </button>
      </div>

      <header className="border-b border-ink/10 pb-5 print:hidden">
        <p className="text-xs font-bold uppercase tracking-widest text-forest">Exam results</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">{exam.title}</h1>
        <p className="mt-2 text-sm text-ink/55">
          {submissions.length} {submissions.length === 1 ? 'submission' : 'submissions'}
        </p>
      </header>

      <header className="hidden print:mb-5 print:block">
        <p className="text-xs font-semibold uppercase">Exam Marker | Results</p>
        <h1 className="mt-1 text-2xl font-bold">{exam.title}</h1>
        <p className="mt-1 text-sm">Printed {printDate}</p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-ink/10 bg-white shadow-sm print:overflow-visible print:rounded-none print:border-0 print:bg-white print:shadow-none">
        <table className="results-table w-full border-collapse text-left text-sm">
          <thead className="bg-paper text-xs uppercase text-ink/60 print:border-b-2 print:border-black print:bg-white print:text-black">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold print:px-2 print:py-2">Student Name</th>
              <th scope="col" className="px-5 py-3 font-semibold print:px-2 print:py-2">Matric Number</th>
              <th scope="col" className="px-5 py-3 font-semibold print:px-2 print:py-2">Class</th>
              <th scope="col" className="px-5 py-3 font-semibold print:px-2 print:py-2">Score</th>
              <th scope="col" className="px-5 py-3 font-semibold print:px-2 print:py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10 print:divide-gray-300">
            {submissions.length > 0 ? submissions.map((submission) => {
              const graded = submission.score !== null;
              const status = graded || submission.status === 'graded'
                ? 'Graded'
                : submission.status.charAt(0).toUpperCase() + submission.status.slice(1);

              return (
                <tr key={submission.id} className="print:break-inside-avoid">
                  <td className="px-5 py-3 font-medium text-ink print:px-2 print:py-2">{submission.studentName}</td>
                  <td className="px-5 py-3 text-ink/70 print:px-2 print:py-2">{submission.matricNumber}</td>
                  <td className="px-5 py-3 text-ink/70 print:px-2 print:py-2">{submission.class}</td>
                  <td className="px-5 py-3 font-mono text-ink print:px-2 print:py-2">
                    {submission.score === null
                      ? '-'
                      : submission.score.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3 print:px-2 print:py-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold print:px-0 print:py-0 ${
                      graded
                        ? 'bg-mint text-forest print:bg-transparent print:text-black'
                        : 'bg-paper text-ink/65 print:bg-transparent print:text-black'
                    }`}>
                      {status}
                    </span>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink/55 print:px-2 print:py-6">
                  No submissions for this exam yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}