export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMGenerateOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** Called for each streamed text delta. If omitted, generate() resolves with the full text. */
  onToken?: (delta: string) => void;
}

export interface LLMGenerateResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

export interface LLMProvider {
  readonly name: string;
  generate(messages: LLMMessage[], opts?: LLMGenerateOptions): Promise<LLMGenerateResult>;
}
