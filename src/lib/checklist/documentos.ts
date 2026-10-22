import { randomBytes, randomUUID, createHash } from "node:crypto";
import db from "@/lib/prisma";
import type { AtorChecklist } from "./types";
import {
  exigirEmpresaChecklist,
  exigirEscritaChecklist,
  type Tx,
} from "./acesso";
import { fail } from "./result";
import { idSchema, comandoSchema } from "./schemas";
import { z } from "zod";
import {
  storageDriver,
  storageConfig,
  lerStreamLimitado,
  legacyUrlPermitida,
  nomeArquivoSeguro,
  type ChecklistStorage,
} from "./storage";
import { executarAtendimento } from "./commands";
import { documentoDTO } from "./leitura";
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export function detectarMime(bytes: Uint8Array) {
  if (
    bytes.length >= 5 &&
    Buffer.from(bytes.subarray(0, 5)).toString() === "%PDF-"
  )
    return "application/pdf";
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    Buffer.from(bytes.subarray(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  )
    return "image/png";
  fail("UPLOAD_INVALID", "Envie PDF, JPEG ou PNG válido.");
}
async function autorizarItem(tx: Tx, ator: AtorChecklist, itemId: string) {
  const item = await tx.itemChecklist.findUnique({
    where: { id: itemId },
    include: { checklist: { select: { empresaId: true, tipo: true } } },
  });
  if (!item) fail("NOT_FOUND", "Item não encontrado.");
  const empresa =
    ator.kind === "INTERNO"
      ? await exigirEscritaChecklist(tx, ator, item.checklist.empresaId)
      : await exigirEmpresaChecklist(tx, ator, item.checklist.empresaId);
  if (item.checklist.tipo !== empresa.tipo)
    fail("FORBIDDEN", "Checklist histórico é somente leitura.");
  return { item, empresa };
}
export async function prepararUpload(
  ator: AtorChecklist,
  input: {
    itemId: string;
    nome: string;
    mime: string;
    body: ReadableStream<Uint8Array>;
    signal?: AbortSignal;
  },
  driver?: ChecklistStorage,
) {
  idSchema.parse(input.itemId);
  z.string().trim().min(1).max(180).parse(input.nome);
  await autorizarItem(db, ator, input.itemId);
  const bytes = await lerStreamLimitado(
    input.body,
    MAX_UPLOAD_BYTES,
    input.signal,
  );
  if (!bytes.length) fail("UPLOAD_INVALID", "Arquivo vazio.");
  const mime = detectarMime(bytes);
  if (mime !== input.mime.split(";")[0])
    fail("UPLOAD_INVALID", "Tipo informado difere do conteúdo.");
  const storage = driver ?? storageDriver();
  const prefix = driver ? "synthetic/checklist/" : storageConfig().prefix;
  const storageKey = prefix + randomUUID();
  await storage.put(storageKey, bytes, mime);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  await db.$transaction(async (tx) => {
    const { empresa } = await autorizarItem(tx, ator, input.itemId);
    await tx.checklistUploadRecibo.create({
      data: {
        tokenHash: createHash("sha256").update(token).digest("hex"),
        empresaId: empresa.id,
        itemId: input.itemId,
        usuarioId: ator.kind === "INTERNO" ? ator.id : null,
        clienteOperacionalId: ator.kind === "PORTAL" ? ator.id : null,
        storageProvider: "VERCEL_BLOB",
        storageKey,
        storageAccess: "private",
        nome: nomeArquivoSeguro(input.nome),
        tamanhoBytes: bytes.length,
        mimeType: mime,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        expiresAt,
      },
    });
  });
  return {
    recibo: token,
    nome: nomeArquivoSeguro(input.nome),
    mimeType: mime,
    tamanhoBytes: bytes.length,
    expiresAt,
  };
}
export async function registrarDocumento(ator: AtorChecklist, input: unknown) {
  const c = comandoSchema
    .extend({ itemId: idSchema, recibo: z.string().min(32).max(100) })
    .parse(input);
  const { empresa } = await autorizarItem(db, ator, c.itemId);
  const tokenHash = createHash("sha256").update(c.recibo).digest("hex");
  let documentId: string | undefined;
  await executarAtendimento(
    ator,
    { ...c, empresaId: empresa.id },
    {
      itemId: c.itemId,
      mutationId: c.mutationId,
      expectedRevision: c.expectedRevision,
      reciboHash: tokenHash,
    },
    "CHECKLIST_DOCUMENTO_ADICIONADO",
    async (tx) => {
      await autorizarItem(tx, ator, c.itemId);
      const r = await tx.checklistUploadRecibo.findUnique({
        where: { tokenHash },
      });
      if (
        !r ||
        r.itemId !== c.itemId ||
        r.empresaId !== empresa.id ||
        r.usuarioId !== (ator.kind === "INTERNO" ? ator.id : null) ||
        r.clienteOperacionalId !== (ator.kind === "PORTAL" ? ator.id : null) ||
        r.storageAccess !== "private"
      )
        fail("UPLOAD_INVALID", "Recibo não pertence a este item ou usuário.");
      if (!r.sha256)
        fail(
          "UPLOAD_INVALID",
          "Finalize a verificação do arquivo antes de registrar.",
        );
      if (r.documentoId) {
        documentId = r.documentoId;
        return { changed: false };
      }
      if (r.expiresAt.getTime() < Date.now())
        fail("UPLOAD_INVALID", "Recibo expirou. Envie novamente.");
      const d = await tx.documentoChecklist.create({
        data: {
          itemId: r.itemId,
          nome: r.nome,
          url: "",
          storageProvider: r.storageProvider,
          storageKey: r.storageKey,
          storageAccess: "private",
          tamanhoBytes: r.tamanhoBytes,
          mimeType: r.mimeType,
          sha256: r.sha256,
          uploadedByCliente: ator.kind === "PORTAL",
          uploadedByUsuarioId: ator.kind === "INTERNO" ? ator.id : null,
          uploadedByContaId: ator.kind === "PORTAL" ? ator.id : null,
        },
      });
      const used = await tx.checklistUploadRecibo.updateMany({
        where: { id: r.id, consumidoEm: null, documentoId: null },
        data: { documentoId: d.id, consumidoEm: new Date() },
      });
      if (used.count !== 1) fail("CONFLICT", "Recibo já foi consumido.");
      documentId = d.id;
      return { changed: true, dados: { documentoId: d.id, itemId: c.itemId } };
    },
    ator.kind === "PORTAL",
  );
  if (!documentId) {
    const r = await db.checklistUploadRecibo.findUnique({
      where: { tokenHash },
      select: { documentoId: true },
    });
    documentId = r?.documentoId ?? undefined;
  }
  if (!documentId) fail("UPLOAD_INVALID", "Documento não encontrado.");
  return documentoDTO(
    await db.documentoChecklist.findUniqueOrThrow({
      where: { id: documentId },
    }),
  );
}
export async function abrirDocumento(
  ator: AtorChecklist,
  id: string,
  signal = AbortSignal.timeout(10_000),
  driver?: ChecklistStorage,
) {
  const d = await db.documentoChecklist.findUnique({
    where: { id: idSchema.parse(id) },
    include: {
      item: { select: { checklist: { select: { empresaId: true } } } },
    },
  });
  if (!d) fail("NOT_FOUND", "Documento não encontrado.");
  await exigirEmpresaChecklist(db, ator, d.item.checklist.empresaId);
  if (ator.kind === "PORTAL" && d.deletadoEm)
    fail("FORBIDDEN", "Documento removido.");
  const source =
    d.storageAccess === "private" && d.storageKey
      ? await (driver ?? storageDriver()).get(d.storageKey, signal)
      : await (async () => {
          const url = legacyUrlPermitida(d.url);
          const r = await fetch(url, {
            redirect: "error",
            signal,
            cache: "no-store",
          });
          if (!r.ok || !r.body) fail("NOT_FOUND", "Arquivo indisponível.");
          return {
            body: r.body,
            mime: r.headers.get("content-type") ?? "application/octet-stream",
            size: Number(r.headers.get("content-length") ?? 0),
          };
        })();
  if (source.size > 25 * 1024 * 1024) {
    await source.body.cancel();
    fail("LIMIT_EXCEEDED", "Arquivo excede 25 MiB.");
  }
  return { ...source, nome: d.nome, empresaId: d.item.checklist.empresaId };
}

const iniciarDiretoSchema = z.object({
  itemId: idSchema,
  nome: z.string().trim().min(1).max(180),
  mime: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  tamanhoBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});
export async function iniciarUploadDireto(
  ator: AtorChecklist,
  input: unknown,
  emitirToken?: (
    pathname: string,
    mime: string,
    expiresAt: Date,
  ) => Promise<string>,
) {
  const c = iniciarDiretoSchema.parse(input);
  const { token: storeToken, prefix } = storageConfig();
  const token = randomBytes(32).toString("base64url"),
    pathname = prefix + randomUUID(),
    expiresAt = new Date(Date.now() + 15 * 60000);
  await db.$transaction(async (tx) => {
    const { empresa } = await autorizarItem(tx, ator, c.itemId);
    await tx.checklistUploadRecibo.create({
      data: {
        tokenHash: createHash("sha256").update(token).digest("hex"),
        empresaId: empresa.id,
        itemId: c.itemId,
        usuarioId: ator.kind === "INTERNO" ? ator.id : null,
        clienteOperacionalId: ator.kind === "PORTAL" ? ator.id : null,
        storageProvider: "VERCEL_BLOB",
        storageKey: pathname,
        storageAccess: "private",
        nome: nomeArquivoSeguro(c.nome),
        tamanhoBytes: c.tamanhoBytes,
        mimeType: c.mime,
        expiresAt,
      },
    });
  });
  const clientToken = emitirToken
    ? await emitirToken(pathname, c.mime, expiresAt)
    : await (
        await import("@vercel/blob/client")
      ).generateClientTokenFromReadWriteToken({
        token: storeToken,
        pathname,
        maximumSizeInBytes: MAX_UPLOAD_BYTES,
        allowedContentTypes: [c.mime],
        validUntil: expiresAt.getTime(),
        addRandomSuffix: false,
        allowOverwrite: false,
      });
  return {
    recibo: token,
    pathname,
    clientToken,
    access: "private" as const,
    expiresAt,
  };
}
export async function finalizarUploadDireto(
  ator: AtorChecklist,
  input: unknown,
  driver?: ChecklistStorage,
) {
  const c = z
    .object({ itemId: idSchema, recibo: z.string().min(32).max(100) })
    .parse(input);
  await autorizarItem(db, ator, c.itemId);
  const tokenHash = createHash("sha256").update(c.recibo).digest("hex");
  const r = await db.checklistUploadRecibo.findUnique({ where: { tokenHash } });
  if (
    !r ||
    r.itemId !== c.itemId ||
    r.usuarioId !== (ator.kind === "INTERNO" ? ator.id : null) ||
    r.clienteOperacionalId !== (ator.kind === "PORTAL" ? ator.id : null)
  )
    fail("UPLOAD_INVALID", "Recibo inválido.");
  if (r.expiresAt.getTime() < Date.now() && !r.consumidoEm)
    fail("UPLOAD_INVALID", "Recibo expirou.");
  if (r.sha256)
    return {
      recibo: c.recibo,
      nome: r.nome,
      tamanhoBytes: r.tamanhoBytes,
      mimeType: r.mimeType,
      verificado: true,
    };
  const source = await (driver ?? storageDriver()).get(
    r.storageKey,
    AbortSignal.timeout(10000),
  );
  const bytes = await lerStreamLimitado(source.body, MAX_UPLOAD_BYTES);
  const mime = detectarMime(bytes);
  if (
    bytes.length !== r.tamanhoBytes ||
    mime !== r.mimeType ||
    source.mime.split(";")[0] !== mime
  )
    fail("UPLOAD_INVALID", "Arquivo não corresponde ao envio autorizado.");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await db.$transaction(async (tx) => {
    await autorizarItem(tx, ator, c.itemId);
    const update = await tx.checklistUploadRecibo.updateMany({
      where: { id: r.id, sha256: null, consumidoEm: null },
      data: { sha256 },
    });
    if (update.count !== 1) {
      const existing = await tx.checklistUploadRecibo.findUniqueOrThrow({
        where: { id: r.id },
        select: { sha256: true },
      });
      if (existing.sha256 !== sha256)
        fail("CONFLICT", "O envio mudou durante a verificação.");
    }
  });
  return {
    recibo: c.recibo,
    nome: r.nome,
    tamanhoBytes: r.tamanhoBytes,
    mimeType: r.mimeType,
    verificado: true,
  };
}
