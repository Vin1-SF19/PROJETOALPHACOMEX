import { prazosBanco } from "./db-resilience-config";
import { registrarMetricaBanco } from "./db-observability";

export const DB_ROUNDTRIP_TIMEOUT_MS = prazosBanco.transportMs;
let inFlight = 0;

/** One transport attempt, including its body. Never retries: Hrana POST can write. */
export function criarFetchBanco(
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
  timeoutMs = DB_ROUNDTRIP_TIMEOUT_MS,
): typeof fetch {
  return async (input, init) => {
    const startedAt = Date.now();
    inFlight++;
    let headersAt: number | undefined;
    let status: number | undefined;
    let deadlineExpired = false;
    const controller = new AbortController();
    const signals = [input instanceof Request ? input.signal : undefined, init?.signal]
      .filter((signal): signal is AbortSignal => !!signal);
    const listeners = signals.map((signal) => {
      const forward = () => controller.abort(signal.reason);
      signal.addEventListener("abort", forward, { once: true });
      if (signal.aborted) forward();
      return () => signal.removeEventListener("abort", forward);
    });
    const timer = setTimeout(() => {
      deadlineExpired = true;
      controller.abort(new DOMException("Database transport deadline exceeded", "TimeoutError"));
    }, timeoutMs);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearTimeout(timer);
      listeners.forEach((remove) => remove());
      inFlight--;
    };
    const report = (phase: "complete" | "abort", failed = false) => {
      if (cleaned) return;
      registrarMetricaBanco({
        component: "transport", phase,
        outcome: deadlineExpired ? "deadline" : controller.signal.aborted ? "caller_abort" : failed ? "network_error" : status && status >= 400 ? "http_error" : "ok",
        totalMs: Date.now() - startedAt,
        ...(headersAt === undefined ? {} : { headersMs: headersAt - startedAt, bodyMs: Date.now() - headersAt }),
        ...(status === undefined ? {} : { status }), pending: inFlight,
      });
    };
    try {
      controller.signal.throwIfAborted();
      const response = await fetchImpl(input, { ...init, signal: controller.signal });
      controller.signal.throwIfAborted();
      headersAt = Date.now();
      status = response.status;
      if (!response.body) {
        report("complete");
        cleanup();
        return response;
      }
      const reader = response.body.getReader();
      let abortBody: () => void;
      const body = new ReadableStream<Uint8Array>({
        start(stream) {
          abortBody = () => {
            stream.error(controller.signal.reason);
            void reader.cancel(controller.signal.reason).catch(() => undefined);
            report("abort");
            cleanup();
          };
          controller.signal.addEventListener("abort", abortBody, { once: true });
        },
        async pull(stream) {
          try {
            const result = await reader.read();
            if (controller.signal.aborted) return;
            if (result.done) {
              controller.signal.removeEventListener("abort", abortBody);
              report("complete");
              cleanup();
              stream.close();
            } else stream.enqueue(result.value);
          } catch (error) {
            controller.signal.removeEventListener("abort", abortBody);
            report("abort", true);
            cleanup();
            stream.error(error);
          }
        },
        cancel(reason) {
          controller.signal.removeEventListener("abort", abortBody);
          controller.abort(reason);
          report("abort");
          cleanup();
          return reader.cancel(reason);
        },
      });
      const bounded = new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
      for (const property of ["url", "redirected", "type"] as const) {
        Object.defineProperty(bounded, property, { value: response[property] });
      }
      return bounded;
    } catch (error) {
      report("abort", true);
      cleanup();
      throw error;
    }
  };
}
