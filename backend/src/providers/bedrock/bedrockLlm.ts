import {
  ConverseCommand,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { LLMGenerateOptions, LLMGenerateResult, LLMMessage, LLMProvider } from "../llm.interface";
import { bedrockClient } from "./client";

export class BedrockLLMProvider implements LLMProvider {
  readonly name = "bedrock";
  private modelId = env.bedrock.llmModelId;

  async generate(messages: LLMMessage[], opts: LLMGenerateOptions = {}): Promise<LLMGenerateResult> {
    const system = opts.system
      ? [{ text: opts.system }]
      : messages.find((m) => m.role === "system")
      ? [{ text: messages.find((m) => m.role === "system")!.content }]
      : undefined;

    const converseMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: [{ text: m.content }],
      }));

    const inferenceConfig = {
      maxTokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.2,
    };

    try {
      if (opts.onToken) {
        const command = new ConverseStreamCommand({
          modelId: this.modelId,
          system,
          messages: converseMessages,
          inferenceConfig,
        });
        const response = await bedrockClient.send(command);
        let fullText = "";
        let tokensIn = 0;
        let tokensOut = 0;

        for await (const event of response.stream ?? []) {
          if (event.contentBlockDelta?.delta?.text) {
            const delta = event.contentBlockDelta.delta.text;
            fullText += delta;
            opts.onToken(delta);
          }
          if (event.metadata?.usage) {
            tokensIn = event.metadata.usage.inputTokens ?? tokensIn;
            tokensOut = event.metadata.usage.outputTokens ?? tokensOut;
          }
        }

        return { text: fullText, tokensIn, tokensOut, model: this.modelId };
      }

      const command = new ConverseCommand({
        modelId: this.modelId,
        system,
        messages: converseMessages,
        inferenceConfig,
      });
      const response = await bedrockClient.send(command);
      const text =
        response.output?.message?.content?.map((c) => c.text ?? "").join("") ?? "";

      return {
        text,
        tokensIn: response.usage?.inputTokens ?? 0,
        tokensOut: response.usage?.outputTokens ?? 0,
        model: this.modelId,
      };
    } catch (err) {
      logger.error({ err, modelId: this.modelId }, "Bedrock LLM generate failed");
      throw err;
    }
  }
}
