import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { EmbeddingProvider, EmbeddingResult } from "../embedding.interface";

interface GeminiEmbedContentResponse {
  embedding: { values: number[] };
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = "gemini";
  readonly dimensions = env.gemini.embeddingDimensions;
  private modelId = env.gemini.embeddingModel;
  private apiKey = env.gemini.apiKey;

  async embed(texts: string[]): Promise<EmbeddingResult> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is required when EMBEDDING_PROVIDER=gemini");
    }

    const vectors: number[][] = [];

    // Gemini's embedContent endpoint takes one input per call.
    for (const text of texts) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:embedContent?key=${this.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: `models/${this.modelId}`,
              content: { parts: [{ text }] },
              outputDimensionality: this.dimensions,
            }),
          }
        );
        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Gemini embedContent failed: ${response.status} ${errBody}`);
        }
        const parsed = (await response.json()) as GeminiEmbedContentResponse;
        vectors.push(parsed.embedding.values);
      } catch (err) {
        logger.error({ err, modelId: this.modelId }, "Gemini embedding call failed");
        throw err;
      }
    }

    return { vectors, tokensIn: 0, model: this.modelId, dimensions: this.dimensions };
  }
}
