import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { LLMGenerateOptions, LLMGenerateResult, LLMMessage, LLMProvider } from "../llm.interface";

export class GeminiLLMProvider implements LLMProvider {
  readonly name = "gemini";
  private modelId = env.gemini.llmModel;
  private client: GoogleGenerativeAI;

  constructor() {
    if (!env.gemini.apiKey) {
      throw new Error("GEMINI_API_KEY is required when LLM_PROVIDER=gemini");
    }
    this.client = new GoogleGenerativeAI(env.gemini.apiKey);
  }

  async generate(messages: LLMMessage[], opts: LLMGenerateOptions = {}): Promise<LLMGenerateResult> {
    const systemMessage =
      opts.system ?? messages.find((m) => m.role === "system")?.content;

    const model = this.client.getGenerativeModel({
      model: this.modelId,
      systemInstruction: systemMessage,
      generationConfig: {
        maxOutputTokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.2,
      },
    });

    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      }));

    try {
      if (opts.onToken) {
        const result = await model.generateContentStream({ contents });
        let fullText = "";
        for await (const chunk of result.stream) {
          const delta = chunk.text();
          if (delta) {
            fullText += delta;
            opts.onToken(delta);
          }
        }
        const final = await result.response;
        const usage = final.usageMetadata;
        return {
          text: fullText,
          tokensIn: usage?.promptTokenCount ?? 0,
          tokensOut: usage?.candidatesTokenCount ?? 0,
          model: this.modelId,
        };
      }

      const result = await model.generateContent({ contents });
      const usage = result.response.usageMetadata;
      return {
        text: result.response.text(),
        tokensIn: usage?.promptTokenCount ?? 0,
        tokensOut: usage?.candidatesTokenCount ?? 0,
        model: this.modelId,
      };
    } catch (err) {
      logger.error({ err, modelId: this.modelId }, "Gemini LLM generate failed");
      throw err;
    }
  }
}
