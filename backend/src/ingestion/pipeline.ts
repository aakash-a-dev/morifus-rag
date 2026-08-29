import { prisma } from "../db/prisma";
import { logger } from "../config/logger";
import { env } from "../config/env";
import { embeddingProvider } from "../providers";
import { withTelemetry } from "../telemetry";
import { acquireBedrockSlot } from "../cache/rateLimiter";
import { publishProgress } from "../cache/progressPubSub";
import { setChunkEmbedding } from "../retrieval/vectorSearch";
import { parseFile, CorruptedFileError, UnsupportedFileTypeError } from "./parsers";
import { chunkDocument } from "./chunker";
import { enrichChunk } from "./contextualEnrichment";
import { IngestJobPayload } from "../queue/rabbitmq";

export async function runIngestionPipeline(job: IngestJobPayload): Promise<void> {
  const { documentId, filePath, mimeType, filename } = job;

  try {
    await publishProgress({ documentId, stage: "parsing", progress: 10 });
    const parsed = await parseFile(filePath, mimeType, filename);

    await publishProgress({ documentId, stage: "chunking", progress: 30 });
    const chunks = chunkDocument(parsed.pages);

    if (chunks.length === 0) {
      throw new CorruptedFileError("No extractable text content found in document");
    }

    let contents = chunks.map((c) => c.content);

    if (env.contextualEnrichment) {
      await publishProgress({ documentId, stage: "enriching", progress: 45 });
      contents = await Promise.all(
        chunks.map((chunk) => enrichChunk(chunk, parsed.fullText, filename))
      );
    }

    await publishProgress({ documentId, stage: "embedding", progress: 60 });
    await acquireBedrockSlot();
    const { vectors } = await withTelemetry("embed", embeddingProvider.name, async () => {
      const result = await embeddingProvider.embed(contents);
      return { ...result, tokensOut: 0 };
    });

    await publishProgress({ documentId, stage: "storing", progress: 85 });

    let failedChunks = 0;
    for (let i = 0; i < chunks.length; i++) {
      try {
        const created = await prisma.chunk.create({
          data: {
            documentId,
            content: chunks[i].content,
            contextualizedContent: env.contextualEnrichment ? contents[i] : null,
            page: chunks[i].page,
            section: chunks[i].section,
            chunkIndex: chunks[i].chunkIndex,
          },
        });
        await setChunkEmbedding(created.id, vectors[i]);
      } catch (err) {
        failedChunks++;
        logger.error({ err, documentId, chunkIndex: chunks[i].chunkIndex }, "Failed to store chunk");
      }
    }

    if (failedChunks === chunks.length) {
      throw new Error("All chunks failed to store");
    }

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "ready",
        metadata: {
          totalChunks: chunks.length,
          failedChunks,
          pageCount: parsed.pages.length,
        },
      },
    });

    await publishProgress({ documentId, stage: "ready", progress: 100 });
  } catch (err) {
    const reason =
      err instanceof UnsupportedFileTypeError || err instanceof CorruptedFileError
        ? err.message
        : `Ingestion failed: ${(err as Error).message}`;

    logger.error({ err, documentId }, "Ingestion pipeline error");
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "error", errorReason: reason },
    });
    await publishProgress({ documentId, stage: "error", progress: 100, message: reason });
    throw err;
  }
}
