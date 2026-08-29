import { logger } from "./config/logger";
import { consumeIngestQueue } from "./queue/rabbitmq";
import { runIngestionPipeline } from "./ingestion/pipeline";

async function start() {
  logger.info("Ingestion worker starting...");
  await consumeIngestQueue(runIngestionPipeline);
  logger.info("Ingestion worker consuming ingest-document queue");
}

start().catch((err) => {
  logger.error({ err }, "Failed to start worker");
  process.exit(1);
});
