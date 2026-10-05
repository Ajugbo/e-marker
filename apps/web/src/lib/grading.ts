import { prisma } from "@exam-marker/database";
import { ApiError } from "@/lib/http";

export async function createMockGrade(scriptId: string, userId: string) {
  const script = await prisma.script.findFirst({
    where: { id: scriptId, exam: { creatorId: userId } },
    include: { exam: true, grade: true },
  });

  if (!script) throw new ApiError("Script not found", 404);
  if (script.grade) return script.grade;
  if (!script.extractedText) throw new ApiError("Process the script before grading", 400);

  let maximumScore = 100;
  try {
    const rubric = JSON.parse(script.exam.rubricJson) as { totalPoints?: unknown; maxScore?: unknown };
    const rubricMaximum = rubric.totalPoints ?? rubric.maxScore;
    if (typeof rubricMaximum === "number" && Number.isFinite(rubricMaximum) && rubricMaximum > 0) {
      maximumScore = rubricMaximum;
    }
  } catch {
    throw new ApiError("The exam rubric is not valid JSON", 400);
  }

  const score = Math.round(maximumScore * 0.82 * 100) / 100;
  const questionScores = JSON.stringify([
    { question: "Overall response", score, maxScore: maximumScore },
  ]);
  const feedback = "Demo feedback: the response addresses the prompt. Review this mock score before sharing it with a student.";

  return prisma.$transaction(async (transaction) => {
    const existingGrade = await transaction.grade.findUnique({ where: { scriptId } });
    if (existingGrade) return existingGrade;

    const balance = await transaction.user.updateMany({
      where: { id: userId, credits: { gte: 1 } },
      data: { credits: { decrement: 1 } },
    });
    if (balance.count === 0) throw new ApiError("Insufficient credits to grade this script", 400);

    await transaction.creditTransaction.create({
      data: {
        userId,
        amount: -1,
        type: "deduction",
        description: `Mock grading for ${script.studentName}`,
      },
    });
    const grade = await transaction.grade.create({
      data: {
        scriptId,
        questionScores,
        totalScore: score,
        aiConfidence: 0.5,
        feedback,
      },
    });
    await transaction.exam.update({
      where: { id: script.examId },
      data: { totalCreditsDeducted: { increment: 1 } },
    });
    await transaction.script.update({ where: { id: scriptId }, data: { status: "graded" } });
    return grade;
  });
}