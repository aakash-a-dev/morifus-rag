import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { EmbeddingProvider, EmbeddingResult } from "../embedding.interface";
import { bedrockClient } from "./client";

interface TitanEmbeddingResponse {
  embedding: number[];
  inputTextTokenCount: number;
}

export class BedrockEmbeddingProvider implements EmbeddingProvider {
  readonly name = "bedrock";
  readonly dimensions = env.bedrock.embeddingDimensions;
  private modelId = env.bedrock.embeddingModelId;

  async embed(texts: string[]): Promise<EmbeddingResult> {
    const vectors: number[][] = [];
    let tokensIn = 0;

    // Titan Embeddings V2 invokes one text at a time (no native batch API).
    for (const text of texts) {
      try {
        const command = new InvokeModelCommand({
          modelId: this.modelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify({
            inputText: text,
            dimensions: this.dimensions,
            normalize: true,
          }),
        });
        const response = await bedrockClient.send(command);
        const parsed: TitanEmbeddingResponse = JSON.parse(
          new TextDecoder().decode(response.body)
        );
        vectors.push(parsed.embedding);
        tokensIn += parsed.inputTextTokenCount ?? 0;
      } catch (err) {
        logger.error({ err, modelId: this.modelId }, "Bedrock embedding call failed");
        throw err;
      }
    }

    return { vectors, tokensIn, model: this.modelId, dimensions: this.dimensions };
  }
}
