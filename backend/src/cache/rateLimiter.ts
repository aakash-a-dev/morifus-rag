import { redis } from "./redisClient";
import { env } from "../config/env";

/**
 * Fixed-window token bucket shared across the API process and ingestion
 * worker(s) via Redis, so both respect one Bedrock throughput budget.
 */
export async function acquireBedrockSlot(key = "bedrock"): Promise<void> {
  const windowKey = `ratelimit:${key}:${Math.floor(Date.now() / 60000)}`;
  const count = await redis.incr(windowKey);
  if (count === 1) {
    await redis.expire(windowKey, 60);
  }
  if (count > env.bedrockRateLimitPerMinute) {
    const ttl = await redis.ttl(windowKey);
    const waitMs = Math.max(ttl, 1) * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return acquireBedrockSlot(key);
  }
}
