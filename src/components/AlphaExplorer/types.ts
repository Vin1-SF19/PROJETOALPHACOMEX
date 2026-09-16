import { z } from "zod";

export interface ExplorerItemView {
  id: string;
  kind: "FILE" | "FOLDER";
  name: string;
  logicalPath: string;
  parentPath: string;
  provider: string | null;
  providerLabel: string | null;
  sizeBytes: number | null;
  validatedMime: string | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ExplorerListData {
  items: ExplorerItemView[];
  total: number;
  page: number;
  limit: number;
}

export const explorerItemViewSchema = z.object({
  id: z.string(), kind: z.enum(["FILE", "FOLDER"]), name: z.string(), logicalPath: z.string(), parentPath: z.string(),
  provider: z.string().nullable(), providerLabel: z.string().nullable(), sizeBytes: z.number().nullable(),
  validatedMime: z.string().nullable(), status: z.string(), version: z.number(), createdAt: z.string(), updatedAt: z.string(), deletedAt: z.string().nullable(),
});

export const explorerListDataSchema = z.object({ items: z.array(explorerItemViewSchema), total: z.number(), page: z.number(), limit: z.number() });

export async function explorerFetch<T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload: unknown = await response.json();
  const envelope = z.object({ success: z.boolean(), data: z.unknown().optional(), error: z.string().optional(), supportId: z.string().optional() }).safeParse(payload);
  if (!envelope.success) throw new Error("Resposta inválida");
  if (!response.ok || !envelope.data.success) {
    throw new Error(`${envelope.data.error ?? "Operação não concluída"}${envelope.data.supportId ? ` · suporte ${envelope.data.supportId}` : ""}`);
  }
  return schema.parse(envelope.data.data);
}
