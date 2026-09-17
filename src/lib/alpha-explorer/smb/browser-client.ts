import { z } from "zod";

import {
  opaqueHandleSchema,
  smbGatewayEntrySchema,
  type SmbIssuedTicket,
  type SmbTicketScope,
} from "./contracts";
import {
  createPreviewObjectUrl,
  MAX_INLINE_PREVIEW_BYTES,
  nativeOfficeApplication,
  previewMimeType,
} from "../file-preview";

const supportIdSchema = z.string().uuid();
const ticketEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.object({
    token: z.string().min(32),
    expiresAt: z.string().datetime(),
    gatewayUrl: z.string().url(),
  }).strict(),
}).strict();
const gatewayErrorSchema = z.object({
  ok: z.literal(false),
  code: z.string(),
  supportId: supportIdSchema,
}).passthrough();

export class SmbGatewayError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly supportId?: string,
  ) {
    super(code);
    this.name = "SmbGatewayError";
  }
}

async function requestTicket(input: {
  scope: SmbTicketScope;
  resource?: string;
  maxBytes?: number | null;
  offsetBytes?: number | null;
  destinationHandle?: string | null;
  targetName?: string | null;
}, signal?: AbortSignal): Promise<SmbIssuedTicket> {
  const response = await fetch("/api/alpha-explorer/smb/ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: input.scope,
      resource: input.resource ?? "root",
      maxBytes: input.maxBytes ?? null,
      offsetBytes: input.offsetBytes ?? null,
      destinationHandle: input.destinationHandle ?? null,
      targetName: input.targetName ?? null,
    }),
    signal,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = z.object({ code: z.string().optional(), supportId: z.string().optional() }).passthrough().safeParse(payload);
    throw new SmbGatewayError(parsed.success ? parsed.data.code ?? "SMB_TICKET_FAILED" : "SMB_TICKET_FAILED", response.status, parsed.success ? parsed.data.supportId : undefined);
  }
  return ticketEnvelopeSchema.parse(payload).data;
}

