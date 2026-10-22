import JSZip from "jszip";
import { mkdtemp, rm, open } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, PassThrough } from "node:stream";
import db from "@/lib/prisma";
import type { AtorChecklist } from "./types";
import { exigirEmpresaChecklist } from "./acesso";
import { abrirDocumento } from "./documentos";
import { nomeArquivoSeguro } from "./storage";
import { fail } from "./result";
import { z } from "zod";
export const zipOptionsSchema = z.object({
  escopo: z.enum(["ATIVO", "TODOS"]).default("ATIVO"),
  checklistId: z.string().min(1).max(80).optional(),
});
export function caminhoZip(
  d: {
    id: string;
    nome: string;
    item: { codigo: string; secao: string; checklist: { tipo: string } };
  },
  index: number,
) {
  return [
    d.item.checklist.tipo,
    nomeArquivoSeguro(d.item.secao),
    `${String(index + 1).padStart(3, "0")}-${d.id.slice(-12)}-${nomeArquivoSeguro(d.item.codigo)}-${nomeArquivoSeguro(d.nome)}`,
  ].join("/");
}
export async function gerarZipChecklist(
  ator: AtorChecklist,
  empresaId: string,
  input: unknown,
  requestSignal?: AbortSignal,
) {
  const c = zipOptionsSchema.parse(input);
  const empresa = await exigirEmpresaChecklist(db, ator, empresaId);
  if (c.checklistId) {
    if (
      !(await db.checklist.findFirst({
        where: { id: c.checklistId, empresaId },
        select: { id: true },
      }))
    )
      fail("NOT_FOUND", "Checklist não encontrado.");
  }
  const docs = await db.documentoChecklist.findMany({
    where: {
      deletadoEm: null,
      item: {
        checklist: {
          empresaId,
          ...(c.checklistId
            ? { id: c.checklistId }
            : c.escopo === "ATIVO"
              ? {
                  tipo: empresa.tipo ?? undefined,
                  ...(!empresa.tipo ? { id: "__SEM_ATIVO__" } : {}),
                }
              : {}),
        },
      },
    },
    include: {
      item: {
        select: {
          codigo: true,
          secao: true,
          checklist: { select: { tipo: true } },
        },
      },
    },
    orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
    take: 101,
  });
  if (docs.length > 100)
    fail(
      "LIMIT_EXCEEDED",
      "Mais de 100 arquivos. Selecione um checklist menor.",
    );
  if (!docs.length) fail("NOT_FOUND", "Não há documentos ativos neste escopo.");
  const folder = await mkdtemp(join(tmpdir(), "checklist-zip-"));
  const deadline = AbortSignal.timeout(45000);
  const globalSignal = requestSignal
    ? AbortSignal.any([requestSignal, deadline])
    : deadline;
  let total = 0,
    index = 0;
  const accepted: { path: string; nome: string }[] = [];
  const failures: { documentoId: string; nome: string; motivo: string }[] = [];
  try {
    async function worker() {
      while (index < docs.length && !globalSignal.aborted) {
        const i = index++;
        const doc = docs[i];
        const path = join(folder, String(i));
        let fh: Awaited<ReturnType<typeof open>> | undefined;
        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        try {
          const signal = AbortSignal.any([
            globalSignal,
            AbortSignal.timeout(10000),
          ]);
          const source = await abrirDocumento(ator, doc.id, signal);
          reader = source.body.getReader();
          fh = await open(path, "wx");
          let bytes = 0;
          while (true) {
            if (signal.aborted) throw new Error("TIMEOUT");
            const part = await reader.read();
            if (part.done) break;
            bytes += part.value.length;
            if (
              bytes > 25 * 1024 * 1024 ||
              total + part.value.length > 100 * 1024 * 1024
            )
              throw new Error("LIMIT");
            total += part.value.length;
            await fh.write(part.value);
          }
          accepted.push({ path, nome: caminhoZip(doc, i) });
        } catch (error) {
          failures.push({
            documentoId: doc.id,
            nome: doc.nome,
            motivo: String(error).includes("LIMIT")
              ? "Limite de bytes excedido."
              : globalSignal.aborted
                ? "Prazo global excedido."
                : "Arquivo indisponível ou limite de tempo excedido.",
          });
          await rm(path, { force: true });
        } finally {
          await reader?.cancel().catch(() => {});
          reader?.releaseLock();
          await fh?.close();
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(3, docs.length) }, () => worker()),
    );
    for (; index < docs.length; index++)
      failures.push({
        documentoId: docs[index].id,
        nome: docs[index].nome,
        motivo: "Prazo global excedido.",
      });
    if (requestSignal?.aborted) throw new Error("ABORTED");
    const zip = new JSZip();
    for (const file of accepted)
      zip.file(file.nome, createReadStream(file.path));
    zip.file(
      "manifesto.json",
      JSON.stringify(
        {
          escopo: c.checklistId ? "HISTORICO" : c.escopo,
          totalSolicitados: docs.length,
          incluidos: accepted.length,
          parcial: failures.length > 0,
          falhas: failures,
        },
        null,
        2,
      ),
    );
    const source = zip.generateNodeStream({
      streamFiles: true,
      compression: "DEFLATE",
      compressionOptions: { level: 3 },
    });
    const stream = new PassThrough();
    source.on("error", (error) => stream.destroy(error));
    source.pipe(stream);
    const cleanup = () => {
      void rm(folder, { recursive: true, force: true });
    };
    stream.once("close", cleanup);
    stream.once("error", cleanup);
    stream.once("end", cleanup);
    requestSignal?.addEventListener(
      "abort",
      () => stream.destroy(new Error("ABORTED")),
      { once: true },
    );
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  } catch (error) {
    await rm(folder, { recursive: true, force: true });
    throw error;
  }
}
