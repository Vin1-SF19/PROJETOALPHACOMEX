/** One HTTP operation through body consumption; never retries a request. */
export async function comPrazoHttp<T>(
  timeoutMs: number,
  callerSignal: AbortSignal | null | undefined,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const forward = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener("abort", forward, { once: true });
  if (callerSignal?.aborted) forward();
  const timer = setTimeout(() => controller.abort(new DOMException("HTTP operation deadline exceeded", "TimeoutError")), timeoutMs);
  let removeAbort = () => {};
  try {
    controller.signal.throwIfAborted();
    const aborted = new Promise<never>((_, reject) => {
      const onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener("abort", onAbort, { once: true });
      removeAbort = () => controller.signal.removeEventListener("abort", onAbort);
    });
    return await Promise.race([operation(controller.signal), aborted]);
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", forward);
    removeAbort();
  }
}
