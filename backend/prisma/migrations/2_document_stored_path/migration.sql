-- Track where the raw uploaded file lives on the uploads volume, so the
-- original document can be previewed/downloaded later, not just its
-- extracted chunks.
ALTER TABLE "documents" ADD COLUMN "storedPath" TEXT;
