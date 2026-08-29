import { env } from "../config/env";
import { LLMProvider } from "./llm.interface";
import { EmbeddingProvider } from "./embedding.interface";
import { BedrockLLMProvider } from "./bedrock/bedrockLlm";
import { BedrockEmbeddingProvider } from "./bedrock/bedrockEmbedding";

/**
 * Provider factory. Bedrock is the only implementation shipped, but every
 * consumer depends on the LLMProvider/EmbeddingProvider interfaces, not on
 * Bedrock directly — adding Groq/Gemini/local later means adding a class
 * here, nothing else changes.
 */
function createLLMProvider(): LLMProvider {
  switch (env.llmProvider) {
    case "bedrock":
    default:
      return new BedrockLLMProvider();
  }
}

function createEmbeddingProvider(): EmbeddingProvider {
  switch (env.embeddingProvider) {
    case "bedrock":
    default:
      return new BedrockEmbeddingProvider();
  }
}

export const llmProvider = createLLMProvider();
export const embeddingProvider = createEmbeddingProvider();
