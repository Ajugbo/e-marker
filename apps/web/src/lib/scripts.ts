import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { prisma } from "@exam-marker/database";
import { ApiError } from "@/lib/http";

const uploadDirectory = join(tmpdir(), "exam-marker-uploads");

export async function saveUpload(file: File) {
  const extension = extname(file.name).toLowerCase().slice(0, 12);
  await mkdir(uploadDirectory, { recursive: true });
  const path = join(uploadDirectory, `${randomUUID()}${extension}`);
  await writeFile(path, Buffer.from(await file.arrayBuffer()));
  return path;
}

function storedPaths(script: { videoUri: string | null; rawImages: string | null }) {
  if (script.videoUri) return [script.videoUri];
  if (!script.rawImages) return [];
  try {
    const paths: unknown = JSON.parse(script.rawImages);
    return Array.isArray(paths) ? paths.filter((path): path is string => typeof path === "string") : [];
  } catch {
    return [];
  }
}

function isUploadPath(path: string) {
  const directory = resolve(uploadDirectory) + sep;
  return resolve(path).startsWith(directory);
}

export async function processScriptFile(scriptId: string, userId: string) {
  const script = await prisma.script.findFirst({
    where: { id: scriptId, exam: { creatorId: userId } },
  });
  if (!script) throw new ApiError("Script not found", 404);
  if (script.extractedText && ["processed", "graded"].includes(script.status)) return script;

  const lock = await prisma.script.updateMany({
    where: { id: scriptId, status: { not: "processing" } },
    data: { status: "processing" },
  });
  if (lock.count === 0) return prisma.script.findUniqueOrThrow({ where: { id: scriptId } });

  const paths = storedPaths(script).filter(isUploadPath);
  try {
    let extractedText: string;
    let needsReview = false;
    const imagePath = paths.find((path) => /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(path));
    if (imagePath) {
      const { recognize } = await import("tesseract.js");
      const result = await recognize(imagePath, "eng");
      extractedText = result.data.text.trim() || "No readable text was detected in this image.";
      needsReview = !result.data.text.trim() || result.data.confidence < 60;
    } else if (paths.length > 0) {
      extractedText = "Upload received. OCR for video and PDF files is mocked in this demo; frame extraction is not configured.";
      needsReview = true;
    } else {
      throw new ApiError("The uploaded file is no longer available. Please upload it again.", 400);
    }

    const updated = await prisma.script.update({
      where: { id: scriptId },
      data: {
        extractedText,
        status: "processed",
        reviewStatus: needsReview ? "AWAITING_REVIEW" : undefined,
        videoUri: null,
        rawImages: null,
      },
    });
    await Promise.all(paths.map((path) => unlink(path).catch(() => undefined)));
    return updated;
  } catch (error) {
    await prisma.script.update({ where: { id: scriptId }, data: { status: "failed" } });
    throw error;
  }
}

export async function processUploadedScript(scriptId: string, userId: string) {
  try {
    await processScriptFile(scriptId, userId);
  } catch (error) {
    console.error(`[script-pipeline:${scriptId}]`, error);
    await prisma.script.updateMany({
      where: { id: scriptId, status: { notIn: ["graded", "grading"] } },
      data: { status: "failed" },
    });
  }
}