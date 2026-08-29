export interface EmbeddingResult {
  vectors: number[][];
  tokensIn: number;
  model: string;
  dimensions: number;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<EmbeddingResult>;
}
