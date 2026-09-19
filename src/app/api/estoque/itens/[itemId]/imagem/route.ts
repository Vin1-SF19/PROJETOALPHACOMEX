import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import db from "@/lib/prisma";
import { getInventoryActor } from "@/lib/estoque/authorization";
import {
  getInventoryImageMaxBytes,
  hasValidInventoryImageSignature,
  INVENTORY_IMAGE_ALLOWED_TYPES,
  INVENTORY_IMAGE_STORAGE_PROVIDER,
  inventoryImageObjectKey,
  validateInventoryImageMetadata,
} from "@/lib/estoque/images";
import { InventoryImageDecodeError, prepareInventoryImageForStorage } from "@/lib/estoque/images-server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };

function responseError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN não configurado");
  return token;
}

function auditDetails(details: Record<string, unknown>): string {
  return JSON.stringify(details).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 1_500);
}

async function removeManagedBlob(url: string): Promise<void> {
  await del(url, { token: blobToken() });
}

async function deleteIfUnreferenced(url: string): Promise<void> {
  const [imageReferences, productReferences] = await Promise.all([
    db.inventoryImage.count({ where: { url, deletedAt: null } }),
    db.produtoEstoque.count({ where: { imagem: url } }),
  ]);
  if (imageReferences === 0 && productReferences === 0) await removeManagedBlob(url);
}

function isValidItemId(itemId: string): boolean {
  return itemId.length > 0 && itemId.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(itemId);
}

