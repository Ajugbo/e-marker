'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';

type ReviewStatus = 'PENDING' | 'GRADED' | 'AWAITING_REVIEW' | 'REVIEWED';
type StatusFilter = 'ALL' | ReviewStatus;

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
  reviewStatus: ReviewStatus;
  adjustmentPoints: number;
  adjustmentReason: string | null;
  adjustedBy: string | null;
  adjustedAt: string | null;
  score: number | null;
  feedback: string | null;
  canAutoGrade: boolean;
}

interface ResultsResponse {
  exam?: Exam;
  submissions?: Submission[];
  error?: string;
}

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'GRADED', label: 'Graded' },
  { value: 'AWAITING_REVIEW', label: 'Awaiting Review' },
  { value: 'REVIEWED', label: 'Reviewed' },
];

const statusStyles: Record<ReviewStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  GRADED: 'bg-green-100 text-green-800',
  AWAITING_REVIEW: 'bg-amber-100 text-amber-800',
  REVIEWED: 'bg-blue-100 text-blue-800',
};

function formatStatus(status: ReviewStatus) {
  return status === 'AWAITING_REVIEW'
    ? 'Awaiting Review'
    : status.charAt(0) + status.slice(1).toLowerCase();
}

export default function ExamResultsPage({ params }: { params: { id: string } }) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [printDate, setPrintDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gradingScriptId, setGradingScriptId] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [adjustingScript, setAdjustingScript] = useState<Submission | null>(null);
  const [individualPoints, setIndividualPoints] = useState('0');
  const [individualReason, setIndividualReason] = useState('');
  const [individualTeacher, setIndividualTeacher] = useState('');
  const [bulkPoints, setBulkPoints] = useState('0');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkTeacher, setBulkTeacher] = useState('');
  const [adjustmentBusy, setAdjustmentBusy] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState('');
  const [adjustmentMessage, setAdjustmentMessage] = useState('');

  const fetchResults = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/exams/${params.id}/results`, { signal });
      const data = (await response.json()) as ResultsResponse;
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load exam results.');
      }

      setExam(data.exam ?? null);
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
      setPrintDate(new Date().toLocaleDateString());
      setError('');
    } catch (err) {
      if (!signal?.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to load exam results.');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchResults(controller.signal);
    return () => controller.abort();
  }, [fetchResults]);

  const visibleSubmissions = useMemo(
    () => statusFilter === 'ALL'
      ? submissions
      : submissions.filter((submission) => submission.reviewStatus === statusFilter),
    [statusFilter, submissions],
  );

  const autoGrade = async (scriptId: string) => {
    setGradingScriptId(scriptId);
    setGradeError('');
    try {
      const response = await fetch(`/api/scripts/${scriptId}/grade`, { method: 'POST' });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to grade script.');
      }
      await fetchResults();
    } catch (err) {
      setGradeError(err instanceof Error ? err.message : 'Failed to grade script.');
    } finally {
      setGradingScriptId(null);
    }
  };

  const openAdjustment = (submission: Submission) => {
    setAdjustingScript(submission);
    setIndividualPoints(String(submission.adjustmentPoints));
    setIndividualReason(submission.adjustmentReason ?? '');
    setIndividualTeacher(submission.adjustedBy ?? '');
    setAdjustmentError('');
    setAdjustmentMessage('');
  };

  const submitIndividualAdjustment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adjustingScript) return;
    setAdjustmentBusy(true);
    setAdjustmentError('');
    setAdjustmentMessage('');
    try {
      const response = await fetch(`/api/scripts/${adjustingScript.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustmentPoints: Number(individualPoints),
          adjustmentReason: individualReason,
          adjustedBy: individualTeacher,
          reviewStatus: 'REVIEWED',
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Failed to adjust script score.');
      setAdjustingScript(null);
      setAdjustmentMessage(`Score adjusted for ${adjustingScript.studentName}.`);
      await fetchResults();
    } catch (err) {
      setAdjustmentError(err instanceof Error ? err.message : 'Failed to adjust script score.');
    } finally {
      setAdjustmentBusy(false);
    }
  };

  const submitBulkAdjustment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdjustmentBusy(true);
    setAdjustmentError('');
    setAdjustmentMessage('');
    try {
      const response = await fetch(`/api/exams/${params.id}/bulk-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustmentPoints: Number(bulkPoints),
          adjustmentReason: bulkReason,
          adjustedBy: bulkTeacher,
          reviewStatus: 'REVIEWED',
        }),
      });
      const data = (await response.json()) as { error?: string; updatedCount?: number };
      if (!response.ok) throw new Error(data.error || 'Failed to apply bulk adjustment.');
      setAdjustmentMessage(`Adjustment applied to ${data.updatedCount ?? 0} scripts.`);
      await fetchResults();
    } catch (err) {
      setAdjustmentError(err instanceof Error ? err.message : 'Failed to apply bulk adjustment.');
    } finally {
      setAdjustmentBusy(false);
    }
  };

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
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          🖨️ Print Results
        </button>
      </div>

      <header className="border-b border-primary/20 pb-5 print:hidden">
        <p className="text-xs font-bold uppercase tracking-widest text-forest">Exam results</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">{exam.title}</h1>
        <p className="mt-2 text-sm text-ink/55">
          {submissions.length} {submissions.length === 1 ? 'submission' : 'submissions'}
        </p>
      </header>

      <header className="hidden print:mb-5 print:block">
        <p className="text-xs font-semibold uppercase">E-Marker | Results</p>
        <h1 className="mt-1 text-2xl font-bold">{exam.title}</h1>
        <p className="mt-1 text-sm">Printed {printDate}</p>
      </header>

      <section className="rounded-lg border border-primary/15 bg-white p-5 shadow-sm print:hidden">
        <h2 className="text-lg font-bold text-ink">Bulk Adjustment</h2>
        <p className="mt-1 text-sm text-ink/60">
          Apply the same point adjustment to every script in this exam.
        </p>
        <form onSubmit={(event) => void submitBulkAdjustment(event)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-ink">
            Points to add/subtract
            <input
              type="number"
              step="1"
              required
              value={bulkPoints}
              onChange={(event) => setBulkPoints(event.target.value)}
              className="mt-1 block w-full rounded-md border border-primary/20 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-ink">
            Reason
            <input
              type="text"
              required
              maxLength={1000}
              value={bulkReason}
              onChange={(event) => setBulkReason(event.target.value)}
              className="mt-1 block w-full rounded-md border border-primary/20 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-ink">
            Teacher Name/Email
            <input
              type="text"
              required
              maxLength={200}
              value={bulkTeacher}
              onChange={(event) => setBulkTeacher(event.target.value)}
              className="mt-1 block w-full rounded-md border border-primary/20 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={adjustmentBusy}
            className="self-end rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {adjustmentBusy ? 'Applying...' : 'Apply to All'}
          </button>
        </form>
      </section>

      {adjustmentError && (
        <p role="alert" className="rounded-md border border-coral/30 bg-white p-4 text-sm text-coral print:hidden">
          {adjustmentError}
        </p>
      )}
      {adjustmentMessage && (
        <p role="status" className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800 print:hidden">
          {adjustmentMessage}
        </p>
      )}
      {gradeError && (
        <p role="alert" className="rounded-md border border-coral/30 bg-white p-4 text-sm text-coral print:hidden">
          {gradeError}
        </p>
      )}

      <div className="flex flex-wrap gap-2 print:hidden" aria-label="Filter scripts by review status">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            aria-pressed={statusFilter === filter.value}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              statusFilter === filter.value
                ? 'border-primary bg-primary text-white'
                : 'border-primary/20 bg-white text-ink/70 hover:bg-blue-50'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-primary/15 bg-blue-50/50 shadow-sm print:overflow-visible print:rounded-none print:border-0 print:bg-white print:shadow-none">
        <table className="results-table w-full border-collapse text-left text-sm">
          <thead className="bg-blue-100/60 text-xs uppercase text-ink/70 print:border-b-2 print:border-black print:bg-white print:text-black">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold print:px-2 print:py-2">Student Name</th>
              <th scope="col" className="px-5 py-3 font-semibold print:px-2 print:py-2">Matric Number</th>
              <th scope="col" className="px-5 py-3 font-semibold print:px-2 print:py-2">Class</th>
              <th scope="col" className="px-5 py-3 font-semibold print:px-2 print:py-2">Final Score</th>
              <th scope="col" className="px-5 py-3 font-semibold print:px-2 print:py-2">Feedback</th>
              <th scope="col" className="px-5 py-3 font-semibold print:px-2 print:py-2">Status</th>
              <th scope="col" className="px-5 py-3 font-semibold print:hidden">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10 print:divide-gray-300">
            {visibleSubmissions.length > 0 ? visibleSubmissions.map((submission) => {
              const status = submission.reviewStatus ?? (
                submission.score !== null || submission.status === 'graded' ? 'GRADED' : 'PENDING'
              );
              const finalScore = submission.score === null
                ? null
                : submission.score + submission.adjustmentPoints;

              return (
                <tr key={submission.id} className="print:break-inside-avoid">
                  <td className="px-5 py-3 font-medium text-ink print:px-2 print:py-2">{submission.studentName}</td>
                  <td className="px-5 py-3 text-ink/70 print:px-2 print:py-2">{submission.matricNumber}</td>
                  <td className="px-5 py-3 text-ink/70 print:px-2 print:py-2">{submission.class}</td>
                  <td className="px-5 py-3 font-mono text-ink print:px-2 print:py-2">
                    {finalScore === null
                      ? '-'
                      : (
                        <>
                          {finalScore.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          {submission.adjustmentPoints !== 0 && (
                            <span className="ml-2 text-xs text-ink/55">
                              ({submission.score} {submission.adjustmentPoints > 0 ? '+' : '-'} {Math.abs(submission.adjustmentPoints)})
                            </span>
                          )}
                        </>
                      )}
                  </td>
                  <td className="max-w-md px-5 py-3 text-ink/70 print:px-2 print:py-2">
                    {submission.feedback || '-'}
                    {submission.adjustmentReason && (
                      <p className="mt-1 text-xs text-ink/55">
                        Adjustment: {submission.adjustmentReason}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 print:px-2 print:py-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold print:px-0 print:py-0 ${statusStyles[status]}`}>
                      {formatStatus(status)}
                    </span>
                  </td>
                  <td className="px-5 py-3 print:hidden">
                    <button
                      type="button"
                      onClick={() => openAdjustment(submission)}
                      className="rounded-md border border-primary/25 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-blue-50"
                    >
                      Adjust Score
                    </button>
                    {submission.canAutoGrade && (
                      <button
                        type="button"
                        onClick={() => void autoGrade(submission.id)}
                        disabled={gradingScriptId !== null}
                        className="mt-2 block rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                      >
                        {gradingScriptId === submission.id ? 'Grading...' : '🤖 Auto-Grade'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-ink/55 print:px-2 print:py-6">
                  {submissions.length === 0
                    ? 'No submissions for this exam yet.'
                    : 'No submissions match this review status.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {adjustingScript && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !adjustmentBusy) setAdjustingScript(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="adjust-score-title"
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
          >
            <h2 id="adjust-score-title" className="text-xl font-bold text-ink">
              Adjust Score: {adjustingScript.studentName}
            </h2>
            <form onSubmit={(event) => void submitIndividualAdjustment(event)} className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-ink">
                Adjustment Points (+/-)
                <input
                  type="number"
                  step="1"
                  required
                  value={individualPoints}
                  onChange={(event) => setIndividualPoints(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-primary/20 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                Reason
                <textarea
                  required
                  maxLength={1000}
                  value={individualReason}
                  onChange={(event) => setIndividualReason(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-primary/20 px-3 py-2"
                  rows={3}
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                Teacher Name/Email
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={individualTeacher}
                  onChange={(event) => setIndividualTeacher(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-primary/20 px-3 py-2"
                />
              </label>
              {adjustmentError && (
                <p role="alert" className="text-sm text-coral">{adjustmentError}</p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={adjustmentBusy}
                  onClick={() => setAdjustingScript(null)}
                  className="rounded-md border border-primary/20 px-4 py-2 text-sm font-semibold text-ink/70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustmentBusy}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {adjustmentBusy ? 'Saving...' : 'Submit'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
