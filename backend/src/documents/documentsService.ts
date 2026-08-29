import fs from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { publishIngestJob } from "../queue/rabbitmq";

const SUPPORTED_MIME_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/markdown": ".md",
  "text/plain": ".txt",
};

export class UnsupportedUploadError extends Error {}

export async function ingestUpload(file: {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}) {
  const ext = path.extname(file.originalname).toLowerCase();
  const knownExts = [".pdf", ".docx", ".md", ".txt"];
  if (!knownExts.includes(ext) && !SUPPORTED_MIME_EXT[file.mimetype]) {
    throw new UnsupportedUploadError(
      `Unsupported file type "${ext || file.mimetype}". Allowed: PDF, DOCX, MD, TXT.`
    );
  }

  await fs.mkdir(env.uploadDir, { recursive: true });
  const storedFilename = `${uuid()}${ext}`;
  const filePath = path.join(env.uploadDir, storedFilename);
  await fs.writeFile(filePath, file.buffer);

  const document = await prisma.document.create({
    data: {
      filename: file.originalname,
      mimeType: file.mimetype || "application/octet-stream",
      status: "processing",
    },
  });

  await publishIngestJob({
    documentId: document.id,
    filePath,
    mimeType: file.mimetype,
    filename: file.originalname,
    attempt: 1,
  });

  return document;
}

export async function listDocuments() {
  return prisma.document.findMany({
    orderBy: { uploadedAt: "desc" },
    include: { _count: { select: { chunks: true } } },
  });
}

export async function getDocument(id: string) {
  return prisma.document.findUnique({ where: { id } });
}

export async function deleteDocument(id: string) {
  return prisma.document.delete({ where: { id } });
}
