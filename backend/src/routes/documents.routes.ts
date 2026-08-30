import { Router } from "express";
import multer from "multer";
import { ingestUpload, listDocuments, getDocument, deleteDocument } from "../documents/documentsService";

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

documentsRouter.delete("/:id", async (req, res, next) => {
  try {
    await deleteDocument(req.params.id, req.workspaceId!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
