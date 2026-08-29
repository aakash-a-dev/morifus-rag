import { prisma } from "../db/prisma";

/**
 * All raw pgvector SQL is isolated to this file. Prisma Client cannot type
 * or bind the `vector` column, so inserts/updates and similarity search go
 * through $executeRawUnsafe/$queryRaw with a manually-formatted literal.
 */

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function setChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "chunks" SET "embedding" = $1::vector WHERE "id" = $2`,
    toVectorLiteral(embedding),
    chunkId
  );
}

export interface SimilarChunkRow {
  id: string;
  documentId: string;
  content: string;
  contextualizedContent: string | null;
  page: number | null;
  section: string | null;
  chunkIndex: number;
  createdAt: Date;
  filename: string;
  similarity: number; // cosine similarity, 1 = identical, 0 = orthogonal
}

export async function findSimilarChunks(
  embedding: number[],
  topK: number,
  excludeChunkIds: string[] = []
): Promise<SimilarChunkRow[]> {
  const vectorLiteral = toVectorLiteral(embedding);
  const exclusionClause = excludeChunkIds.length
    ? `AND c."id" NOT IN (${excludeChunkIds.map((_, i) => `$${i + 3}`).join(",")})`
    : "";

  const rows = await prisma.$queryRawUnsafe<SimilarChunkRow[]>(
    `SELECT c."id", c."documentId", c."content", c."contextualizedContent", c."page",
            c."section", c."chunkIndex", c."createdAt", d."filename",
            1 - (c."embedding" <=> $1::vector) AS similarity
     FROM "chunks" c
     JOIN "documents" d ON d."id" = c."documentId"
     WHERE c."embedding" IS NOT NULL ${exclusionClause}
     ORDER BY c."embedding" <=> $1::vector
     LIMIT $2`,
    vectorLiteral,
    topK,
    ...excludeChunkIds
  );

  return rows;
}

/** Fetch near-neighbors of a specific chunk (used by contradiction detection). */
export async function findNeighborsOfChunk(
  chunkId: string,
  topK: number,
  minSimilarity: number
): Promise<SimilarChunkRow[]> {
  const rows = await prisma.$queryRawUnsafe<SimilarChunkRow[]>(
    `SELECT c."id", c."documentId", c."content", c."contextualizedContent", c."page",
            c."section", c."chunkIndex", c."createdAt", d."filename",
            1 - (c."embedding" <=> target."embedding") AS similarity
     FROM "chunks" c
     JOIN "documents" d ON d."id" = c."documentId"
     JOIN "chunks" target ON target."id" = $1
     WHERE c."embedding" IS NOT NULL
       AND c."id" != $1
       AND c."documentId" != target."documentId"
       AND 1 - (c."embedding" <=> target."embedding") >= $2
     ORDER BY c."embedding" <=> target."embedding"
     LIMIT $3`,
    chunkId,
    minSimilarity,
    topK
  );

  return rows;
}
