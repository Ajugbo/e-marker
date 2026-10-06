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
  rubric: z.string().trim().min(2, 'Rubric/Mark Scheme is required'),
});

export default function CreateExamPage() {
  const router = useRouter();
  const [institution, setInstitution] = useState('');
  const [courseSubject, setCourseSubject] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [sampleQuestions, setSampleQuestions] = useState('');
  const [rubric, setRubric] = useState('');
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
          topic: parsedDetails.data.classLevel,
          sampleQuestions: parsedDetails.data.sampleQuestions,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate rubric');

      const data = await response.json();
      setRubric(JSON.stringify(data.rubric, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedSubmission = examSubmissionSchema.safeParse({ institution, rubric });
    if (!parsedSubmission.success) {
      setError(parsedSubmission.error.issues[0]?.message ?? 'Please complete the exam details.');
      return;
    }

    setIsGenerating(true); // Reuse loading state
    setError('');

    try {
      const response = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: parsedSubmission.data.institution,
          rubricJson: parsedSubmission.data.rubric,
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
            Sample Questions (one per line)
          </label>
          <textarea
            value={sampleQuestions}
            onChange={(e) => setSampleQuestions(e.target.value)}
            rows={5}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-forest focus:border-transparent"
            placeholder="Solve for x: x² + 5x + 6 = 0&#10;Factorize: x² - 9&#10;Find the roots of: 2x² - 8x + 6 = 0"
            required
          />
        </div>

        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={handleGenerateRubric}
            disabled={isGenerating}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 font-semibold disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : '✨ Rubric/Mark Scheme'}
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rubric/Mark Scheme (JSON format — editable)
          </label>
          <textarea
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            rows={12}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-forest focus:border-transparent font-mono text-sm"
            placeholder='{"questions": [{"id": 1, "points": 10, "criteria": [...]}]}'
          />
          <p className="text-xs text-gray-500 mt-1">
            You can edit this manually after generation.
          </p>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
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
