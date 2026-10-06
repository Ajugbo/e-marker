import { unlink } from "node:fs/promises";
import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/http";
import { processUploadedScript, saveUpload } from "@/lib/scripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maximumUploadBytes = 100 * 1024 * 1024;

function isFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function requiredText(formData: FormData, field: string) {
  const value = formData.get(field);
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(`${field} is required`);
  }
  return value.trim();
}

const uploadSchema = z.object({
  examId: z.string().uuid().optional(),
  studentName: z.string().trim().min(1).max(160),
  matricNumber: z.string().trim().min(1).max(80),
  class: z.string().trim().min(1).max(80),
  file: z.custom<File>(isFile, "file is required"),
}).refine(
  ({ file }) => file.size > 0 && file.size <= maximumUploadBytes,
  { path: ["file"], message: "file must be non-empty and no larger than 100 MB" },
);

export async function POST(request: NextRequest) {
  let savedPath: string | undefined;
  try {
    const user = await getRequestUser(request);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new ApiError("Upload must use multipart form data");
    }

    const rawExamId = formData.get("examId");
    if (rawExamId !== null && typeof rawExamId !== "string") {
      throw new ApiError("examId must be text");
    }
    const examId = rawExamId?.trim() || undefined;

    const parsed = uploadSchema.safeParse({
      examId,
      studentName: requiredText(formData, "studentName"),
      matricNumber: requiredText(formData, "matricNumber"),
      class: requiredText(formData, "class"),
      file: formData.get("file"),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path[0];
      throw new ApiError(
        field ? `${String(field)}: ${issue.message}` : issue?.message ?? "Invalid upload details",
      );
    }

    if (!user && !parsed.data.examId) {
      throw new ApiError("examId is required for unauthenticated uploads");
    }

    const exam = parsed.data.examId
      ? await prisma.exam.findFirst({
          where: { id: parsed.data.examId, ...(user ? { creatorId: user.id } : {}) },
        })
      : user
        ? await prisma.exam.findFirst({
            where: { creatorId: user.id },
            orderBy: { createdAt: "desc" },
          })
        : null;
    if (!exam) throw new ApiError("Create an exam before uploading a script", 400);

    savedPath = await saveUpload(parsed.data.file);
    const isVideo = parsed.data.file.type.startsWith("video/");
    const script = await prisma.script.create({
      data: {
        examId: exam.id,
        studentName: parsed.data.studentName,
        matricNumber: parsed.data.matricNumber,
        class: parsed.data.class,
        totalPages: 1,
        status: "pending",
        videoUri: isVideo ? savedPath : null,
        rawImages: isVideo ? null : JSON.stringify([savedPath]),
      },
    });

    void processUploadedScript(script.id, exam.creatorId);
    return NextResponse.json({ id: script.id, status: script.status }, { status: 201 });
  } catch (error) {
    if (savedPath) await unlink(savedPath).catch(() => undefined);
    return errorResponse(error, "scripts/upload");
  }
}