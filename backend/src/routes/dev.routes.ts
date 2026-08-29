import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../db/prisma";
import { ingestUpload } from "../documents/documentsService";

export const devRouter = Router();

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

devRouter.post("/load-demo-data", async (_req, res, next) => {
  try {
    const seedDir = path.join(__dirname, "..", "..", "seed");
    const files = await fs.readdir(seedDir);
    const results = [];
    for (const file of files) {
      const buffer = await fs.readFile(path.join(seedDir, file));
      const mimeType = file.endsWith(".md") ? "text/markdown" : "text/plain";
      const doc = await ingestUpload({ originalname: file, mimetype: mimeType, buffer });
      results.push(doc);
    }
    res.status(202).json({ documents: results });
  } catch (err) {
    next(err);
  }
});
