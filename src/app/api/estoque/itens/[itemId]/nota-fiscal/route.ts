import { createHash } from "node:crypto";
import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import db from "@/lib/prisma";
import { getInventoryActor } from "@/lib/estoque/authorization";
import {
  DEFAULT_INVENTORY_INVOICE_MAX_BYTES,
  hasValidInventoryInvoiceSignature,
  INVENTORY_INVOICE_ALLOWED_TYPES,
  INVENTORY_INVOICE_OBJECT_KEY_MARKER,
  inventoryInvoiceObjectKey,
  validateInventoryInvoiceMetadata,
} from "@/lib/estoque/documents";
import { INVENTORY_IMAGE_STORAGE_PROVIDER } from "@/lib/estoque/images";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ itemId: string }> };

function responseError(error: string, status: number) { return NextResponse.json({ success: false, error }, { status }); }
function blobToken() { const token = process.env.BLOB_READ_WRITE_TOKEN?.trim(); if (!token) throw new Error("BLOB_READ_WRITE_TOKEN não configurado"); return token; }
function validItemId(itemId: string) { return itemId.length > 0 && itemId.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(itemId); }
function auditDetails(details: Record<string, unknown>) { return JSON.stringify(details).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 1_500); }

async function deleteIfUnreferenced(url: string) {
  const references = await db.inventoryImage.count({ where: { url, deletedAt: null } });
  if (references === 0) await del(url, { token: blobToken() });
}

export async function POST(request: Request, { params }: RouteContext) {
  const actor = await getInventoryActor();
  if (!actor?.canManage) return responseError("Sem permissão para alterar anexos do estoque.", 403);
  const { itemId } = await params;
  if (!validItemId(itemId)) return responseError("Item inválido.", 400);
  const item = await db.produtoEstoque.findFirst({ where: { id: itemId, archivedAt: null }, select: { id: true } });
  if (!item) return responseError("Item não encontrado ou arquivado.", 404);

  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > DEFAULT_INVENTORY_INVOICE_MAX_BYTES) return responseError("A nota fiscal deve ter no máximo 8 MB.", 413);
  if (!INVENTORY_INVOICE_ALLOWED_TYPES.includes(contentType as (typeof INVENTORY_INVOICE_ALLOWED_TYPES)[number])) return responseError("Use PDF, PNG, JPG/JPEG ou WebP.", 415);

  let uploadedUrl: string | null = null;
  try {
    const encodedFilename = request.headers.get("x-file-name");
    if (!encodedFilename) return responseError("Informe o nome original do arquivo.", 400);
    let filename = "";
    try { filename = decodeURIComponent(encodedFilename); } catch { return responseError("Nome de arquivo inválido.", 400); }
    const body = await request.blob();
    const metadataError = validateInventoryInvoiceMetadata({ name: filename, type: body.type || contentType, size: body.size });
    if (metadataError) return responseError(metadataError, body.size > DEFAULT_INVENTORY_INVOICE_MAX_BYTES ? 413 : 400);
    const bytes = new Uint8Array(await body.arrayBuffer());
    if (!hasValidInventoryInvoiceSignature(contentType, bytes.slice(0, 12))) return responseError("O conteúdo não corresponde a um PDF ou imagem válida.", 400);

    const objectKey = inventoryInvoiceObjectKey(itemId, contentType);
    const uploaded = await put(objectKey, Buffer.from(bytes), { access: "public", addRandomSuffix: false, contentType, token: blobToken() });
    uploadedUrl = uploaded.url;
    const previousUrls = await db.$transaction(async (tx) => {
      const previous = await tx.inventoryImage.findMany({
        where: { produtoId: itemId, isPrimary: false, deletedAt: null, objectKey: { contains: INVENTORY_INVOICE_OBJECT_KEY_MARKER } },
        select: { id: true, url: true },
      });
      if (previous.length) await tx.inventoryImage.updateMany({ where: { id: { in: previous.map((document) => document.id) } }, data: { deletedAt: new Date() } });
      await tx.inventoryImage.create({ data: {
        produtoId: itemId, storageProvider: INVENTORY_IMAGE_STORAGE_PROVIDER, objectKey: uploaded.pathname,
        url: uploaded.url, mimeType: contentType, sizeBytes: bytes.byteLength,
        checksum: createHash("sha256").update(bytes).digest("hex"), isPrimary: false, uploadedById: actor.userId,
      } });
      await tx.auditoria.create({ data: { userId: actor.userId, acao: "ESTOQUE_NOTA_FISCAL_ATUALIZADA", detalhes: auditDetails({ itemId, tipo: contentType, substituiuArquivo: previous.length > 0 }) } });
      return previous.map((document) => document.url);
    });
    for (const previousUrl of previousUrls) await deleteIfUnreferenced(previousUrl).catch(() => undefined);
    return NextResponse.json({ success: true, url: uploaded.url });
  } catch (error) {
    if (uploadedUrl) await del(uploadedUrl, { token: blobToken() }).catch(() => undefined);
    console.error("[POST_ESTOQUE_NOTA_FISCAL]", error instanceof Error ? error.message : "Falha desconhecida");
    return responseError("Não foi possível salvar a nota fiscal. O cadastro anterior foi preservado.", 500);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const actor = await getInventoryActor();
  if (!actor?.canManage) return responseError("Sem permissão para alterar anexos do estoque.", 403);
  const { itemId } = await params;
  if (!validItemId(itemId)) return responseError("Item inválido.", 400);
  const existing = await db.inventoryImage.findFirst({ where: { produtoId: itemId, isPrimary: false, deletedAt: null, objectKey: { contains: INVENTORY_INVOICE_OBJECT_KEY_MARKER } }, select: { id: true, url: true } });
  if (!existing) return NextResponse.json({ success: true });
  await db.$transaction(async (tx) => {
    await tx.inventoryImage.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await tx.auditoria.create({ data: { userId: actor.userId, acao: "ESTOQUE_NOTA_FISCAL_REMOVIDA", detalhes: auditDetails({ itemId }) } });
  });
  await deleteIfUnreferenced(existing.url).catch(() => undefined);
  return NextResponse.json({ success: true });
}
