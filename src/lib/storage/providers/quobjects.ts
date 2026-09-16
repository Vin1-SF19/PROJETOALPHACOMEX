import "server-only";

import {
  AbortMultipartUploadCommand,
  CopyObjectCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsCommand,
  ListObjectsV2Command,
  ListMultipartUploadsCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type {
  StartMultipartInput,
  StorageCompletedPart,
  StorageDiagnostic,
  ExplorerStorageProvider,
  StorageListResult,
  StorageMultipartListResult,
  StorageMultipartSession,
  StorageObjectMetadata,
  StorageProvider,
  StorageTarget,
} from "@/lib/storage/contracts";
import { StorageError } from "@/lib/storage/contracts";
import type { StorageRuntimeConfig } from "@/lib/storage/runtime-config";
import { classifyStorageError } from "@/lib/storage/sanitize";

export type QuObjectsClient = Pick<S3Client, "send">;

export class QuObjectsProvider implements StorageProvider, ExplorerStorageProvider {
  readonly id = "quobjects" as const;
  private readonly client: QuObjectsClient;

  constructor(
    private readonly config: StorageRuntimeConfig,
    client?: QuObjectsClient,
  ) {
    this.client = client ?? new S3Client({
      endpoint: config.publicEndpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      maxAttempts: 1,
    });
  }

  async diagnose(target: StorageTarget, signal?: AbortSignal): Promise<StorageDiagnostic> {
    const startedAt = Date.now();
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: target.bucket }), { abortSignal: signal });
      return { ok: true, provider: this.id, latencyMs: Date.now() - startedAt };
    } catch (error) {
      const classified = classifyStorageError(error, this.id);
      return {
        ok: false,
        provider: this.id,
        latencyMs: Date.now() - startedAt,
        errorCode: classified.code,
      };
    }
  }

  async startMultipart(input: StartMultipartInput, signal?: AbortSignal): Promise<StorageMultipartSession> {
    try {
      const result = await this.client.send(new CreateMultipartUploadCommand({
        Bucket: input.target.bucket,
        Key: input.objectKey,
        ContentType: input.contentType,
      }), { abortSignal: signal });
      if (!result.UploadId) throw new StorageError("UNKNOWN", "S3 did not return an upload id", { provider: this.id });
      return {
        provider: this.id,
        logicalStorage: input.target.logicalStorage,
        bucketOrStore: input.target.bucket,
        objectKey: input.objectKey,
        uploadId: result.UploadId,
        contentType: input.contentType,
      };
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }

  async uploadPart(
    session: StorageMultipartSession,
    partNumber: number,
    body: Uint8Array,
    signal?: AbortSignal,
  ): Promise<StorageCompletedPart> {
    try {
      const result = await this.client.send(new UploadPartCommand({
        Bucket: session.bucketOrStore,
        Key: session.objectKey,
        UploadId: session.uploadId,
        PartNumber: partNumber,
        Body: body,
        ContentLength: body.byteLength,
      }), { abortSignal: signal });
      let etag = result.ETag;

      // Some S3-compatible gateways can omit the UploadPart ETag response
      // header. QuObjects supports ListParts, so recover the authoritative
      // value from the active multipart session instead of guessing a hash.
      if (!etag) {
        const listed = await this.client.send(new ListPartsCommand({
          Bucket: session.bucketOrStore,
          Key: session.objectKey,
          UploadId: session.uploadId,
          MaxParts: 10_000,
        }), { abortSignal: signal });
        etag = listed.Parts?.find((part) => part.PartNumber === partNumber)?.ETag;
      }

      if (!etag) throw new StorageError("PART_FAILED", "S3 did not expose the uploaded part ETag", { provider: this.id });
      return { partNumber, etag, size: body.byteLength };
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }

  async completeMultipart(
    session: StorageMultipartSession,
    parts: StorageCompletedPart[],
    signal?: AbortSignal,
  ): Promise<StorageObjectMetadata> {
    try {
      const ordered = [...parts].sort((left, right) => left.partNumber - right.partNumber);
      const result = await this.client.send(new CompleteMultipartUploadCommand({
        Bucket: session.bucketOrStore,
        Key: session.objectKey,
        UploadId: session.uploadId,
        MultipartUpload: {
          Parts: ordered.map((part) => ({ ETag: part.etag, PartNumber: part.partNumber })),
        },
      }), { abortSignal: signal });
      return {
        provider: this.id,
        logicalStorage: session.logicalStorage,
        bucketOrStore: session.bucketOrStore,
        objectKey: session.objectKey,
        size: ordered.reduce((total, part) => total + part.size, 0),
        contentType: session.contentType,
        etag: result.ETag,
        providerIdentifier: result.VersionId,
      };
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }

  async abortMultipart(session: StorageMultipartSession, signal?: AbortSignal): Promise<void> {
    try {
      await this.client.send(new AbortMultipartUploadCommand({
        Bucket: session.bucketOrStore,
        Key: session.objectKey,
        UploadId: session.uploadId,
      }), { abortSignal: signal });
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }

  async head(target: StorageTarget, objectKey: string, signal?: AbortSignal): Promise<StorageObjectMetadata> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: target.bucket, Key: objectKey }), {
        abortSignal: signal,
      });
      return {
        provider: this.id,
        logicalStorage: target.logicalStorage,
        bucketOrStore: target.bucket,
        objectKey,
        size: result.ContentLength ?? 0,
        contentType: result.ContentType ?? "application/octet-stream",
        etag: result.ETag,
        providerIdentifier: result.VersionId,
      };
    } catch (error) {
      const classified = classifyStorageError(error, this.id);
      if (classified.code !== "AUTH_FAILED") throw classified;

      // This QuObjects deployment accepts GET/PUT/DELETE but returns 403 for
      // HeadObject through the public gateway. An exact ListObjects lookup
      // retrieves size and ETag without downloading the object.
      try {
        const listed = await this.client.send(new ListObjectsCommand({
          Bucket: target.bucket,
          Prefix: objectKey,
          MaxKeys: 1,
        }), { abortSignal: signal });
        const object = listed.Contents?.find((candidate) => candidate.Key === objectKey);
        if (!object) {
          throw new StorageError("OBJECT_NOT_FOUND", "S3 object was not found", { provider: this.id });
        }
        return {
          provider: this.id,
          logicalStorage: target.logicalStorage,
          bucketOrStore: target.bucket,
          objectKey,
          size: object.Size ?? 0,
          contentType: "application/octet-stream",
          etag: object.ETag,
        };
      } catch (fallbackError) {
        throw classifyStorageError(fallbackError, this.id);
      }
    }
  }

  async download(target: StorageTarget, objectKey: string, signal?: AbortSignal): Promise<AsyncIterable<Uint8Array>> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: target.bucket, Key: objectKey }), {
        abortSignal: signal,
      });
      if (!result.Body || !(Symbol.asyncIterator in Object(result.Body))) {
        throw new StorageError("UNKNOWN", "S3 response body is not streamable", { provider: this.id });
      }
      return result.Body as AsyncIterable<Uint8Array>;
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }

  async createDownloadUrl(target: StorageTarget, objectKey: string, expiresInSeconds: number): Promise<string> {
    const client = this.client as S3Client;
    if (!(client instanceof S3Client)) {
      throw new StorageError("CONFIG_INVALID", "Signed URLs require a real S3 client", { provider: this.id });
    }
    return getSignedUrl(client, new GetObjectCommand({ Bucket: target.bucket, Key: objectKey }), {
      expiresIn: expiresInSeconds,
    });
  }

  async delete(target: StorageTarget, objectKey: string, signal?: AbortSignal): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: target.bucket, Key: objectKey }), {
        abortSignal: signal,
      });
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }

  async listObjects(
    target: StorageTarget,
    prefix: string,
    continuationToken?: string,
    limit = 100,
    signal?: AbortSignal,
  ): Promise<StorageListResult> {
    try {
      const result = await this.client.send(new ListObjectsV2Command({
        Bucket: target.bucket,
        Prefix: prefix,
        Delimiter: "/",
        ContinuationToken: continuationToken,
        MaxKeys: Math.max(1, Math.min(1_000, limit)),
      }), { abortSignal: signal });
      return {
        objects: (result.Contents ?? []).filter((item) => item.Key).map((item) => ({
          objectKey: item.Key ?? "",
          size: item.Size ?? 0,
          etag: item.ETag,
          uploadedAt: item.LastModified,
        })),
        prefixes: (result.CommonPrefixes ?? []).flatMap((item) => item.Prefix ? [item.Prefix] : []),
        continuationToken: result.IsTruncated ? result.NextContinuationToken : undefined,
      };
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }

  async copyObject(
    target: StorageTarget,
    sourceKey: string,
    destinationKey: string,
    signal?: AbortSignal,
  ): Promise<StorageObjectMetadata> {
    try {
      await this.client.send(new CopyObjectCommand({
        Bucket: target.bucket,
        CopySource: `${encodeURIComponent(target.bucket)}/${sourceKey.split("/").map(encodeURIComponent).join("/")}`,
        Key: destinationKey,
      }), { abortSignal: signal });
      return await this.head(target, destinationKey, signal);
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }

  async listMultipartUploads(
    target: StorageTarget,
    prefix: string,
    continuationToken?: string,
    signal?: AbortSignal,
  ): Promise<StorageMultipartListResult> {
    try {
      const [keyMarker, uploadIdMarker] = continuationToken?.split("\u0000") ?? [];
      const result = await this.client.send(new ListMultipartUploadsCommand({
        Bucket: target.bucket,
        Prefix: prefix,
        KeyMarker: keyMarker || undefined,
        UploadIdMarker: uploadIdMarker || undefined,
        MaxUploads: 1_000,
      }), { abortSignal: signal });
      const next = result.IsTruncated && result.NextKeyMarker
        ? `${result.NextKeyMarker}\u0000${result.NextUploadIdMarker ?? ""}`
        : undefined;
      return {
        uploads: (result.Uploads ?? []).flatMap((upload) => upload.Key && upload.UploadId ? [{
          objectKey: upload.Key,
          uploadId: upload.UploadId,
          initiatedAt: upload.Initiated,
        }] : []),
        continuationToken: next,
      };
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }

  async listUploadedParts(session: StorageMultipartSession, signal?: AbortSignal): Promise<StorageCompletedPart[]> {
    try {
      const result = await this.client.send(new ListPartsCommand({
        Bucket: session.bucketOrStore,
        Key: session.objectKey,
        UploadId: session.uploadId,
        MaxParts: 10_000,
      }), { abortSignal: signal });
      return (result.Parts ?? []).flatMap((part) => part.PartNumber && part.ETag ? [{
        partNumber: part.PartNumber,
        etag: part.ETag,
        size: part.Size ?? 0,
      }] : []);
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }

  async createUploadPartUrl(
    session: StorageMultipartSession,
    partNumber: number,
    expiresInSeconds: number,
  ): Promise<string> {
    if (!(this.client instanceof S3Client)) {
      throw new StorageError("CONFIG_INVALID", "Signed URLs require a real S3 client", { provider: this.id });
    }
    return getSignedUrl(this.client, new UploadPartCommand({
      Bucket: session.bucketOrStore,
      Key: session.objectKey,
      UploadId: session.uploadId,
      PartNumber: partNumber,
    }), { expiresIn: Math.max(30, Math.min(900, expiresInSeconds)) });
  }
}
