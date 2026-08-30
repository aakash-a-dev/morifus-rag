import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../db/prisma";
import { ingestUpload } from "../documents/documentsService";
import { getWorkspaceBySlug } from "../workspaces/workspacesService";

export const devRouter = Router();

const DEMO_WORKSPACE_SLUG = "aakash-demo";

devRouter.get("/metrics", async (_req, res, next) => {
  try {
    const logs = await prisma.requestLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    const totalCost = logs.reduce((sum, l) => sum + l.estimatedCostUsd, 0);
    const totalTokensIn = logs.reduce((sum, l) => sum + l.tokensIn, 0);
    const totalTokensOut = logs.reduce((sum, l) => sum + l.tokensOut, 0);
    const avgLatencyMs =
      logs.length > 0 ? logs.reduce((sum, l) => sum + l.latencyMs, 0) / logs.length : 0;

    res.json({ totalCost, totalTokensIn, totalTokensOut, avgLatencyMs, recent: logs.slice(0, 25) });
  } catch (err) {
    next(err);
  }
});

// Idempotent: content-hash dedup in ingestUpload() means re-running this
// against a workspace that already has the demo docs just returns the
// existing (deduped) documents instead of creating duplicates.
devRouter.post("/load-demo-data", async (_req, res, next) => {
  try {
    const workspace = await getWorkspaceBySlug(DEMO_WORKSPACE_SLUG);
    if (!workspace) {
      return res.status(500).json({ error: "Setup", message: `Workspace "${DEMO_WORKSPACE_SLUG}" not found` });
    }

    const seedDir = path.join(__dirname, "..", "..", "seed");
    const files = await fs.readdir(seedDir);
    const results = [];
    for (const file of files) {
      const buffer = await fs.readFile(path.join(seedDir, file));
      const mimeType = file.endsWith(".md") ? "text/markdown" : "text/plain";
      const { document, deduped } = await ingestUpload(
        { originalname: file, mimetype: mimeType, buffer },
        workspace.id
      );
      results.push({ ...document, deduped });
    }
    res.status(202).json({ documents: results, workspace });
  } catch (err) {
    next(err);
  }
});
