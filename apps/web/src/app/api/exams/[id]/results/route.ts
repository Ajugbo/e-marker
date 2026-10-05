import { prisma } from "@exam-marker/database";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const examIdSchema = z.string().uuid();

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const parsedId = examIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid exam ID" }, { status: 400 });
  }

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: parsedId.data },
      select: { id: true, title: true, createdAt: true },
    });
    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const scripts = await prisma.script.findMany({
      where: { examId: parsedId.data },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        studentName: true,
        matricNumber: true,
        class: true,
        status: true,
        grade: { select: { totalScore: true } },
      },
    });

    const submissions = scripts.map(({ grade, ...script }) => ({
      ...script,
      score: grade?.totalScore ?? null,
    }));

    return NextResponse.json({ exam, submissions });
  } catch (error) {
    console.error("[api:exam-results/get] Failed to fetch exam results", error);
    return NextResponse.json(
      { error: "Failed to fetch exam results" },
      { status: 500 },
    );
  }
}