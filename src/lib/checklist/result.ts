import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import type { ErrorCode, Result } from "./types";
export class ChecklistError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}
export function fail(code: ErrorCode, message: string): never {
  throw new ChecklistError(code, message);
}
export async function resultado<T>(fn: () => Promise<T>): Promise<Result<T>> {
  const requestId = randomUUID();
  try {
    return { ok: true, data: await fn(), requestId };
  } catch (error) {
    if (error instanceof z.ZodError)
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Confira os campos informados.",
          fieldErrors: Object.fromEntries(
            Object.entries(error.flatten().fieldErrors).filter(
              (entry): entry is [string, string[]] => Array.isArray(entry[1]),
            ),
          ),
        },
        requestId,
      };
    if (error instanceof ChecklistError)
      return {
        ok: false,
        error: { code: error.code, message: error.message },
        requestId,
      };
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    const busy = String(error).includes("SQLITE_BUSY");
    console.error("[checklist]", {
      requestId,
      code: busy ? "BUSY" : code || "INTERNAL",
    });
    return {
      ok: false,
      error: {
        code: busy ? "RETRYABLE" : code === "P2002" ? "CONFLICT" : "INTERNAL",
        message: busy
          ? "Serviço ocupado. Repita a mesma operação."
          : code === "P2002"
            ? "A operação concorreu com outra alteração. Recarregue."
            : "Não foi possível concluir a operação.",
      },
      requestId,
    };
  }
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function hashPayload(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
