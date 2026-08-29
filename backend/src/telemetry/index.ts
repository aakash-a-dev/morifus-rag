import { prisma } from "../db/prisma";
import { logger } from "../config/logger";

// Static $/1K-token pricing table (approximate, for cost visibility only).
const PRICING_PER_1K_TOKENS: Record<string, { in: number; out: number }> = {
  "anthropic.claude-3-5-sonnet-20240620-v1:0": { in: 0.003, out: 0.015 },
  "amazon.titan-embed-text-v2:0": { in: 0.00002, out: 0 },
};

function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = PRICING_PER_1K_TOKENS[model] ?? { in: 0.001, out: 0.002 };
  return (tokensIn / 1000) * pricing.in + (tokensOut / 1000) * pricing.out;
}

export interface TelemetryEntry {
  stage: "embed" | "generate" | "contradiction";
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

export async function recordTelemetry(entry: TelemetryEntry) {
  const estimatedCostUsd = estimateCost(entry.model, entry.tokensIn, entry.tokensOut);
  try {
    await prisma.requestLog.create({
      data: { ...entry, estimatedCostUsd },
    });
  } catch (err) {
    logger.warn({ err }, "Failed to persist telemetry (non-fatal)");
  }
  return estimatedCostUsd;
}

/** Wraps an async provider call, timing it and persisting telemetry automatically. */
export async function withTelemetry<T extends { tokensIn: number; tokensOut?: number; model: string }>(
  stage: TelemetryEntry["stage"],
  provider: string,
  fn: () => Promise<T>
): Promise<T & { estimatedCostUsd: number; latencyMs: number }> {
  const start = Date.now();
  const result = await fn();
  const latencyMs = Date.now() - start;
  const estimatedCostUsd = await recordTelemetry({
    stage,
    provider,
    model: result.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut ?? 0,
    latencyMs,
  });
  return { ...result, estimatedCostUsd, latencyMs };
}
