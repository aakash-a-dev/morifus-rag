import { Router } from "express";
import { subscribeToProgress } from "../cache/progressPubSub";

export const progressRouter = Router();

// Server-Sent Events stream of ingestion progress, so the frontend can show
// real-time upload status without polling Postgres.
progressRouter.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const unsubscribe = subscribeToProgress((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on("close", () => {
    unsubscribe();
    res.end();
  });
});
