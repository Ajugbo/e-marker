'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ExamAssistantChat from '@/components/ExamAssistantChat';

interface ExamResponse {
  exam?: {
    title: string;
    rubricJson: string;
  };
  error?: string;
}

interface EditableQuestion {
  text: string;
  markingScheme: string;
  original: Record<string, unknown>;
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getText(value: unknown) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('\n');
  }
  return value === undefined || value === null ? '' : JSON.stringify(value, null, 2);
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
  const [rubricFields, setRubricFields] = useState<Record<string, unknown>>({});
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null);
  const [activeQuestionText, setActiveQuestionText] = useState('');
  const [activeMarkingScheme, setActiveMarkingScheme] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
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
        try {
          const parsed: unknown = JSON.parse(data.exam.rubricJson);
          if (!isRecord(parsed)) throw new Error('The rubric must be a JSON object.');
          setRubricFields(parsed);
          setSubject(getString(parsed.subject));
          setClassLevel(getString(parsed.classLevel));
          setTerm(getString(parsed.term));
          const savedQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
          setQuestions(savedQuestions.map((question): EditableQuestion => {
            const original = isRecord(question) ? question : {};
            return {
              text: getString(original.text) || getString(original.question),
              markingScheme: getText(original.markingScheme ?? original.criteria),
              original,
            };
          }));
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
      const updatedQuestions = questions.map((question) => ({
        ...question.original,
        text: question.text,
        question: question.text,
        markingScheme: question.markingScheme,
      }));
      const updatedRubric: Record<string, unknown> = {
        ...rubricFields,
        title: institution.trim(),
        subject: subject.trim(),
        classLevel: classLevel.trim(),
        questions: updatedQuestions,
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

  const updateQuestion = (index: number, field: 'text' | 'markingScheme', value: string) => {
    setQuestions((currentQuestions) => currentQuestions.map((question, questionIndex) => (
      questionIndex === index ? { ...question, [field]: value } : question
    )));
    if (activeQuestionIndex === index && field === 'text') {
      setActiveQuestionText(value);
    }
    if (activeQuestionIndex === index && field === 'markingScheme') {
      setActiveMarkingScheme(value);
    }
  };

  const persistedQuestions = questions.map((question) => ({
    ...question.original,
    text: question.text,
    question: question.text,
    markingScheme: question.markingScheme,
  }));
  const assistantRubric = JSON.stringify({
    ...rubricFields,
    title: institution,
    subject,
    classLevel,
    questions: persistedQuestions,
  });

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

        <section aria-labelledby="exam-questions-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="exam-questions-heading" className="text-lg font-semibold text-gray-900">
                Questions and Marking Schemes
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Edit each question and its marking scheme before saving.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setQuestions((currentQuestions) => [
                ...currentQuestions,
                { text: '', markingScheme: '', original: {} },
              ])}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Add Question
            </button>
          </div>

          {questions.length === 0 && (
            <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              No questions yet. Add a question to get started.
            </p>
          )}

          {questions.map((question, index) => (
            <article key={index} className="space-y-4 rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-800">Question {index + 1}</h3>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label
                    htmlFor={`question-text-${index}`}
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Question Text
                  </label>
                  <textarea
                    id={`question-text-${index}`}
                    value={question.text}
                    onChange={(event) => updateQuestion(index, 'text', event.target.value)}
                    rows={5}
                    className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`question-marking-scheme-${index}`}
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Marking Scheme
                  </label>
                  <textarea
                    id={`question-marking-scheme-${index}`}
                    value={question.markingScheme}
                    onChange={(event) => updateQuestion(index, 'markingScheme', event.target.value)}
                    rows={5}
                    className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setActiveQuestionIndex(index);
                      setActiveQuestionText(question.text);
                      setActiveMarkingScheme(question.markingScheme);
                      setIsChatOpen(true);
                    }}
                    className="mt-2 text-sm font-semibold text-primary hover:underline"
                  >
                    Ask AI about this question
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>

        <ExamAssistantChat
          activeQuestionIndex={activeQuestionIndex}
          activeQuestionText={activeQuestionText}
          activeMarkingScheme={activeMarkingScheme}
          examContext={{
            title: institution,
            subject,
            classLevel,
            rubric: assistantRubric,
          }}
          isOpen={isChatOpen}
          onOpenChange={setIsChatOpen}
        />

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
