import { AUTH_RETRY_AFTER_SECONDS } from "@/lib/auth/estado-acesso";
import type { Result } from "./types";
export function resultHttp<T>(result: Result<T>) {
  const status = result.ok
    ? 200
    : {
        AUTH_UNAVAILABLE: 503,
        UNAUTHENTICATED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        VALIDATION: 400,
        CONFLICT: 409,
        MODEL_EMPTY: 409,
        MODEL_CODE_CONFLICT: 409,
        UPLOAD_INVALID: 400,
        LIMIT_EXCEEDED: 413,
        RETRYABLE: 503,
        INTERNAL: 500,
      }[result.error.code];
  return Response.json(result, {
    status,
    headers: { "Cache-Control": "no-store", ...(!result.ok && result.error.code === "AUTH_UNAVAILABLE" ? { "Retry-After": String(AUTH_RETRY_AFTER_SECONDS) } : {}) },
  });
}
