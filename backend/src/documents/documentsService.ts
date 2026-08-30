import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { redis } from "../cache/redisClient";
import { publishIngestJob } from "../queue/rabbitmq";

const SUPPORTED_MIME_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/markdown": ".md",
  "text/plain": ".txt",
};

export class UnsupportedUploadError extends Error {}

export interface IngestResult {
  document: Awaited<ReturnType<typeof prisma.document.create>>;
  deduped: boolean;
}

/**
 * Content-addressable dedup: Postgres (workspaceId, contentHash) is the
 * source of truth; a short-TTL Redis lock only guards the narrow race where
 * two near-simultaneous uploads of the same file both miss the Postgres
 * check before either has committed.
 */
export async function ingestUpload(
  file: { originalname: string; mimetype: string; buffer: Buffer },
  workspaceId: string
): Promise<IngestResult> {
  const ext = path.extname(file.originalname).toLowerCase();
  const knownExts = [".pdf", ".docx", ".md", ".txt"];
  if (!knownExts.includes(ext) && !SUPPORTED_MIME_EXT[file.mimetype]) {
    throw new UnsupportedUploadError(
      `Unsupported file type "${ext || file.mimetype}". Allowed: PDF, DOCX, MD, TXT.`
    );
  }

  const contentHash = crypto.createHash("sha256").update(file.buffer).digest("hex");

  const existing = await findReadyDuplicate(workspaceId, contentHash);
  if (existing) {
    return { document: existing, deduped: true };
  }

  const lockKey = `lock:upload:${workspaceId}:${contentHash}`;
  const acquired = await redis.set(lockKey, "1", "PX", 30000, "NX");

  if (!acquired) {
    // Someone else is (or just finished) ingesting the same content - give
    // them a moment to commit, then recheck Postgres rather than double-ingest.
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 300));
      const nowExisting = await findReadyDuplicate(workspaceId, contentHash);
      if (nowExisting) return { document: nowExisting, deduped: true };
    }
    // Lock holder never finished (crashed?) - fall through and ingest
    // ourselves rather than blocking the user forever.
  }

  try {
    await fs.mkdir(env.uploadDir, { recursive: true });
    const storedFilename = `${uuid()}${ext}`;
    const filePath = path.join(env.uploadDir, storedFilename);
    await fs.writeFile(filePath, file.buffer);

    const document = await prisma.document.create({
      data: {
        workspaceId,
        filename: file.originalname,
        mimeType: file.mimetype || "application/octet-stream",
        status: "processing",
        contentHash,
      },
    });

    await publishIngestJob({
      documentId: document.id,
      workspaceId,
      filePath,
      mimeType: file.mimetype,
      filename: file.originalname,
      attempt: 1,
    });

    return { document, deduped: false };
  } finally {
    if (acquired) await redis.del(lockKey);
  }
}

async function findReadyDuplicate(workspaceId: string, contentHash: string) {
  return prisma.document.findFirst({
    where: { workspaceId, contentHash, status: "ready" },
  });
}

export async function listDocuments(workspaceId: string) {
  return prisma.document.findMany({
    where: { workspaceId },
    orderBy: { uploadedAt: "desc" },
    include: { _count: { select: { chunks: true } } },
  });
}

export async function getDocument(id: string, workspaceId: string) {
  return prisma.document.findFirst({ where: { id, workspaceId } });
}

export async function deleteDocument(id: string, workspaceId: string) {
  const result = await prisma.document.deleteMany({ where: { id, workspaceId } });
  if (result.count === 0) {
    throw new Error("Document not found in this workspace");
  }
}
