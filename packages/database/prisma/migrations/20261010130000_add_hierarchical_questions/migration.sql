CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "parentQuestionId" TEXT,
    "questionNumber" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "markingScheme" TEXT NOT NULL,
    "marks" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "questions_examId_questionNumber_key" ON "questions"("examId", "questionNumber");
CREATE INDEX "questions_parentQuestionId_sortOrder_idx" ON "questions"("parentQuestionId", "sortOrder");

ALTER TABLE "questions" ADD CONSTRAINT "questions_examId_fkey"
    FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "questions" ADD CONSTRAINT "questions_parentQuestionId_fkey"
    FOREIGN KEY ("parentQuestionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
