import { env } from "../config/env";
import { LLMProvider } from "./llm.interface";
import { EmbeddingProvider } from "./embedding.interface";
import { BedrockLLMProvider } from "./bedrock/bedrockLlm";
import { BedrockEmbeddingProvider } from "./bedrock/bedrockEmbedding";
import { GeminiLLMProvider } from "./gemini/geminiLlm";
import { GeminiEmbeddingProvider } from "./gemini/geminiEmbedding";

/**
 * Provider factory. Every consumer depends on the LLMProvider/EmbeddingProvider
 * interfaces, not on a specific vendor — swapping providers is an env change
 * plus one class here, nothing else changes.
 */
function createLLMProvider(): LLMProvider {
  switch (env.llmProvider) {
    case "gemini":
      return new GeminiLLMProvider();
    case "bedrock":
    default:
      return new BedrockLLMProvider();
  }
}

function createEmbeddingProvider(): EmbeddingProvider {
  switch (env.embeddingProvider) {
    case "gemini":
      return new GeminiEmbeddingProvider();
    case "bedrock":
    default:
      return new BedrockEmbeddingProvider();
  }
}

export const llmProvider = createLLMProvider();
export const embeddingProvider = createEmbeddingProvider();
