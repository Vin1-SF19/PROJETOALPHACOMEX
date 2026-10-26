/** Bounded cause traversal; code 23 alone also occurs in SQLite and is unsafe. */
export function erroTransporteBanco(value: unknown, onlyDeadline = false): boolean {
  const pending = [value];
  const visited = new Set<object>();
  while (pending.length && visited.size < 16) {
    const current = pending.pop();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    if (!onlyDeadline && current instanceof TypeError && current.message === "fetch failed") return true;
    const error = current as { code?: unknown; name?: unknown; message?: unknown; cause?: unknown; meta?: { driverAdapterError?: unknown }; originalMessage?: unknown };
    if (error.code === "UND_ERR_CONNECT_TIMEOUT") return true;
    if (!onlyDeadline && typeof error.code === "string" && /^(UND_ERR_(SOCKET|HEADERS_TIMEOUT|BODY_TIMEOUT)|ECONNRESET|ETIMEDOUT)$/.test(error.code)) return true;
    if (!onlyDeadline && error.name === "TimeoutError" ||
        [error.message, error.originalMessage].some((message) => typeof message === "string" && message.includes("Database transport deadline exceeded"))) return true;
    pending.push(error.cause, error.meta?.driverAdapterError);
  }
  return false;
}
