import amqplib, { type Channel, type ChannelModel } from "amqplib";
import { env } from "../config/env";
import { logger } from "../config/logger";

export const INGEST_QUEUE = "ingest-document";
export const INGEST_QUEUE_DLQ = "ingest-document.failed";

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export async function getChannel(): Promise<Channel> {
  if (channel) return channel;

  connection = await amqplib.connect(env.rabbitmqUrl);
  channel = await connection.createChannel();

  await channel.assertQueue(INGEST_QUEUE_DLQ, { durable: true });
  await channel.assertQueue(INGEST_QUEUE, {
    durable: true,
    deadLetterExchange: "",
    deadLetterRoutingKey: INGEST_QUEUE_DLQ,
  });

  connection.on("error", (err: Error) => logger.error({ err }, "RabbitMQ connection error"));
  connection.on("close", () => {
    logger.warn("RabbitMQ connection closed");
    channel = null;
    connection = null;
  });

  return channel;
}

export interface IngestJobPayload {
  documentId: string;
  filePath: string;
  mimeType: string;
  filename: string;
  attempt: number;
}

export async function publishIngestJob(payload: IngestJobPayload): Promise<void> {
  const ch = await getChannel();
  ch.sendToQueue(INGEST_QUEUE, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
}

const MAX_ATTEMPTS = 3;

export async function consumeIngestQueue(
  handler: (payload: IngestJobPayload) => Promise<void>
): Promise<void> {
  const ch = await getChannel();
  await ch.prefetch(2); // bounds concurrent Bedrock calls from ingestion side

  await ch.consume(INGEST_QUEUE, async (msg) => {
    if (!msg) return;
    let payload: IngestJobPayload;
    try {
      payload = JSON.parse(msg.content.toString());
    } catch (err) {
      logger.error({ err }, "Malformed ingest job, dropping");
      ch.nack(msg, false, false);
      return;
    }

    try {
      await handler(payload);
      ch.ack(msg);
    } catch (err) {
      logger.error({ err, documentId: payload.documentId, attempt: payload.attempt }, "Ingest job failed");
      if (payload.attempt < MAX_ATTEMPTS) {
        // retry with incremented attempt count
        ch.ack(msg);
        await publishIngestJob({ ...payload, attempt: payload.attempt + 1 });
      } else {
        // exhausted retries -> dead-letter, document marked error by handler/caller
        ch.nack(msg, false, false);
      }
    }
  });
}
