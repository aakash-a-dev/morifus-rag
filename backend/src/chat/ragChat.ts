import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { embeddingProvider, llmProvider } from "../providers";
import { withTelemetry } from "../telemetry";
import { acquireBedrockSlot } from "../cache/rateLimiter";
import { getCachedAnswer, setCachedAnswer } from "../cache/queryCache";
import { findSimilarChunks, SimilarChunkRow } from "../retrieval/vectorSearch";
import { rerankChunks } from "../retrieval/rerank";
import { detectContradictions, ContradictionFinding } from "../contradiction/detectContradictions";
import { Citation } from "./ragChat.types";

export type { Citation };

export interface ChatAnswer {
  answer: string;
  citations: Citation[];
  confidence: number;
  lowContext: boolean;
  fromCache: boolean;
  contradictions: ContradictionFinding[];
  trace: {
    retrievedChunks: { chunkId: string; filename: string; similarity: number; rerankScore: number }[];
  };
}

export async function answerQuery(
  workspaceId: string,
  conversationId: string,
  query: string,
  documentIds: string[] = []
): Promise<ChatAnswer> {
  const cached = await getCachedAnswer(workspaceId, query, documentIds);
  if (cached) {
    await persistMessage(conversationId, query, cached.answer, [], cached.confidence, true);
    return { ...cached, fromCache: true, contradictions: [], trace: { retrievedChunks: [] } };
  }

  await acquireBedrockSlot();
  const { vectors } = await withTelemetry("embed", embeddingProvider.name, async () => {
    const result = await embeddingProvider.embed([query]);
    return { ...result, tokensOut: 0 };
  });

  const similar = await findSimilarChunks(workspaceId, vectors[0], env.retrieval.topK);
  const reranked = rerankChunks(query, similar);

  const topScore = reranked[0]?.similarity ?? 0;
  const lowContext = topScore < env.retrieval.confidenceThreshold;

  const contextBlock = reranked
    .map(
      (c, i) =>
        `[${i + 1}] (source: ${c.filename}${c.page ? `, p.${c.page}` : ""}${c.section ? `, ${c.section}` : ""})\n${c.content}`
    )
    .join("\n\n");

  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  await acquireBedrockSlot();
  const { text } = await withTelemetry("generate", llmProvider.name, () =>
    llmProvider.generate(
      [
        ...history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        {
          role: "user",
          content: `Answer the question using ONLY the context below. Cite sources inline using [1], [2] etc. matching the numbered context blocks. If the context does not contain the answer, say so plainly.\n\nContext:\n${contextBlock}\n\nQuestion: ${query}`,
        },
      ],
      {
        system:
          "You are a precise document-intelligence assistant. Ground every claim in the provided context and cite sources. Never fabricate information not present in the context. Format your response as clean Markdown: put a blank line before and after every heading and every list, use '- ' for bullet items, and never place a bullet or heading directly after a line of text without a blank line in between.",
        maxTokens: 800,
        temperature: 0.1,
      }
    )
  );

  const citations: Citation[] = reranked.map((c) => ({
    chunkId: c.id,
    documentId: c.documentId,
    filename: c.filename,
    page: c.page,
    section: c.section,
    similarity: c.similarity,
    excerpt: c.content.slice(0, 240),
  }));

  const finalAnswer = lowContext
    ? `⚠️ Limited relevant context found in your documents for this question.\n\n${text}`
    : text;

  const contradictions = await detectContradictions(workspaceId, reranked);

  await persistMessage(conversationId, query, finalAnswer, citations.map((c) => c.chunkId), topScore, false);
  await setCachedAnswer(workspaceId, query, documentIds, {
    answer: finalAnswer,
    citations,
    confidence: topScore,
    lowContext,
  });

  return {
    answer: finalAnswer,
    citations,
    confidence: topScore,
    lowContext,
    fromCache: false,
    contradictions,
    trace: {
      retrievedChunks: reranked.map((c) => ({
        chunkId: c.id,
        filename: c.filename,
        similarity: c.similarity,
        rerankScore: c.rerankScore,
      })),
    },
  };
}

async function persistMessage(
  conversationId: string,
  query: string,
  answer: string,
  citedChunkIds: string[],
  confidence: number,
  fromCache: boolean
) {
  await prisma.message.create({
    data: { conversationId, role: "user", content: query },
  });
  await prisma.message.create({
    data: {
      conversationId,
      role: "assistant",
      content: answer,
      citedChunkIds,
      confidence,
      fromCache,
    },
  });
}

export type { SimilarChunkRow };
