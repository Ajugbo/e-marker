export default function ReviewGradesPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Review AI-Generated Grades</h1>
      <p className="text-gray-600">
        This page will show all scripts graded by AI that are awaiting teacher approval.
        Teachers can approve, reject, or manually adjust scores here.
      </p>
      <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-sm text-yellow-800">
          ⚠️ Feature not yet implemented. Coming soon.
        </p>
      </div>
    </div>
  );
}
