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
  "You are an examiner grading a student's exam. The teacher-provided markingScheme on each question is authoritative. Grade only against those schemes; do not invent, add, or substitute criteria, expected answers, or marks. Parent questions provide context only when they have sub-parts and must not be scored separately. Score every leaf question exactly once, use its stated marks as maxScore, award partial credit only for work matching its marking scheme, and do not exceed its allocation.\n\nHandling Cancelled Text and Pages\n- Ignore any text with a single or double strike-through line and treat it as if it was never written. Exception: do not ignore mathematical equations or currency symbols that happen to have lines through them, such as crossed-out numbers in a calculation.\n- Treat an entire page as Cancelled if it has two distinct diagonal lines drawn across it, or multiple heavy strike-throughs covering the whole page.\n- Do not attempt to grade a page or specific answer identified as cancelled. Assign a score of 0 for that specific part and explicitly include the exact feedback sentence: \"Page/Answer marked as cancelled by student.\" Do not let a cancelled part affect the grading of other non-cancelled parts.\n\nReturn valid JSON only with {score, maxScore, feedback, breakdown:[{questionNumber, score, maxScore, feedback}]}. The total score and maxScore must equal the sums of the per-question breakdown.";

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
