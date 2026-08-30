import { Router } from "express";
import multer from "multer";
import fs from "fs";
import {
  ingestUpload,
  listDocuments,
  getDocument,
  getDocumentText,
  deleteDocument,
} from "../documents/documentsService";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const documentsRouter = Router();

documentsRouter.post("/upload", upload.array("files", 10), async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) {
      return res.status(400).json({ error: "ValidationError", message: "No files provided" });
    }
    const results = await Promise.allSettled(files.map((f) => ingestUpload(f, workspaceId)));

    const documents = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof ingestUpload>>> => r.status === "fulfilled")
      .map((r) => ({ ...r.value.document, deduped: r.value.deduped }));
    const errors = results
      .map((r, i) => (r.status === "rejected" ? { filename: files[i].originalname, message: (r.reason as Error).message } : null))
      .filter(Boolean);

    res.status(202).json({ documents, errors });
  } catch (err) {
    next(err);
  }
});

documentsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await listDocuments(req.workspaceId!));
  } catch (err) {
    next(err);
  }
});

documentsRouter.get("/:id", async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.workspaceId!);
    if (!doc) return res.status(404).json({ error: "NotFound" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

documentsRouter.get("/:id/text", async (req, res, next) => {
  try {
    const result = await getDocumentText(req.params.id, req.workspaceId!);
    if (!result) return res.status(404).json({ error: "NotFound" });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Serves the original uploaded file itself, PDFs and text render inline in
// the browser for previewing; anything else (DOCX) downloads instead, since
// browsers can't render it inline.
documentsRouter.get("/:id/file", async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id, req.workspaceId!);
    if (!doc || !doc.storedPath) return res.status(404).json({ error: "NotFound" });
    if (!fs.existsSync(doc.storedPath)) {
      return res.status(404).json({ error: "NotFound", message: "Original file is no longer available" });
    }

    const inlineTypes = ["application/pdf", "text/plain", "text/markdown"];
    const contentType = doc.mimeType === "text/markdown" ? "text/plain" : doc.mimeType;
    res.setHeader("Content-Type", contentType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `${inlineTypes.includes(doc.mimeType) ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.filename)}"`
    );
    fs.createReadStream(doc.storedPath).pipe(res);
  } catch (err) {
    next(err);
  }
});

documentsRouter.delete("/:id", async (req, res, next) => {
  try {
    await deleteDocument(req.params.id, req.workspaceId!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
