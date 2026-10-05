import { NextResponse } from "next/server";
import { prisma } from "@exam-marker/database";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createExamSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  rubricJson: z.string().min(2, "rubricJson is required").refine((value) => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }, "rubricJson must contain valid JSON"),
});

export async function GET() {
  try {
    const exams = await prisma.exam.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        rubricJson: true,
      },
    });
    return NextResponse.json({ exams });
  } catch (error) {
    console.error("[api:exams/get] Failed to fetch exams", error);
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      console.error("[api:exams/post] Invalid JSON request body", error);
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const parsed = createExamSchema.safeParse(body);
    if (!parsed.success) {
      console.error("[api:exams/post] Request validation failed", parsed.error.issues);
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 },
      );
    }

    const testUserId = "test-user-id";
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        email: "test-user@example.com",
        name: "Test User",
      },
    });

    const exam = await prisma.exam.create({
      data: {
        title: parsed.data.title,
        rubricJson: parsed.data.rubricJson,
        creatorId: testUserId,
      },
    });

    return NextResponse.json(
      { message: "Exam created successfully", examId: exam.id },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api:exams/post] Failed to create exam", error);
    return NextResponse.json(
      { error: "Failed to create exam" },
      { status: 500 },
    );
  }
}
