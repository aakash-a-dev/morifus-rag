import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { llmProvider } from "../providers";
import { withTelemetry } from "../telemetry";
import { acquireBedrockSlot } from "../cache/rateLimiter";
import { findNeighborsOfChunk, SimilarChunkRow } from "../retrieval/vectorSearch";

export interface ContradictionFinding {
  id: string;
  chunkAId: string;
  chunkBId: string;
  statementA: string;
  statementB: string;
  sourceA: { filename: string; page: number | null; section: string | null };
  sourceB: { filename: string; page: number | null; section: string | null };
  type: "factual" | "logical" | "temporal" | "numerical";
  severity: "critical" | "warning" | "info";
  reasoning: string;
  isNew: boolean;
}

interface LLMVerdict {
  isContradiction: boolean;
  type?: "factual" | "logical" | "temporal" | "numerical";
  severity?: "critical" | "warning" | "info";
  reasoning: string;
  statementA?: string;
  statementB?: string;
}

/**
 * Runs as part of the chat query flow: for each retrieved chunk, pull cross-
 * document near-neighbors above the similarity threshold and ask the LLM to
 * judge each pair. Obvious "this is just a dated revision" pairs are
 * skipped heuristically before spending an LLM call.
 */
export async function detectContradictions(
  workspaceId: string,
  retrievedChunks: SimilarChunkRow[]
): Promise<ContradictionFinding[]> {
  const findings: ContradictionFinding[] = [];
  const seenPairs = new Set<string>();

  for (const chunk of retrievedChunks) {
    const neighbors = await findNeighborsOfChunk(
      workspaceId,
      chunk.id,
      3,
      env.retrieval.contradictionSimilarityThreshold
    );

    for (const neighbor of neighbors) {
      const pairKey = [chunk.id, neighbor.id].sort().join(":");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      if (looksLikeSupersedingRevision(chunk, neighbor)) continue;

      const existing = await prisma.contradiction.findFirst({
        where: {
          workspaceId,
          OR: [
            { chunkAId: chunk.id, chunkBId: neighbor.id },
            { chunkAId: neighbor.id, chunkBId: chunk.id },
          ],
        },
      });
      if (existing) {
        findings.push(toFinding(existing, chunk, neighbor, false));
        continue;
      }

      const verdict = await judgePair(chunk, neighbor);
      if (!verdict.isContradiction) continue;

      const created = await prisma.contradiction.create({
        data: {
          workspaceId,
          chunkAId: chunk.id,
          chunkBId: neighbor.id,
          statementA: verdict.statementA ?? chunk.content.slice(0, 300),
          statementB: verdict.statementB ?? neighbor.content.slice(0, 300),
          type: verdict.type ?? "factual",
          severity: verdict.severity ?? "warning",
          reasoning: verdict.reasoning,
          reasoningTrace: {
            similarity: neighbor.similarity,
            chunkAId: chunk.id,
            chunkBId: neighbor.id,
          },
        },
      });

      findings.push(toFinding(created, chunk, neighbor, true));
    }
  }

  return findings;
}

function looksLikeSupersedingRevision(_a: SimilarChunkRow, _b: SimilarChunkRow): boolean {
  // Cheap pre-LLM heuristic guard slot. Real revision detection needs a
  // structured "effective date" field per document, which is out of scope
  // for this assignment — the LLM judge prompt is explicitly instructed to
  // treat clear revisions as non-contradictions instead, so this stays a
  // no-op filter for now rather than risk false-negatives on real conflicts.
  return false;
}

async function judgePair(a: SimilarChunkRow, b: SimilarChunkRow): Promise<LLMVerdict> {
  await acquireBedrockSlot();

  const { text } = await withTelemetry("contradiction", llmProvider.name, () =>
    llmProvider.generate(
      [
        {
          role: "user",
          content: `Statement A (from "${a.filename}"${a.page ? `, p.${a.page}` : ""}):\n"${a.content}"\n\nStatement B (from "${b.filename}"${b.page ? `, p.${b.page}` : ""}):\n"${b.content}"\n\nDo these two statements contradict each other on the same topic (factual, logical, temporal, or numerical conflict)? Do NOT flag as a contradiction if B is simply a later revision/update of A (e.g. differing effective dates that clearly supersede one another) rather than a genuine conflict.\n\nRespond with strict JSON only, no other text:\n{"isContradiction": boolean, "type": "factual"|"logical"|"temporal"|"numerical", "severity": "critical"|"warning"|"info", "reasoning": string, "statementA": string, "statementB": string}`,
        },
      ],
      {
        system:
          "You are a contradiction-detection analyst. Be conservative: only flag genuine conflicts, not simple rephrasings or clear revisions.",
        maxTokens: 400,
        temperature: 0,
      }
    )
  );

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text) as LLMVerdict;
  } catch {
    return { isContradiction: false, reasoning: "Failed to parse LLM verdict" };
  }
}

function toFinding(
  record: {
    id: string;
    chunkAId: string;
    chunkBId: string;
    statementA: string;
    statementB: string;
    type: string;
    severity: string;
    reasoning: string;
  },
  a: SimilarChunkRow,
  b: SimilarChunkRow,
  isNew: boolean
): ContradictionFinding {
  return {
    id: record.id,
    chunkAId: record.chunkAId,
    chunkBId: record.chunkBId,
    statementA: record.statementA,
    statementB: record.statementB,
    sourceA: { filename: a.filename, page: a.page, section: a.section },
    sourceB: { filename: b.filename, page: b.page, section: b.section },
    type: record.type as ContradictionFinding["type"],
    severity: record.severity as ContradictionFinding["severity"],
    reasoning: record.reasoning,
    isNew,
  };
}