export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const actor = await getInventoryActor();
  if (!actor?.canManage) return responseError("Sem permissão para alterar fotos do estoque.", 403);

  const { itemId } = await params;
  if (!isValidItemId(itemId)) return responseError("Item inválido.", 400);
  const item = await db.produtoEstoque.findFirst({
    where: { id: itemId, archivedAt: null },
    select: { id: true },
  });
  if (!item) return responseError("Item não encontrado ou arquivado.", 404);

  const maxBytes = getInventoryImageMaxBytes();
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > maxBytes) return responseError(`A imagem deve ter no máximo ${Math.ceil(maxBytes / 1024 / 1024)} MB.`, 413);
  if (!INVENTORY_IMAGE_ALLOWED_TYPES.includes(contentType as (typeof INVENTORY_IMAGE_ALLOWED_TYPES)[number])) {
    return responseError("Use uma imagem PNG, JPG/JPEG ou WebP.", 415);
  }

  let uploadedUrl: string | null = null;
  try {
    const body = await request.blob();
    let filename: string | undefined;
    const encodedFilename = request.headers.get("x-file-name");
    if (!encodedFilename) return responseError("Informe o nome original do arquivo.", 400);
    try {
      filename = decodeURIComponent(encodedFilename);
    } catch {
      return responseError("Nome de arquivo inválido.", 400);
    }
    const metadataError = validateInventoryImageMetadata(
      { name: filename, type: body.type || contentType, size: body.size },
      maxBytes,
    );
    if (metadataError) {
      return responseError(metadataError, body.size > maxBytes ? 413 : 400);
    }
    const signature = new Uint8Array(await body.slice(0, 12).arrayBuffer());
    if (!hasValidInventoryImageSignature(body.type || contentType, signature)) {
      return responseError("O conteúdo do arquivo não corresponde a uma imagem válida.", 400);
    }

    const prepared = await prepareInventoryImageForStorage(
      new Uint8Array(await body.arrayBuffer()),
      contentType,
    );

    const objectKey = inventoryImageObjectKey(itemId, prepared.mimeType);
    const uploaded = await put(objectKey, prepared.bytes, {
      access: "public",
      addRandomSuffix: false,
      contentType: prepared.mimeType,
      token: blobToken(),
    });
    uploadedUrl = uploaded.url;

    const replacedUrls = await db.$transaction(async (tx) => {
      const current = await tx.produtoEstoque.findFirst({
        where: { id: itemId, archivedAt: null },
        select: { imagem: true },
      });
      if (!current) throw new Error("Item não encontrado ou arquivado.");

      const managedPrevious = current.imagem
        ? await tx.inventoryImage.findFirst({
            where: { produtoId: itemId, url: current.imagem, deletedAt: null },
            select: { id: true, url: true },
          })
        : null;

      await tx.inventoryImage.updateMany({
        where: { produtoId: itemId, isPrimary: true, deletedAt: null },
        data: { isPrimary: false, deletedAt: new Date() },
      });
      await tx.inventoryImage.create({
        data: {
          produtoId: itemId,
          storageProvider: INVENTORY_IMAGE_STORAGE_PROVIDER,
          objectKey: uploaded.pathname,
          url: uploaded.url,
          mimeType: prepared.mimeType,
          sizeBytes: prepared.bytes.byteLength,
          isPrimary: true,
          uploadedById: actor.userId,
        },
      });
      await tx.produtoEstoque.update({ where: { id: itemId }, data: { imagem: uploaded.url, updatedById: actor.userId } });
      await tx.auditoria.create({
        data: {
          userId: actor.userId,
          acao: "ESTOQUE_FOTO_ATUALIZADA",
          detalhes: auditDetails({ itemId, imagemAnteriorGerenciada: Boolean(managedPrevious) }),
        },
      });
      return managedPrevious ? [managedPrevious.url] : [];
    });

    for (const previousUrl of replacedUrls) {
      await deleteIfUnreferenced(previousUrl).catch((error) => {
        console.error("[ESTOQUE_IMAGE_CLEANUP]", error instanceof Error ? error.message : "Falha ao limpar blob anterior");
      });
    }
    return NextResponse.json({ success: true, url: uploaded.url });
  } catch (error) {
    if (uploadedUrl) {
      await removeManagedBlob(uploadedUrl).catch(() => undefined);
    }
    if (error instanceof InventoryImageDecodeError) return responseError(error.message, 400);
    console.error("[POST_ESTOQUE_IMAGEM]", error instanceof Error ? error.message : "Falha desconhecida");
    return responseError("Não foi possível salvar a foto. O cadastro anterior foi preservado.", 500);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const actor = await getInventoryActor();
  if (!actor?.canManage) return responseError("Sem permissão para alterar fotos do estoque.", 403);

  const { itemId } = await params;
  if (!isValidItemId(itemId)) return responseError("Item inválido.", 400);
  try {
    const managedUrl = await db.$transaction(async (tx) => {
      const item = await tx.produtoEstoque.findFirst({
        where: { id: itemId, archivedAt: null },
        select: { imagem: true },
      });
      if (!item) throw new Error("ITEM_NOT_FOUND");
      if (!item.imagem) return null;

      const managedImage = await tx.inventoryImage.findFirst({
        where: { produtoId: itemId, url: item.imagem, deletedAt: null },
        select: { id: true, url: true },
      });
      await tx.produtoEstoque.update({ where: { id: itemId }, data: { imagem: null, updatedById: actor.userId } });
      if (managedImage) {
        await tx.inventoryImage.update({
          where: { id: managedImage.id },
          data: { isPrimary: false, deletedAt: new Date() },
        });
      }
      await tx.auditoria.create({
        data: {
          userId: actor.userId,
          acao: "ESTOQUE_FOTO_REMOVIDA",
          detalhes: auditDetails({ itemId, imagemGerenciada: Boolean(managedImage) }),
        },
      });
      return managedImage?.url ?? null;
    });

    if (managedUrl) {
      await deleteIfUnreferenced(managedUrl).catch((error) => {
        console.error("[ESTOQUE_IMAGE_CLEANUP]", error instanceof Error ? error.message : "Falha ao limpar blob removido");
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "ITEM_NOT_FOUND") return responseError("Item não encontrado ou arquivado.", 404);
    console.error("[DELETE_ESTOQUE_IMAGEM]", error instanceof Error ? error.message : "Falha desconhecida");
    return responseError("Não foi possível remover a foto. O cadastro anterior foi preservado.", 500);
  }
}
