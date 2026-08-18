import "server-only";

export const MIB = 1024 * 1024;
export const GIB = 1024 * MIB;
export const STORAGE_MAX_OBJECT_SIZE = 2 * GIB;
export const STORAGE_DEFAULT_PART_SIZE = 64 * MIB;
export const STORAGE_MAX_PART_SIZE = 95 * MIB;
export const STORAGE_MIN_PART_SIZE = 5 * MIB;

export type StorageProviderId = "quobjects" | "vercel-blob";
export type LogicalStorageId = "documentos";
export type StorageCliExitCode = 0 | 1 | 2;

export interface StorageTarget {
  logicalStorage: LogicalStorageId;
  primaryProvider: "quobjects";
  fallbackProvider: "vercel-blob";
  storageSpace: string;
  bucket: string;
  fallbackStore: string;
}

export interface StorageMultipartSession {
  provider: StorageProviderId;
  logicalStorage: LogicalStorageId;
  bucketOrStore: string;
  objectKey: string;
  uploadId: string;
  providerKey?: string;
  contentType: string;
}

export interface StorageCompletedPart {
  partNumber: number;
  etag: string;
  size: number;
}

export interface StorageObjectMetadata {
  provider: StorageProviderId;
  logicalStorage: LogicalStorageId;
  bucketOrStore: string;
  objectKey: string;
  size: number;
  contentType: string;
  checksum?: string;
  etag?: string;
  providerIdentifier?: string;
  url?: string;
}

export interface StorageDiagnostic {
  ok: boolean;
  provider: StorageProviderId;
  latencyMs: number;
  errorCode?: StorageErrorCode;
}

export type StorageErrorCode =
  | "ABORTED"
  | "AUTH_FAILED"
  | "BUCKET_NOT_FOUND"
  | "CHECKSUM_MISMATCH"
  | "CONFIG_INVALID"
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "OBJECT_NOT_FOUND"
  | "PART_FAILED"
  | "SIZE_INVALID"
  | "TIMEOUT"
  | "UNKNOWN";

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  readonly provider?: StorageProviderId;
  readonly retryable: boolean;

  constructor(
    code: StorageErrorCode,
    message: string,
    options: { provider?: StorageProviderId; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "StorageError";
    this.code = code;
    this.provider = options.provider;
    this.retryable = options.retryable ?? false;
  }
}

export interface StartMultipartInput {
  target: StorageTarget;
  objectKey: string;
  contentType: string;
}

export interface StorageProvider {
  readonly id: StorageProviderId;
  diagnose(target: StorageTarget, signal?: AbortSignal): Promise<StorageDiagnostic>;
  startMultipart(input: StartMultipartInput, signal?: AbortSignal): Promise<StorageMultipartSession>;
  uploadPart(
    session: StorageMultipartSession,
    partNumber: number,
    body: Uint8Array,
    signal?: AbortSignal,
  ): Promise<StorageCompletedPart>;
  completeMultipart(
    session: StorageMultipartSession,
    parts: StorageCompletedPart[],
    signal?: AbortSignal,
  ): Promise<StorageObjectMetadata>;
  abortMultipart(session: StorageMultipartSession, signal?: AbortSignal): Promise<void>;
  head(target: StorageTarget, objectKey: string, signal?: AbortSignal): Promise<StorageObjectMetadata>;
  download(target: StorageTarget, objectKey: string, signal?: AbortSignal): Promise<AsyncIterable<Uint8Array>>;
  createDownloadUrl(target: StorageTarget, objectKey: string, expiresInSeconds: number): Promise<string>;
  delete(target: StorageTarget, objectKey: string, signal?: AbortSignal): Promise<void>;
}

export interface StorageCommandResult {
  ok: boolean;
  command: "doctor" | "inventory" | "poc";
  code: StorageCliExitCode;
  checks: Record<string, unknown>;
  timestamp: string;
}

export function validateObjectSize(size: number): void {
  if (!Number.isSafeInteger(size) || size <= 0 || size > STORAGE_MAX_OBJECT_SIZE) {
    throw new StorageError("SIZE_INVALID", "Object size must be between 1 byte and 2 GiB");
  }
}

export function validatePartSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < STORAGE_MIN_PART_SIZE || size > STORAGE_MAX_PART_SIZE) {
    throw new StorageError("SIZE_INVALID", "Part size must be between 5 MiB and 95 MiB");
  }
}
