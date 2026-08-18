import "server-only";

import { StorageError, type StorageErrorCode, type StorageProviderId } from "@/lib/storage/contracts";

const GENERIC_SENSITIVE_PATTERNS = [
  /authorization\s*[:=]\s*[^\s,;]+/gi,
  /(?:access[_-]?key|secret[_-]?key|token)\s*[:=]\s*[^\s,;]+/gi,
  /https?:\/\/[^\s?#]+\?[^\s]+/gi,
];

export function redactText(value: unknown, secrets: readonly string[] = []): string {
  let text = value instanceof Error ? value.message : String(value ?? "");
  for (const secret of secrets) {
    if (secret) text = text.split(secret).join("[REDACTED]");
  }
  for (const pattern of GENERIC_SENSITIVE_PATTERNS) text = text.replace(pattern, "[REDACTED]");
  return text.slice(0, 500);
}

export function classifyStorageError(error: unknown, provider?: StorageProviderId): StorageError {
  if (error instanceof StorageError) return error;

  const candidate = error as {
    name?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const status = candidate?.$metadata?.httpStatusCode;
  let code: StorageErrorCode = "UNKNOWN";
  let retryable = false;

  if (candidate?.name === "AbortError" || candidate?.code === "ABORT_ERR") code = "TIMEOUT";
  else if (status === 401 || status === 403 || candidate?.name === "AccessDenied") code = "AUTH_FAILED";
  else if (status === 404 || candidate?.name === "NoSuchBucket") code = "BUCKET_NOT_FOUND";
  else if (typeof status === "number") {
    code = "HTTP_ERROR";
    retryable = status >= 500 || status === 429;
  } else if (["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT"].includes(candidate?.code || "")) {
    code = candidate?.code === "ETIMEDOUT" ? "TIMEOUT" : "NETWORK_ERROR";
    retryable = true;
  }

  return new StorageError(code, `Storage operation failed (${code})`, { provider, retryable, cause: error });
}

export function sanitizedError(error: unknown, secrets: readonly string[] = []): { errorCode: string; message: string } {
  const classified = classifyStorageError(error);
  return {
    errorCode: classified.code,
    message: redactText(classified.message, secrets),
  };
}
