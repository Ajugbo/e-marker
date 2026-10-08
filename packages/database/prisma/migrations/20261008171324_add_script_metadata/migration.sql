-- AlterTable
ALTER TABLE "scripts" ADD COLUMN     "course" TEXT,
ADD COLUMN     "examNumber" TEXT,
ADD COLUMN     "institution" TEXT,
ADD COLUMN     "term" TEXT,
ALTER COLUMN "studentName" DROP NOT NULL,
ALTER COLUMN "class" DROP NOT NULL;
