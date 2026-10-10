'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

const examDetailsSchema = z.object({
  institution: z.string().trim().min(1, 'Institution is required'),
  courseSubject: z.string().trim().min(1, 'Course/Subject is required'),
  classLevel: z.string().trim().min(1, 'Class/Level is required'),
  sampleQuestions: z.string().trim().min(1, 'Sample questions are required'),
});

const examSubmissionSchema = z.object({
  institution: z.string().trim().min(1, 'Institution is required'),
  courseSubject: z.string().trim().min(1, 'Course/Subject is required'),
  classLevel: z.string().trim().min(1, 'Class/Level is required'),
});

interface EditableQuestion {
  questionNumber: string;
  questionText: string;
  markingScheme: string;
  marks: string;
  parentQuestionNumber: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default function CreateExamPage() {
  const router = useRouter();
  const [institution, setInstitution] = useState('');
  const [courseSubject, setCourseSubject] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [sampleQuestions, setSampleQuestions] = useState('');
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerateRubric = async () => {
    const parsedDetails = examDetailsSchema.safeParse({
      institution,
      courseSubject,
      classLevel,
      sampleQuestions,
    });
    if (!parsedDetails.success) {
      setError(parsedDetails.error.issues[0]?.message ?? 'Please complete all exam details.');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/exams/generate-rubric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: parsedDetails.data.institution,
          subject: parsedDetails.data.courseSubject,
          classLevel: parsedDetails.data.classLevel,
          sampleQuestions: parsedDetails.data.sampleQuestions,
        }),
      });

      const data = await response.json() as { rubric?: { questions?: unknown[] }; error?: string };
      if (!response.ok) throw new Error(data.error || 'Failed to prepare question drafts.');
      if (!Array.isArray(data.rubric?.questions)) throw new Error('The question draft response was invalid.');
      setQuestions(data.rubric.questions.flatMap((value, index): EditableQuestion[] => {
        if (!isRecord(value)) return [];
        return [{
          questionNumber: typeof value.questionNumber === 'string' ? value.questionNumber : String(index + 1),
          questionText: typeof value.questionText === 'string' ? value.questionText : '',
          markingScheme: typeof value.markingScheme === 'string' ? value.markingScheme : '',
          marks: typeof value.marks === 'number' ? String(value.marks) : '1',
          parentQuestionNumber: '',
        }];
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedSubmission = examSubmissionSchema.safeParse({ institution, courseSubject, classLevel });
    if (!parsedSubmission.success) {
      setError(parsedSubmission.error.issues[0]?.message ?? 'Please complete the exam details.');
      return;
    }
    if (questions.length === 0) {
      setError('Add at least one question before creating the exam.');
      return;
    }
    if (questions.some((question) => !question.questionNumber.trim()
      || !question.questionText.trim()
      || !question.markingScheme.trim()
      || !Number.isSafeInteger(Number(question.marks))
      || Number(question.marks) < 1)) {
      setError('Every question needs a number, question text, teacher marking scheme, and positive whole-number marks.');
      return;
    }

    const rubricJson = JSON.stringify({
      title: parsedSubmission.data.institution,
      subject: parsedSubmission.data.courseSubject,
      classLevel: parsedSubmission.data.classLevel,
      totalPoints: questions
        .filter((question) => !question.parentQuestionNumber)
        .reduce((total, question) => total + Number(question.marks), 0),
      questions: questions.map((question) => ({
        questionNumber: question.questionNumber.trim(),
        questionText: question.questionText.trim(),
        markingScheme: question.markingScheme.trim(),
        marks: Number(question.marks),
        parentQuestionNumber: question.parentQuestionNumber || null,
      })),
    }, null, 2);

    setIsGenerating(true); // Reuse loading state
    setError('');

    try {
      const response = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: parsedSubmission.data.institution,
          rubricJson,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create exam');
      }

      // Show success message
      alert(`✅ Exam created successfully! ID: ${data.examId}`);
      
      // Redirect to exams list
      router.push('/exams');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateQuestion = (index: number, field: keyof EditableQuestion, value: string) => {
    setQuestions((current) => current.map((question, questionIndex) => (
      questionIndex === index ? { ...question, [field]: value } : question
    )));
  };

  const addQuestion = (parentQuestionNumber = '') => {
    setQuestions((current) => {
      const siblingCount = current.filter((question) => question.parentQuestionNumber === parentQuestionNumber).length;
      const questionNumber = parentQuestionNumber
        ? `${parentQuestionNumber}${String.fromCharCode(97 + siblingCount)}`
        : String(siblingCount + 1);
      return [...current, {
        questionNumber,
        questionText: '',
        markingScheme: '',
        marks: '1',
        parentQuestionNumber,
      }];
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Create New Exam</h1>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Institution
            </label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-forest focus:border-transparent"
              placeholder="e.g., Northview High School"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course/Subject
            </label>
            <input
              type="text"
              value={courseSubject}
              onChange={(e) => setCourseSubject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-forest focus:border-transparent"
              placeholder="e.g., Mathematics"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Class/Level
          </label>
          <input
            type="text"
            value={classLevel}
            onChange={(e) => setClassLevel(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-forest focus:border-transparent"
            placeholder="e.g., Year 10"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sample Questions (one per line, optional)
          </label>
          <textarea
            value={sampleQuestions}
            onChange={(e) => setSampleQuestions(e.target.value)}
            rows={5}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-forest focus:border-transparent"
            placeholder="Solve for x: x² + 5x + 6 = 0&#10;Factorize: x² - 9&#10;Find the roots of: 2x² - 8x + 6 = 0"
          />
        </div>

        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={handleGenerateRubric}
            disabled={isGenerating}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 font-semibold disabled:opacity-50"
          >
            {isGenerating ? 'Preparing...' : 'Add questions from samples'}
          </button>
        </div>

        <section aria-labelledby="question-list-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="question-list-heading" className="text-lg font-semibold text-gray-900">
                Questions and Teacher Marking Schemes
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Enter the exact marking scheme for each part. Parent marks must equal the sum of their sub-parts. Generated drafts never include AI-created criteria.
              </p>
            </div>
            <button
              type="button"
              onClick={() => addQuestion()}
              disabled={isGenerating}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              Add Question
            </button>
          </div>

          {questions.length === 0 && (
            <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              Add questions manually or prepare drafts from the sample questions above.
            </p>
          )}

          {questions.map((question, index) => (
            <article key={`${question.questionNumber}-${index}`} className="space-y-4 rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">
                  {question.parentQuestionNumber ? `Part ${question.questionNumber}` : `Question ${question.questionNumber}`}
                </h3>
                <button
                  type="button"
                  onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  disabled={isGenerating}
                  className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor={`question-number-${index}`} className="mb-2 block text-sm font-medium text-gray-700">
                    Question number
                  </label>
                  <input
                    id={`question-number-${index}`}
                    required
                    maxLength={24}
                    value={question.questionNumber}
                    onChange={(event) => updateQuestion(index, 'questionNumber', event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor={`question-parent-${index}`} className="mb-2 block text-sm font-medium text-gray-700">
                    Parent question (optional)
                  </label>
                  <select
                    id={`question-parent-${index}`}
                    value={question.parentQuestionNumber}
                    onChange={(event) => updateQuestion(index, 'parentQuestionNumber', event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="">No parent (top-level question)</option>
                    {questions.filter((_, itemIndex) => itemIndex !== index).map((parent) => (
                      <option key={parent.questionNumber} value={parent.questionNumber}>
                        {parent.questionNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`question-marks-${index}`} className="mb-2 block text-sm font-medium text-gray-700">
                    Marks
                  </label>
                  <input
                    id={`question-marks-${index}`}
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={question.marks}
                    onChange={(event) => updateQuestion(index, 'marks', event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label htmlFor={`question-text-${index}`} className="mb-2 block text-sm font-medium text-gray-700">
                    Question Text
                  </label>
                  <textarea
                    id={`question-text-${index}`}
                    required
                    rows={5}
                    value={question.questionText}
                    onChange={(event) => updateQuestion(index, 'questionText', event.target.value)}
                    className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor={`question-scheme-${index}`} className="mb-2 block text-sm font-medium text-gray-700">
                    Teacher Marking Scheme / Answer Key
                  </label>
                  <textarea
                    id={`question-scheme-${index}`}
                    required
                    rows={5}
                    value={question.markingScheme}
                    onChange={(event) => updateQuestion(index, 'markingScheme', event.target.value)}
                    className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => addQuestion(question.questionNumber)}
                disabled={isGenerating}
                className="text-sm font-semibold text-primary hover:underline disabled:opacity-50"
              >
                Add sub-part under {question.questionNumber}
              </button>
            </article>
          ))}
        </section>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={isGenerating}
            className="px-6 py-2 bg-primary text-white rounded-md hover:bg-blue-700 font-semibold"
          >
            Create Exam
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
