import { llmProvider } from "../providers";
import { withTelemetry } from "../telemetry";
import { acquireBedrockSlot } from "../cache/rateLimiter";
import { Chunk } from "./chunker";

/**
 * "Contextual retrieval" (Anthropic pattern): ask the LLM for a short
 * sentence situating this chunk within the whole document, and prepend it
 * to the chunk before embedding, so retrieval still works when a chunk
 * reads ambiguously on its own (e.g. "The fee is $50" with no subject).
 */
export async function enrichChunk(chunk: Chunk, documentFullText: string, filename: string): Promise<string> {
  await acquireBedrockSlot();

  const truncatedDoc = documentFullText.slice(0, 6000);
  const { text } = await withTelemetry("generate", llmProvider.name, () =>
    llmProvider.generate(
      [
        {
          role: "user",
          content: `<document filename="${filename}">\n${truncatedDoc}\n</document>\n<chunk>\n${chunk.content}\n</chunk>\n\nGive a short (1-2 sentence) context statement situating this chunk within the overall document, so it can be understood in isolation. Answer with only the context statement, nothing else.`,
        },
      ],
      { maxTokens: 100, temperature: 0 }
    )
  );

  return `${text.trim()}\n\n${chunk.content}`;
}
