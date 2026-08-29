import { redis, redisSub } from "./redisClient";

export interface IngestionProgressEvent {
  documentId: string;
  stage: "queued" | "parsing" | "chunking" | "enriching" | "embedding" | "storing" | "ready" | "error";
  progress: number; // 0-100
  message?: string;
}

const CHANNEL = "ingestion-progress";

export async function publishProgress(event: IngestionProgressEvent): Promise<void> {
  await redis.publish(CHANNEL, JSON.stringify(event));
}

export function subscribeToProgress(onEvent: (event: IngestionProgressEvent) => void): () => void {
  const listener = (channel: string, message: string) => {
    if (channel !== CHANNEL) return;
    try {
      onEvent(JSON.parse(message) as IngestionProgressEvent);
    } catch {
      // ignore malformed message
    }
  };
  redisSub.subscribe(CHANNEL);
  redisSub.on("message", listener);
  return () => {
    redisSub.off("message", listener);
  };
}