async function gatewayRequest(
  ticket: SmbIssuedTicket,
  pathname: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(new URL(pathname, ticket.gatewayUrl), {
    ...init,
    headers: { Authorization: `Bearer ${ticket.token}`, ...init.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    const payload: unknown = await response.clone().json().catch(() => null);
    const parsed = gatewayErrorSchema.safeParse(payload);
    throw new SmbGatewayError(parsed.success ? parsed.data.code : "SMB_GATEWAY_FAILED", response.status, parsed.success ? parsed.data.supportId : undefined);
  }
  return response;
}

async function gatewayJson<T>(ticket: SmbIssuedTicket, pathname: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const response = await gatewayRequest(ticket, pathname, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  return schema.parse(await response.json());
}

const linkStatusSchema = z.object({ linked: z.boolean(), supportId: supportIdSchema }).strict();
const mutationSchema = z.object({ ok: z.literal(true), supportId: supportIdSchema }).passthrough();
const listSchema = z.object({
  entries: z.array(smbGatewayEntrySchema).max(200),
  nextCursor: z.string().nullable(),
  supportId: supportIdSchema,
}).strict();
const uploadStartSchema = z.object({
  sessionHandle: opaqueHandleSchema,
  receivedSize: z.number().int().nonnegative(),
  expectedSize: z.number().int().nonnegative(),
  supportId: supportIdSchema,
}).strict();
const uploadChunkSchema = z.object({
  receivedSize: z.number().int().nonnegative(),
  expectedSize: z.number().int().nonnegative(),
  supportId: supportIdSchema,
}).strict();
const trashListSchema = z.object({
  items: z.array(z.object({
    trashHandle: opaqueHandleSchema,
    name: z.string().min(1).max(255),
  }).strict()).max(200),
  nextCursor: z.string().nullable(),
  supportId: supportIdSchema,
}).strict();
const officeSessionSchema = z.object({
  application: z.enum(["word", "excel"]),
  documentPath: z.string().regex(/^\/v1\/office\/files\/o_[A-Za-z0-9_-]{32,128}\/[A-Za-z0-9%._~-]+$/),
  expiresAt: z.string().datetime(),
  supportId: supportIdSchema,
}).strict();

export async function getSmbLinkStatus(signal?: AbortSignal): Promise<boolean> {
  const ticket = await requestTicket({ scope: "link_status" }, signal);
  return (await gatewayJson(ticket, "/v1/link", linkStatusSchema, { signal })).linked;
}

export async function listSmbItems(handle = "root", cursor?: string, signal?: AbortSignal) {
  const ticket = await requestTicket({ scope: "list", resource: handle }, signal);
  const offset = cursor ? Number(cursor) : 0;
  if (!Number.isSafeInteger(offset) || offset < 0) throw new SmbGatewayError("INVALID_CURSOR", 400);
  return gatewayJson(ticket, `/v1/items?handle=${encodeURIComponent(handle)}&limit=100&offset=${offset}`, listSchema, { signal });
}

export async function createSmbDirectory(parentHandle: string, name: string, signal?: AbortSignal): Promise<void> {
  const ticket = await requestTicket({ scope: "mkdir", resource: parentHandle, targetName: name }, signal);
  await gatewayJson(ticket, "/v1/directories", mutationSchema, {
    method: "POST",
    body: JSON.stringify({ name }),
    signal,
  });
}

export async function openSmbDownload(
  handle: string,
  signal?: AbortSignal,
  maxBytes = 2 * 1024 * 1024 * 1024,
): Promise<Response> {
  const ticket = await requestTicket({ scope: "download", resource: handle, maxBytes }, signal);
  return gatewayRequest(ticket, "/v1/files/download", { method: "GET", signal });
}

export async function loadSmbPreview(handle: string, fileName: string, signal?: AbortSignal): Promise<string> {
  const mimeType = previewMimeType(fileName);
  if (!mimeType) throw new SmbGatewayError("SMB_PREVIEW_UNSUPPORTED", 415);
  const response = await openSmbDownload(handle, signal, MAX_INLINE_PREVIEW_BYTES);
  return createPreviewObjectUrl(response, fileName);
}

export async function openSmbOfficeDocument(input: {
  handle: string;
  fileName: string;
  sizeBytes: number | null;
  signal?: AbortSignal;
}): Promise<void> {
  const application = nativeOfficeApplication(input.fileName);
  if (!application || input.sizeBytes === null) throw new SmbGatewayError("OFFICE_FILE_UNSUPPORTED", 415);
  const ticket = await requestTicket({
    scope: "office_open",
    resource: input.handle,
    maxBytes: input.sizeBytes,
    targetName: input.fileName,
  }, input.signal);
  const session = await gatewayJson(ticket, "/v1/office/sessions", officeSessionSchema, {
    method: "POST",
    body: JSON.stringify({ name: input.fileName }),
    signal: input.signal,
  });
  if (session.application !== application) throw new SmbGatewayError("OFFICE_APPLICATION_MISMATCH", 502, session.supportId);
  const gatewayOrigin = new URL(ticket.gatewayUrl).origin;
  const documentUrl = new URL(session.documentPath, ticket.gatewayUrl);
  if (documentUrl.origin !== gatewayOrigin) throw new SmbGatewayError("OFFICE_DOCUMENT_URL_INVALID", 502, session.supportId);
  window.location.assign(`ms-${application}:ofv|u|${documentUrl.href}`);
}

interface WritableFileHandle {
  createWritable(): Promise<WritableStream<Uint8Array>>;
}

function isWritableFileHandle(value: unknown): value is WritableFileHandle {
  return typeof value === "object" && value !== null && "createWritable" in value
    && typeof Reflect.get(value, "createWritable") === "function";
}

export async function saveSmbDownload(handle: string, suggestedName: string, signal?: AbortSignal): Promise<void> {
  const picker = Reflect.get(window, "showSaveFilePicker");
  if (typeof picker !== "function") {
    throw new SmbGatewayError("FILE_SYSTEM_ACCESS_REQUIRED", 501);
  }
  const selected: unknown = await Reflect.apply(picker, window, [{ suggestedName }]);
  if (!isWritableFileHandle(selected)) throw new SmbGatewayError("INVALID_FILE_HANDLE", 500);
  const response = await openSmbDownload(handle, signal);
  if (!response.body) throw new SmbGatewayError("SMB_DOWNLOAD_STREAM_UNAVAILABLE", 503);
  const writable = await selected.createWritable();
  await response.body.pipeTo(writable, { signal });
}

export interface SmbUploadProgress {
  sentBytes: number;
  totalBytes: number;
}

export async function uploadSmbFile(input: {
  parentHandle: string;
  file: File;
  signal?: AbortSignal;
  onProgress?: (progress: SmbUploadProgress) => void;
}): Promise<void> {
  const { parentHandle, file, signal, onProgress } = input;
  const startTicket = await requestTicket({ scope: "upload_start", resource: parentHandle, maxBytes: file.size, targetName: file.name }, signal);
  const started = await gatewayJson(startTicket, "/v1/uploads", uploadStartSchema, {
    method: "POST",
    body: JSON.stringify({ name: file.name, expectedSize: file.size }),
    signal,
  });
  const sessionHandle = started.sessionHandle;
  const chunkSize = 8 * 1024 * 1024;
  let offset = started.receivedSize;
  try {
    while (offset < file.size) {
      const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
      const chunkTicket = await requestTicket({ scope: "upload_chunk", resource: sessionHandle, maxBytes: chunk.size, offsetBytes: offset }, signal);
      const result = await gatewayJson(chunkTicket, `/v1/uploads/${encodeURIComponent(sessionHandle)}/chunks`, uploadChunkSchema, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: chunk,
        signal,
      });
      offset = result.receivedSize;
      onProgress?.({ sentBytes: offset, totalBytes: file.size });
    }
    const commitTicket = await requestTicket({ scope: "upload_commit", resource: sessionHandle }, signal);
    await gatewayJson(commitTicket, `/v1/uploads/${encodeURIComponent(sessionHandle)}/commit`, mutationSchema, { method: "POST", signal });
  } catch (error) {
    try {
      const cancelTicket = await requestTicket({ scope: "upload_cancel", resource: sessionHandle });
      await gatewayJson(cancelTicket, `/v1/uploads/${encodeURIComponent(sessionHandle)}`, mutationSchema, { method: "DELETE" });
    } catch {
      // A reconciliação operacional tratará sessão que não pôde ser cancelada.
    }
    throw error;
  }
}

export async function renameOrMoveSmbItem(input: {
  scope: "rename" | "move";
  sourceHandle: string;
  destinationHandle: string;
  name: string;
  signal?: AbortSignal;
}): Promise<void> {
  const ticket = await requestTicket({
    scope: input.scope,
    resource: input.sourceHandle,
    destinationHandle: input.scope === "move" ? input.destinationHandle : null,
    targetName: input.name,
  }, input.signal);
  await gatewayJson(ticket, `/v1/items/${input.scope}`, mutationSchema, {
    method: "POST",
    body: JSON.stringify(input.scope === "move"
      ? { destinationHandle: input.destinationHandle, name: input.name }
      : { name: input.name }),
    signal: input.signal,
  });
}

export async function trashSmbItem(handle: string, signal?: AbortSignal): Promise<string> {
  const ticket = await requestTicket({ scope: "trash", resource: handle }, signal);
  const schema = z.object({ trashHandle: opaqueHandleSchema, supportId: supportIdSchema }).strict();
  return (await gatewayJson(ticket, "/v1/items/trash", schema, { method: "DELETE", signal })).trashHandle;
}

export async function listSmbTrash(cursor?: string, signal?: AbortSignal) {
  const offset = cursor ? Number(cursor) : 0;
  if (!Number.isSafeInteger(offset) || offset < 0) throw new SmbGatewayError("INVALID_CURSOR", 400);
  const ticket = await requestTicket({ scope: "trash_list" }, signal);
  return gatewayJson(ticket, `/v1/trash?limit=100&offset=${offset}`, trashListSchema, { signal });
}

export async function restoreSmbItem(trashHandle: string, signal?: AbortSignal): Promise<void> {
  const ticket = await requestTicket({ scope: "restore", resource: trashHandle }, signal);
  await gatewayJson(ticket, `/v1/items/${encodeURIComponent(trashHandle)}/restore`, mutationSchema, { method: "POST", signal });
}
