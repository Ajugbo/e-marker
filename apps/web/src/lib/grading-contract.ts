import { z } from "zod";
import { ApiError } from "@/lib/http";
import { scoreableQuestions, type ExamQuestion } from "@/lib/exam-questions";

export const aiGradeSchema = z.object({
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().positive(),
  feedback: z.string().trim().min(1).max(5000),
  breakdown: z.array(z.object({
    questionNumber: z.string().trim().min(1),
    score: z.number().int().nonnegative(),
    maxScore: z.number().int().positive(),
    feedback: z.string().trim().max(5000),
  }).strict()),
}).strict();

export const gradingInstructions =
  "You are an examiner grading a student's exam. The teacher-provided markingScheme on each question is authoritative. Grade only against those schemes; do not invent, add, or substitute criteria, expected answers, or marks. Parent questions provide context only when they have sub-parts and must not be scored separately. Score every leaf question exactly once, use its stated marks as maxScore, award partial credit only for work matching its marking scheme, and do not exceed its allocation. Return valid JSON only with {score, maxScore, feedback, breakdown:[{questionNumber, score, maxScore, feedback}]}. The total score and maxScore must equal the sums of the per-question breakdown.";

export function validateAiGrade(value: unknown, questions: ExamQuestion[]) {
  const result = aiGradeSchema.safeParse(value);
  if (!result.success) {
    throw new ApiError("The grading service returned an invalid grading response", 502);
  }

  const leaves = scoreableQuestions(questions);
  const expectedMaximum = leaves.reduce((total, question) => total + question.marks, 0);
  const receivedByNumber = new Map(result.data.breakdown.map((item) => [item.questionNumber, item]));
  if (
    leaves.length !== result.data.breakdown.length
    || receivedByNumber.size !== result.data.breakdown.length
    || result.data.maxScore !== expectedMaximum
    || result.data.score !== result.data.breakdown.reduce((total, item) => total + item.score, 0)
    || result.data.maxScore !== result.data.breakdown.reduce((total, item) => total + item.maxScore, 0)
    || leaves.some((question) => {
      const grade = receivedByNumber.get(question.questionNumber);
      return !grade
        || grade.maxScore !== question.marks
        || grade.score > question.marks;
    })
  ) {
    throw new ApiError("The grading service returned scores that do not match the teacher's question mark allocations", 502);
  }

  return {
    ...result.data,
    breakdown: leaves.map((question) => {
      const grade = receivedByNumber.get(question.questionNumber);
      if (!grade) throw new ApiError("The grading service omitted a question score", 502);
      return { ...grade, criterion: question.questionNumber };
    }),
  };
}
