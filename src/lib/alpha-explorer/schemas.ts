import { z } from "zod";

import { EXPLORER_CAPABILITIES } from "@/lib/alpha-explorer/capabilities";
import { STORAGE_MAX_OBJECT_SIZE } from "@/lib/storage/contracts";

export const explorerPathSchema = z.string().max(1_024);
export const explorerNameSchema = z.string().trim().min(1).max(240);
export const explorerIdSchema = z.string().cuid();

export const listExplorerSchema = z.object({
  path: explorerPathSchema.default(""),
  query: z.string().trim().max(120).default(""),
  sort: z.enum(["name", "size", "createdAt"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  trash: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
});

export const createFolderSchema = z.object({ path: explorerPathSchema, name: explorerNameSchema }).strict();

export const initiateUploadSchema = z.object({
  path: explorerPathSchema,
  name: explorerNameSchema,
  size: z.number().int().min(1).max(STORAGE_MAX_OBJECT_SIZE),
  mime: z.string().trim().min(1).max(200).default("application/octet-stream"),
}).strict();
export const signPartsSchema = z.object({
  partNumbers: z.array(z.number().int().min(1).max(10_000)).min(1).max(4),
}).strict();

export const completeUploadSchema = z.object({
  parts: z.array(z.object({
    partNumber: z.number().int().min(1).max(10_000),
    etag: z.string().trim().min(1).max(512),
    size: z.number().int().min(1),
  }).strict()).min(1).max(10_000),
}).strict();

export const blobCompleteSchema = z.object({}).strict();

export const itemActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), name: explorerNameSchema, version: z.number().int().positive() }).strict(),
  z.object({ action: z.literal("move"), destinationPath: explorerPathSchema, version: z.number().int().positive() }).strict(),
  z.object({ action: z.literal("delete"), version: z.number().int().positive() }).strict(),
  z.object({ action: z.literal("restore"), version: z.number().int().positive() }).strict(),
]);

export const aclSchema = z.object({
  subjectType: z.enum(["USER", "ROLE", "CARGO"]),
  subjectId: z.string().trim().min(1).max(120),
  prefix: explorerPathSchema,
  capabilities: z.array(z.enum(EXPLORER_CAPABILITIES)).min(1).max(EXPLORER_CAPABILITIES.length),
}).strict();
