'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Exam {
  id: string;
  title: string;
  createdAt: string;
  rubricJson: string;
}

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const response = await fetch('/api/exams');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Check if data.exams exists and is an array
        if (data.exams && Array.isArray(data.exams)) {
          setExams(data.exams);
        } else {
          console.error('Unexpected API response:', data);
          setError('Received invalid data format from server.');
        }
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(err.message || 'Failed to load exams. Is the server running?');
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Loading exams...</div>;
  
  if (error) {
    return (
      <div className="p-8">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Your Exams</h1>
        <Link 
          href="/exams/new" 
          className="px-4 py-2 bg-forest text-white rounded-md hover:bg-[#17483c] transition-colors shadow-sm"
        >
          + Create New Exam
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 text-lg">No exams created yet.</p>
          <p className="text-gray-400 text-sm mt-2">Click "Create New Exam" to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {exams.map((exam) => (
            <div key={exam.id} className="p-5 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">{exam.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Created: {new Date(exam.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">
                  ID: {exam.id.slice(0, 8)}...
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 truncate">
                  Rubric Preview: {exam.rubricJson.substring(0, 100)}...
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
