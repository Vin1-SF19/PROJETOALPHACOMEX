import "server-only";

import { z } from "zod";

import {
  MIB,
  STORAGE_DEFAULT_PART_SIZE,
  STORAGE_MAX_PART_SIZE,
  STORAGE_MIN_PART_SIZE,
} from "@/lib/storage/contracts";

export type StorageEnvironment = Record<string, string | undefined>;

const positiveInteger = (fallback: number) => z.preprocess(
  (value) => value === undefined || value === "" ? fallback : Number(value),
  z.number().int().positive(),
);

const configSchema = z.object({
  publicEndpoint: z.string().trim().url().refine((value) => value.startsWith("https://"), "must use HTTPS"),
  internalEndpoint: z.string().trim().url().refine((value) => value.startsWith("https://"), "must use HTTPS").optional(),
  region: z.string().trim().min(1),
  accessKeyId: z.string().trim().min(1),
  secretAccessKey: z.string().trim().min(1),
  storageSpace: z.string().trim().min(1),
  bucket: z.string().trim().min(1),
  fallbackStore: z.string().trim().min(1),
  blobToken: z.string().trim().min(1),
  blobAccess: z.enum(["public", "private"]),
  timeoutMs: positiveInteger(5_000).pipe(z.number().max(60_000)),
  partSizeBytes: positiveInteger(STORAGE_DEFAULT_PART_SIZE)
    .pipe(z.number().min(STORAGE_MIN_PART_SIZE).max(STORAGE_MAX_PART_SIZE)),
  concurrency: positiveInteger(3).pipe(z.number().max(4)),
  maxRetries: positiveInteger(3).pipe(z.number().max(8)),
}).strict();

export type StorageRuntimeConfig = z.infer<typeof configSchema>;

export type StorageRuntimeConfigResult =
  | { ok: true; config: StorageRuntimeConfig }
  | { ok: false; issues: string[] };

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function readStorageRuntimeConfig(env: StorageEnvironment = process.env): StorageRuntimeConfigResult {
  const partSizeMiB = env.STORAGE_MULTIPART_PART_SIZE_MIB;
  const parsed = configSchema.safeParse({
    publicEndpoint: env.STORAGE_QUOBJECTS_ENDPOINT,
    internalEndpoint: optionalTrimmed(env.STORAGE_QUOBJECTS_INTERNAL_ENDPOINT),
    region: env.STORAGE_QUOBJECTS_REGION || "us-east-1",
    accessKeyId: env.STORAGE_QUOBJECTS_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_QUOBJECTS_SECRET_ACCESS_KEY,
    storageSpace: env.STORAGE_QUOBJECTS_SPACE || "painel-alpha-poc",
    bucket: env.STORAGE_QUOBJECTS_BUCKET || "pa-poc-private",
    fallbackStore: env.STORAGE_VERCEL_STORE || "legacy-default",
    blobToken: env.STORAGE_VERCEL_BLOB_TOKEN || env.BLOB_READ_WRITE_TOKEN,
    blobAccess: env.STORAGE_VERCEL_ACCESS || "public",
    timeoutMs: env.STORAGE_PREFLIGHT_TIMEOUT_MS,
    partSizeBytes: partSizeMiB ? Number(partSizeMiB) * MIB : undefined,
    concurrency: env.STORAGE_MULTIPART_CONCURRENCY,
    maxRetries: env.STORAGE_MULTIPART_MAX_RETRIES,
  });

  if (parsed.success) return { ok: true, config: parsed.data };

  const issues = parsed.error.issues.map((issue) => {
    const field = issue.path.join(".") || "config";
    return `${field}:${issue.code}`;
  });
  return { ok: false, issues: Array.from(new Set(issues)).sort() };
}

export function storageSecretValues(config: StorageRuntimeConfig): string[] {
  return [config.accessKeyId, config.secretAccessKey, config.blobToken, config.internalEndpoint]
    .filter((value): value is string => Boolean(value));
}
