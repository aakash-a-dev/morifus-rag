import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "4000", 10),

  databaseUrl: required("DATABASE_URL", "postgresql://docint:docint@localhost:5432/docint"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  rabbitmqUrl: required("RABBITMQ_URL", "amqp://guest:guest@localhost:5672"),

  llmProvider: process.env.LLM_PROVIDER ?? "bedrock",
  embeddingProvider: process.env.EMBEDDING_PROVIDER ?? "bedrock",

  aws: {
    region: process.env.AWS_REGION ?? "ap-south-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
  bedrock: {
    llmModelId: process.env.BEDROCK_LLM_MODEL_ID ?? "anthropic.claude-3-5-sonnet-20240620-v1:0",
    embeddingModelId: process.env.BEDROCK_EMBEDDING_MODEL_ID ?? "amazon.titan-embed-text-v2:0",
    embeddingDimensions: parseInt(process.env.BEDROCK_EMBEDDING_DIMENSIONS ?? "1024", 10),
  },

  contextualEnrichment: process.env.CONTEXTUAL_ENRICHMENT === "true",

  retrieval: {
    topK: parseInt(process.env.RETRIEVAL_TOP_K ?? "6", 10),
    confidenceThreshold: parseFloat(process.env.RETRIEVAL_CONFIDENCE_THRESHOLD ?? "0.45"),
    contradictionSimilarityThreshold: parseFloat(
      process.env.CONTRADICTION_SIMILARITY_THRESHOLD ?? "0.55"
    ),
  },

  bedrockRateLimitPerMinute: parseInt(process.env.BEDROCK_RATE_LIMIT_PER_MINUTE ?? "60", 10),
  chatCacheTtlSeconds: parseInt(process.env.CHAT_CACHE_TTL_SECONDS ?? "300", 10),

  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
};
