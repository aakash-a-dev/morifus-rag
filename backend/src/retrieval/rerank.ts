import { SimilarChunkRow } from "./vectorSearch";

/**
 * Lightweight score-based rerank: boosts chunks whose section heading or
 * document filename literally overlaps query terms, on top of the raw
 * cosine similarity score. No extra model call required.
 */
export function rerankChunks(query: string, chunks: SimilarChunkRow[]): (SimilarChunkRow & { rerankScore: number })[] {
  const queryTerms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 3);

  return chunks
    .map((chunk) => {
      const haystack = `${chunk.section ?? ""} ${chunk.filename}`.toLowerCase();
      const overlapBoost = queryTerms.some((t) => haystack.includes(t)) ? 0.05 : 0;
      return { ...chunk, rerankScore: chunk.similarity + overlapBoost };
    })
    .sort((a, b) => b.rerankScore - a.rerankScore);
}
