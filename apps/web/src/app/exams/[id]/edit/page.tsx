'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ExamResponse {
  exam?: {
    title: string;
    rubricJson: string;
  };
  error?: string;
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default function EditExamPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [institution, setInstitution] = useState('');
  const [subject, setSubject] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [term, setTerm] = useState('');
  const [sampleQuestions, setSampleQuestions] = useState('');
  const [rubric, setRubric] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    const loadExam = async () => {
      try {
        const response = await fetch(`/api/exams/${params.id}`, { signal: controller.signal });
        const data = (await response.json()) as ExamResponse;
        if (!response.ok) throw new Error(data.error || 'Failed to load exam.');
        if (!data.exam) throw new Error('The exam response was invalid.');

        setInstitution(data.exam.title);
        setRubric(data.exam.rubricJson);
        try {
          const parsed: unknown = JSON.parse(data.exam.rubricJson);
          if (!isRecord(parsed)) throw new Error('The rubric must be a JSON object.');
          setSubject(getString(parsed.subject));
          setClassLevel(getString(parsed.classLevel));
          setTerm(getString(parsed.term));
          const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
          setSampleQuestions(questions
            .map((question) => isRecord(question) ? getString(question.question) : '')
            .filter(Boolean)
            .join('\n'));
        } catch (parseError) {
          setError(parseError instanceof Error ? parseError.message : 'The saved rubric is invalid JSON.');
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load exam.');
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadExam();
    return () => controller.abort();
  }, [params.id]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      let parsedRubric: unknown;
      try {
        parsedRubric = JSON.parse(rubric) as unknown;
      } catch {
        throw new Error('Rubric details must be valid JSON.');
      }
      if (!isRecord(parsedRubric)) throw new Error('Rubric details must be a JSON object.');

      const updatedRubric: Record<string, unknown> = {
        ...parsedRubric,
        title: institution.trim(),
        subject: subject.trim(),
        classLevel: classLevel.trim(),
      };
      if (term.trim()) updatedRubric.term = term.trim();
      else delete updatedRubric.term;

      const response = await fetch(`/api/exams/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: institution.trim(),
          rubricJson: JSON.stringify(updatedRubric, null, 2),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Failed to update exam.');

      setSuccess('Exam updated successfully. Returning to your exams…');
      window.setTimeout(() => router.push('/exams'), 900);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to update exam.');
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 text-gray-500">Loading exam...</div>;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Edit Exam</h1>
        <Link href="/exams" className="text-sm font-semibold text-primary hover:underline">
          Back to Exams
        </Link>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-green-800">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="institution" className="mb-2 block text-sm font-medium text-gray-700">
            Institution
          </label>
          <input
            id="institution"
            required
            maxLength={160}
            value={institution}
            onChange={(event) => setInstitution(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-4 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="subject" className="mb-2 block text-sm font-medium text-gray-700">
              Subject/Course
            </label>
            <input
              id="subject"
              required
              maxLength={160}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-4 py-2"
            />
          </div>
          <div>
            <label htmlFor="classLevel" className="mb-2 block text-sm font-medium text-gray-700">
              Class/Level
            </label>
            <input
              id="classLevel"
              required
              maxLength={200}
              value={classLevel}
              onChange={(event) => setClassLevel(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-4 py-2"
            />
          </div>
        </div>

        <div>
          <label htmlFor="term" className="mb-2 block text-sm font-medium text-gray-700">
            Term/Session
          </label>
          <input
            id="term"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-4 py-2"
          />
        </div>

        <div>
          <label htmlFor="sampleQuestions" className="mb-2 block text-sm font-medium text-gray-700">
            Questions in this rubric
          </label>
          <textarea
            id="sampleQuestions"
            readOnly
            value={sampleQuestions}
            rows={5}
            className="w-full rounded-md border border-gray-300 bg-gray-50 px-4 py-2"
          />
          <p className="mt-1 text-xs text-gray-500">Edit questions and marking criteria in the rubric JSON below.</p>
        </div>

        <div>
          <label htmlFor="rubric" className="mb-2 block text-sm font-medium text-gray-700">
            Rubric/Mark Scheme (JSON format — editable)
          </label>
          <textarea
            id="rubric"
            required
            value={rubric}
            onChange={(event) => {
              const value = event.target.value;
              setRubric(value);
              try {
                const parsed: unknown = JSON.parse(value);
                if (isRecord(parsed) && Array.isArray(parsed.questions)) {
                  setSampleQuestions(parsed.questions
                    .map((question) => isRecord(question) ? getString(question.question) : '')
                    .filter(Boolean)
                    .join('\n'));
                }
              } catch {
                setSampleQuestions('');
              }
            }}
            rows={16}
            className="w-full rounded-md border border-gray-300 px-4 py-2 font-mono text-sm"
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-primary px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-300 px-6 py-2 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
