-- Multi-workspace support. No auth in this assignment: a workspace's slug is
-- its only access control (anyone with the URL can open it) - intentional
-- demo-grade tradeoff, documented in schema.prisma and README.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for digest() used in the backfill below

CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- Seed the pre-existing demo workspace and backfill every row created before
-- this migration into it, so today's testing data survives the migration.
INSERT INTO "workspaces" ("name", "slug") VALUES ('Aakash''s Demo Workspace', 'aakash-demo');

-- documents: add workspaceId + contentHash
ALTER TABLE "documents" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "documents" ADD COLUMN "contentHash" TEXT;

UPDATE "documents" SET "workspaceId" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'aakash-demo');

-- Pre-existing rows never stored raw file bytes post-ingestion, so fall back
-- to hashing the concatenation of their chunk contents as a reasonable
-- proxy. New uploads (via the app) hash the actual file bytes instead.
UPDATE "documents" d SET "contentHash" = sub.hash
FROM (
    SELECT "documentId", encode(digest(string_agg("content", '' ORDER BY "chunkIndex"), 'sha256'), 'hex') AS hash
    FROM "chunks"
    GROUP BY "documentId"
) sub
WHERE d."id" = sub."documentId";

ALTER TABLE "documents" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "documents_workspaceId_idx" ON "documents"("workspaceId");
CREATE UNIQUE INDEX "documents_workspaceId_contentHash_key" ON "documents"("workspaceId", "contentHash");

-- chunks: denormalize workspaceId + filename from the parent document
ALTER TABLE "chunks" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "chunks" ADD COLUMN "filename" TEXT;

UPDATE "chunks" c SET "workspaceId" = d."workspaceId", "filename" = d."filename"
FROM "documents" d
WHERE c."documentId" = d."id";

ALTER TABLE "chunks" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "chunks" ALTER COLUMN "filename" SET NOT NULL;
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "chunks_workspaceId_idx" ON "chunks"("workspaceId");

-- conversations: scope chat history per workspace
ALTER TABLE "conversations" ADD COLUMN "workspaceId" TEXT;
UPDATE "conversations" SET "workspaceId" = (SELECT "id" FROM "workspaces" WHERE "slug" = 'aakash-demo');
ALTER TABLE "conversations" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "conversations_workspaceId_idx" ON "conversations"("workspaceId");

-- contradictions: denormalized workspaceId (no FK - derived/cache field,
-- integrity already enforced via chunkA/chunkB FKs)
ALTER TABLE "contradictions" ADD COLUMN "workspaceId" TEXT;
UPDATE "contradictions" ct SET "workspaceId" = c."workspaceId"
FROM "chunks" c
WHERE ct."chunkAId" = c."id";
ALTER TABLE "contradictions" ALTER COLUMN "workspaceId" SET NOT NULL;
CREATE INDEX "contradictions_workspaceId_idx" ON "contradictions"("workspaceId");
