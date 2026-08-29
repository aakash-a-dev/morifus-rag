import crypto from "crypto";
import { redis } from "./redisClient";
import { env } from "../config/env";

function cacheKey(query: string, documentIds: string[]): string {
  const hash = crypto
    .createHash("sha256")
    .update(query.trim().toLowerCase())
    .update("|")
    .update([...documentIds].sort().join(","))
    .digest("hex");
  return `chat:cache:${hash}`;
}

import { Citation } from "../chat/ragChat.types";

export interface CachedChatAnswer {
  answer: string;
  citations: Citation[];
  confidence: number;
  lowContext: boolean;
}

export async function getCachedAnswer(
  query: string,
  documentIds: string[]
): Promise<CachedChatAnswer | null> {
  const raw = await redis.get(cacheKey(query, documentIds));
  return raw ? (JSON.parse(raw) as CachedChatAnswer) : null;
}

export async function setCachedAnswer(
  query: string,
  documentIds: string[],
  value: CachedChatAnswer
): Promise<void> {
  await redis.set(cacheKey(query, documentIds), JSON.stringify(value), "EX", env.chatCacheTtlSeconds);
}
