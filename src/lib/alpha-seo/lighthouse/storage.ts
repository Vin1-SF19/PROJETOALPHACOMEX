import "server-only";

import { createHash } from "node:crypto";
import { resolveStorageTarget } from "@/lib/storage/catalog";
import { uploadMultipart, selectStorageProvider } from "@/lib/storage/orchestrator";
import { QuObjectsProvider } from "@/lib/storage/providers/quobjects";
import { VercelBlobProvider } from "@/lib/storage/providers/vercel-blob";
import { readStorageRuntimeConfig } from "@/lib/storage/runtime-config";

const MAX_LIGHTHOUSE_PAYLOAD_BYTES = 100 * 1024 * 1024;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, canonical(nested)]));
}

export function serializeLighthousePayload(payload: unknown): Uint8Array {
  return Buffer.from(`${JSON.stringify(canonical(payload))}\n`, "utf8");
}

async function* chunks(body: Uint8Array, partSize: number) {
  for (let offset = 0; offset < body.byteLength; offset += partSize) yield body.slice(offset, Math.min(body.byteLength, offset + partSize));
}

export async function storeLighthousePayload(input: { auditId: string; pageId: string; strategy: "MOBILE" | "DESKTOP"; payload: unknown }) {
  const runtime = readStorageRuntimeConfig();
  if (!runtime.ok || input.payload === undefined) return null;
  const body = serializeLighthousePayload(input.payload);
  const checksum = createHash("sha256").update(body).digest("hex");
  const config = runtime.config;
  const target = resolveStorageTarget("documentos", config);
  const selection = await selectStorageProvider({ primary: new QuObjectsProvider(config), fallback: new VercelBlobProvider(config) }, target, config.timeoutMs);
  const objectKey = `alpha-seo/lighthouse/${input.auditId}/${input.pageId}-${input.strategy.toLowerCase()}-${checksum.slice(0, 16)}.json`;
  const uploaded = await uploadMultipart({ provider: selection.provider, target, objectKey, contentType: "application/json", size: body.byteLength, partSize: config.partSizeBytes, concurrency: Math.min(2, config.concurrency), maxRetries: config.maxRetries, source: chunks(body, config.partSizeBytes) });
  return { storageKey: `${uploaded.metadata.provider}:${uploaded.metadata.bucketOrStore}:${objectKey}`, payloadSizeBytes: body.byteLength };
}

function parseStorageKey(storageKey: string) {
  const match = /^(quobjects|vercel-blob):([^:]+):(.+)$/.exec(storageKey);
  if (!match) throw new Error("LIGHTHOUSE_STORAGE_KEY_INVALID");
  return {
    provider: match[1] as "quobjects" | "vercel-blob",
    bucketOrStore: match[2],
    objectKey: match[3],
  };
}

export async function readLighthousePayload(input: {
  storageKey: string;
  expectedSizeBytes?: number | null;
}) {
  const runtime = readStorageRuntimeConfig();
  if (!runtime.ok) throw new Error("LIGHTHOUSE_STORAGE_NOT_CONFIGURED");
  if (
    input.expectedSizeBytes != null &&
    input.expectedSizeBytes > MAX_LIGHTHOUSE_PAYLOAD_BYTES
  ) {
    throw new Error("LIGHTHOUSE_PAYLOAD_TOO_LARGE");
  }

  const parsed = parseStorageKey(input.storageKey);
  if (!parsed.objectKey.startsWith("alpha-seo/lighthouse/")) {
    throw new Error("LIGHTHOUSE_STORAGE_KEY_INVALID");
  }
  const target = resolveStorageTarget("documentos", runtime.config);
  const expectedBucket =
    parsed.provider === "quobjects" ? target.bucket : target.fallbackStore;
  if (parsed.bucketOrStore !== expectedBucket) {
    throw new Error("LIGHTHOUSE_STORAGE_TARGET_INVALID");
  }
  const provider =
    parsed.provider === "quobjects"
      ? new QuObjectsProvider(runtime.config)
      : new VercelBlobProvider(runtime.config);
  const source = await provider.download(target, parsed.objectKey);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of source) {
    total += chunk.byteLength;
    if (total > MAX_LIGHTHOUSE_PAYLOAD_BYTES) {
      throw new Error("LIGHTHOUSE_PAYLOAD_TOO_LARGE");
    }
    chunks.push(chunk);
  }
  if (input.expectedSizeBytes != null && total !== input.expectedSizeBytes) {
    throw new Error("LIGHTHOUSE_PAYLOAD_SIZE_MISMATCH");
  }
  const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString(
    "utf8",
  );
  try {
    return { text, payload: JSON.parse(text) as unknown };
  } catch {
    throw new Error("LIGHTHOUSE_PAYLOAD_INVALID");
  }
}
