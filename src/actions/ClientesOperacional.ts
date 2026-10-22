"use server";
import db from "@/lib/prisma";
import { resultado, fail } from "@/lib/checklist/result";
import {
  obterAtorChecklist,
  exigirLiderChecklist,
  liderOperacional,
  exigirLeituraChecklist,
} from "@/lib/checklist/acesso";
import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { criarAtendimento } from "@/lib/checklist/service";
import { comandoSchema } from "@/lib/checklist/schemas";
import { executarAtendimento } from "@/lib/checklist/commands";
export async function buscarClienteParaVincularOperacional(cnpj: string) {
  return resultado(async () => {
    await obterAtorChecklist();
    const key = z
      .string()
      .trim()
      .min(11)
      .max(20)
      .parse(cnpj)
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    const cliente = await db.cliente.findUnique({
      where: { cnpj: key },
      select: { id: true, cnpj: true, razaoSocial: true, nomeFantasia: true },
    });
    if (!cliente)
      fail(
        "NOT_FOUND",
        "Cadastre a empresa no CRM antes de criar um atendimento.",
      );
    return cliente;
  });
}
export async function vincularEmpresaAoCliente(input: unknown) {
  return resultado(async () =>
    criarAtendimento(await obterAtorChecklist(), input),
  );
}
export async function listarContasPortalChecklist(input: unknown = {}) {
  return resultado(async () => {
    const ator = await obterAtorChecklist();
    const user = await exigirLeituraChecklist(ator);
    const c = z
      .object({
        busca: z.string().max(180).default(""),
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
      })
      .parse(input);
    const where = {
      ...(c.busca
        ? {
            OR: [
              { nome: { contains: c.busca } },
              { email: { contains: c.busca } },
            ],
          }
        : {}),
      ...(!liderOperacional(user.role)
        ? {
            empresas: {
              some: { analistaId: ator.kind === "INTERNO" ? ator.id : 0 },
              every: { analistaId: ator.kind === "INTERNO" ? ator.id : 0 },
            },
          }
        : {}),
    };
    const [items, totalCount] = await Promise.all([
      db.clienteOperacional.findMany({
        where,
        select: { id: true, nome: true, email: true },
        skip: (c.page - 1) * c.pageSize,
        take: c.pageSize,
        orderBy: { nome: "asc" },
      }),
      db.clienteOperacional.count({ where }),
    ]);
    return { items, totalCount, page: c.page, pageSize: c.pageSize };
  });
}
export async function emitirResetAcessoPortal(input: unknown) {
  return resultado(async () => {
    const c = comandoSchema
      .extend({ empresaId: z.string().min(1).max(80) })
      .parse(input);
    const ator = await obterAtorChecklist();
    const token = randomBytes(32).toString("base64url");
    const result = await executarAtendimento(
      ator,
      c,
      c,
      "CHECKLIST_PORTAL_RESET_EMITIDO",
      async (tx, e) => {
        const user = await exigirLeituraChecklist(ator, tx);
        if (!liderOperacional(user.role)) {
          const others = await tx.operacionalClientes.count({
            where: {
              clienteOperacionalId: e.clienteOperacionalId,
              OR: [
                { analistaId: null },
                { analistaId: { not: ator.kind === "INTERNO" ? ator.id : 0 } },
              ],
            },
          });
          if (others) await exigirLiderChecklist(ator, tx);
        }
        await tx.clienteOperacional.update({
          where: { id: e.clienteOperacionalId },
          data: {
            resetSenhaTokenHash: createHash("sha256")
              .update(token)
              .digest("hex"),
            resetSenhaExpiraEm: new Date(Date.now() + 15 * 60000),
          },
        });
        return { changed: true, dados: { contaAcessoAlterada: true } };
      },
    );
    return {
      ...(!result.replayed ? { token } : {}),
      expiresInSeconds: 900,
      revision: result.revision,
      replayed: result.replayed,
    };
  });
}
