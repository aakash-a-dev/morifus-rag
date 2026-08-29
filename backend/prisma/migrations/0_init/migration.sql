-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enums
CREATE TYPE "DocumentStatus" AS ENUM ('processing', 'ready', 'error');
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant');
CREATE TYPE "ContradictionType" AS ENUM ('factual', 'logical', 'temporal', 'numerical');
CREATE TYPE "ContradictionSeverity" AS ENUM ('critical', 'warning', 'info');
CREATE TYPE "ContradictionStatus" AS ENUM ('open', 'resolved', 'false_positive');

-- documents
CREATE TABLE "documents" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'processing',
    "errorReason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- chunks (embedding column added below with raw SQL vector type)
CREATE TABLE "chunks" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contextualizedContent" TEXT,
    "page" INTEGER,
    "section" TEXT,
    "chunkIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- pgvector embedding column (1024 dims = Titan Text Embeddings V2 default output size)
ALTER TABLE "chunks" ADD COLUMN "embedding" vector(1024);
CREATE INDEX "chunks_embedding_idx" ON "chunks" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
CREATE INDEX "chunks_documentId_idx" ON "chunks"("documentId");

-- conversations
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- messages
CREATE TABLE "messages" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "citedChunkIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION,
    "fromCache" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");

-- contradictions
CREATE TABLE "contradictions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "chunkAId" TEXT NOT NULL,
    "chunkBId" TEXT NOT NULL,
    "statementA" TEXT NOT NULL,
    "statementB" TEXT NOT NULL,
    "type" "ContradictionType" NOT NULL,
    "severity" "ContradictionSeverity" NOT NULL,
    "status" "ContradictionStatus" NOT NULL DEFAULT 'open',
    "reasoning" TEXT NOT NULL,
    "reasoningTrace" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "contradictions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contradictions_chunkAId_fkey" FOREIGN KEY ("chunkAId") REFERENCES "chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contradictions_chunkBId_fkey" FOREIGN KEY ("chunkBId") REFERENCES "chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "contradictions_status_idx" ON "contradictions"("status");

-- request_logs
CREATE TABLE "request_logs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "stage" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "request_logs_pkey" PRIMARY KEY ("id")
);
