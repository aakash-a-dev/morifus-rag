import crypto from "crypto";
import { redis } from "./redisClient";
import { env } from "../config/env";

function cacheKey(workspaceId: string, query: string, documentIds: string[]): string {
  const hash = crypto
    .createHash("sha256")
    .update(query.trim().toLowerCase())
    .update("|")
    .update([...documentIds].sort().join(","))
    .digest("hex");
  return `chat:cache:${workspaceId}:${hash}`;
}

import { Citation } from "../chat/ragChat.types";

export interface CachedChatAnswer {
  answer: string;
  citations: Citation[];
  confidence: number;
  lowContext: boolean;
}

export async function getCachedAnswer(
  workspaceId: string,
  query: string,
  documentIds: string[]
): Promise<CachedChatAnswer | null> {
  const raw = await redis.get(cacheKey(workspaceId, query, documentIds));
  return raw ? (JSON.parse(raw) as CachedChatAnswer) : null;
}

export async function setCachedAnswer(
  workspaceId: string,
  query: string,
  documentIds: string[],
  value: CachedChatAnswer
): Promise<void> {
  await redis.set(
    cacheKey(workspaceId, query, documentIds),
    JSON.stringify(value),
    "EX",
    env.chatCacheTtlSeconds
  );
}
