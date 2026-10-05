import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { prisma } from "@exam-marker/database";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/http";
import { processAndGradeScript, saveUpload } from "@/lib/scripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maximumUploadBytes = 100 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
]);

function isFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

const uploadSchema = z.object({
  examId: z.union([z.string().uuid(), z.literal("")]).optional(),
  studentName: z.string().trim().min(1).max(160),
  matricNumber: z.string().trim().min(1).max(80),
  class: z.string().trim().min(1).max(80),
  file: z.custom<File>(isFile, "A file is required"),
}).refine(
  ({ file }) => file.size > 0 && file.size <= maximumUploadBytes && allowedMimeTypes.has(file.type),
  { path: ["file"], message: "Upload a non-empty image, PDF, or MP4/MOV video under 100 MB" },
);

export async function POST(request: NextRequest) {
  let savedPath: string | undefined;
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new ApiError("Upload must use multipart form data");
    }

    const parsed = uploadSchema.safeParse({
      examId: formData.get("examId") ?? undefined,
      studentName: formData.get("studentName"),
      matricNumber: formData.get("matricNumber"),
      class: formData.get("class"),
      file: formData.get("file"),
    });
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message ?? "Invalid upload details");
    }

    const exam = parsed.data.examId
      ? await prisma.exam.findFirst({ where: { id: parsed.data.examId, creatorId: user.id } })
      : await prisma.exam.findFirst({ where: { creatorId: user.id }, orderBy: { createdAt: "desc" } });
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

    void processAndGradeScript(script.id, user.id);
    return NextResponse.json({ id: script.id, status: script.status }, { status: 201 });
  } catch (error) {
    if (savedPath) await unlink(savedPath).catch(() => undefined);
    return errorResponse(error, "scripts/upload");
  }
}