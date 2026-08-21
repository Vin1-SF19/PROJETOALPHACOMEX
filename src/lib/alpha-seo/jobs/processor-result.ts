export type AlphaSeoProcessorDisposition =
  | { kind: "complete" }
  | { kind: "defer"; delayMs: number }
  | { kind: "invalid" };

export function classifyAlphaSeoProcessorResult(
  result: Record<string, unknown>,
): AlphaSeoProcessorDisposition {
  if (result.deferred === true) {
    return {
      kind: "defer",
      delayMs:
        typeof result.delayMs === "number" && Number.isFinite(result.delayMs)
          ? Math.max(1_000, result.delayMs)
          : 120_000,
    };
  }
  if (result.skipped === true) {
    if (result.retryable === true) {
      return {
        kind: "defer",
        delayMs:
          typeof result.delayMs === "number" && Number.isFinite(result.delayMs)
            ? Math.max(1_000, result.delayMs)
            : 30_000,
      };
    }
    return result.terminal === true ? { kind: "complete" } : { kind: "invalid" };
  }
  return { kind: "complete" };
}
