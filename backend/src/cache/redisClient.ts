import Redis from "ioredis";
import { env } from "../config/env";

export const redis = new Redis(env.redisUrl, { maxRetriesPerRequest: 3, lazyConnect: false });
export const redisSub = new Redis(env.redisUrl, { maxRetriesPerRequest: 3, lazyConnect: false });

redis.on("error", (err) => console.error("[redis] connection error", err.message));
