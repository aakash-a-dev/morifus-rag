import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { workspacesRouter } from "./routes/workspaces.routes";
import { documentsRouter } from "./routes/documents.routes";
import { chatRouter } from "./routes/chat.routes";
import { contradictionsRouter } from "./routes/contradictions.routes";
import { progressRouter } from "./routes/progress.routes";
import { devRouter } from "./routes/dev.routes";
import { resolveWorkspace } from "./middleware/resolveWorkspace";
import { errorHandler } from "./middleware/errorHandler";
import { getChannel } from "./queue/rabbitmq";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(pinoHttp({ logger }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Workspace management (no auth in this assignment - a workspace's slug is
// its only access control, see prisma/schema.prisma for the rationale).
app.use("/api/workspaces", workspacesRouter);

// Everything below is scoped to one workspace, resolved from the :slug
// segment and attached to req.workspaceId by resolveWorkspace.
app.use("/api/workspaces/:slug/documents", resolveWorkspace, documentsRouter);
app.use("/api/workspaces/:slug/chat", resolveWorkspace, chatRouter);
app.use("/api/workspaces/:slug/contradictions", resolveWorkspace, contradictionsRouter);

app.use("/api/progress", progressRouter);
app.use("/api/dev", devRouter);

app.use(errorHandler);

async function start() {
  await getChannel(); // fail fast if RabbitMQ is unreachable
  app.listen(env.port, () => {
    logger.info(`API listening on http://localhost:${env.port}`);
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
