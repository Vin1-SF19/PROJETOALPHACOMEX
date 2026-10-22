import { Prisma, TipoEmbasamento } from "@prisma/client";
import db from "@/lib/prisma";
import {
  exigirGestorModelosChecklist,
  exigirLeituraChecklist,
  type Tx,
} from "./acesso";
import {
  publicarModeloSchema,
  paginaSchema,
  tiposChecklist,
  normalizarCodigoModelo,
} from "./schemas";
import { fail } from "./result";
import { registrarEvento, replay } from "./commands";
import type { AtorChecklist } from "./types";
import { z } from "zod";
export async function modelosAplicaveis(tx: Tx, tipo: TipoEmbasamento) {
  const rows = await tx.modeloItemChecklist.findMany({
    where: {
      ativo: true,
      identidadeId: { not: null },
      OR: [{ tipo }, { tipo: null }],
    },
    orderBy: [
      { secao: "asc" },
      { ordem: "asc" },
      { codigo: "asc" },
      { id: "asc" },
    ],
  });
  const m = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const key = normalizarCodigoModelo(r.codigo);
    const prev = m.get(key);
    if (!prev || r.tipo === tipo) m.set(key, r);
  }
  return [...m.values()].sort(
    (a, b) =>
      a.secao.localeCompare(b.secao) ||
      a.ordem - b.ordem ||
      a.codigo.localeCompare(b.codigo) ||
      a.id.localeCompare(b.id),
  );
}
export async function listarCatalogo(ator: AtorChecklist, input: unknown) {
  await exigirLeituraChecklist(ator);
  const c = paginaSchema
    .extend({
      tipo: z.enum(tiposChecklist).optional(),
      escopo: z.enum(["GLOBAL", ...tiposChecklist]).optional(),
      ativos: z.boolean().optional(),
    })
    .parse(input);
  const where: Prisma.ModeloChecklistIdentidadeWhereInput = c.escopo
    ? { escopo: c.escopo }
    : c.tipo
      ? { escopo: { in: ["GLOBAL", c.tipo] } }
      : {};
  const [identidades, totalCount] = await Promise.all([
    db.modeloChecklistIdentidade.findMany({
      where,
      include: { revisoes: { orderBy: { versao: "desc" }, take: 1 } },
      orderBy: [{ codigoNormalizado: "asc" }, { id: "asc" }],
      skip: (c.page - 1) * c.pageSize,
      take: c.pageSize,
    }),
    db.modeloChecklistIdentidade.count({ where }),
  ]);
  return {
    items: identidades.map((i) => ({
      id: i.id,
      escopo: i.escopo,
      codigo: i.codigoNormalizado,
      revision: i.revision,
      modelo: i.revisoes[0] ?? null,
    })),
    totalCount,
    page: c.page,
    pageSize: c.pageSize,
  };
}
const revisarModeloSchema = z.object({
  identidadeId: z.string().min(1),
  expectedRevision: z.number().int().nonnegative(),
  mutationId: z.string().uuid(),
  ordem: z.number().int().nonnegative().optional(),
});
type ComandoModelo =
  | { operation: "PUBLICAR"; input: z.infer<typeof publicarModeloSchema> }
  | {
      operation: "DESATIVAR" | "ORDENAR";
      input: z.infer<typeof revisarModeloSchema>;
    };

async function hidratarRevisao(
  tx: Tx,
  comando: Extract<ComandoModelo, { operation: "DESATIVAR" | "ORDENAR" }>,
) {
  const c = comando.input;
  const i = await tx.modeloChecklistIdentidade.findUnique({
    where: { id: c.identidadeId },
    include: { revisoes: { orderBy: { versao: "desc" }, take: 1 } },
  });
  if (!i?.revisoes[0]) fail("NOT_FOUND", "Modelo não encontrado.");
  const r = i.revisoes[0];
  return publicarModeloSchema.parse({
    ...c,
    escopo: i.escopo,
    codigo: i.codigoNormalizado,
    nome: r.nome,
    descricao: r.descricao,
    secao: r.secao,
    obrigatorio: r.obrigatorio,
    ordem: comando.operation === "ORDENAR" ? c.ordem : r.ordem,
    ativo: comando.operation === "DESATIVAR" ? false : r.ativo,
  });
}

async function executarModelo(ator: AtorChecklist, comando: ComandoModelo) {
  // Bind the journal to caller intent, never fields hydrated from current state.
  const payload = { operation: comando.operation, ...comando.input };
  return db.$transaction(async (tx) => {
    await exigirGestorModelosChecklist(ator, tx);
    const prior = await replay(tx, ator, comando.input.mutationId, payload);
    if (prior)
      return z
        .object({
          identidadeId: z.string(),
          revision: z.number().int(),
          modeloId: z.string(),
        })
        .parse(prior.resultado);
    const c = comando.operation === "PUBLICAR"
      ? comando.input
      : await hidratarRevisao(tx, comando);
    let identity = c.identidadeId
      ? await tx.modeloChecklistIdentidade.findUnique({
          where: { id: c.identidadeId },
        })
      : null;
    if (c.identidadeId && !identity)
      fail("NOT_FOUND", "Modelo não encontrado.");
    if (
      identity &&
      (identity.escopo !== c.escopo || identity.codigoNormalizado !== c.codigo)
    )
      fail(
        "MODEL_CODE_CONFLICT",
        "Escopo e código da identidade são imutáveis.",
      );
    const collision = await tx.modeloChecklistIdentidade.findUnique({
      where: {
        escopo_codigoNormalizado: {
          escopo: c.escopo,
          codigoNormalizado: c.codigo,
        },
      },
    });
    if (!identity && collision)
      fail(
        "MODEL_CODE_CONFLICT",
        "Este código já existe neste escopo. Edite sua revisão.",
      );
    if (!identity) {
      if (c.expectedRevision !== 0)
        fail("CONFLICT", "Revisão de modelo inválida.");
      identity = await tx.modeloChecklistIdentidade.create({
        data: {
          escopo: c.escopo,
          codigoNormalizado: c.codigo,
          autorId: ator.kind === "INTERNO" ? ator.id : null,
        },
      });
    }
    if (identity.revision !== c.expectedRevision)
      fail("CONFLICT", "O modelo mudou. Recarregue.");
    const last = await tx.modeloItemChecklist.findFirst({
      where: { identidadeId: identity.id },
      orderBy: { versao: "desc" },
    });
    if (
      last &&
      last.nome === c.nome &&
      last.descricao === c.descricao &&
      last.secao === c.secao &&
      last.obrigatorio === c.obrigatorio &&
      last.ordem === c.ordem &&
      last.ativo === c.ativo
    )
      return {
        identidadeId: identity.id,
        revision: identity.revision,
        modeloId: last.id,
      };
    const cas = await tx.modeloChecklistIdentidade.updateMany({
      where: { id: identity.id, revision: c.expectedRevision },
      data: { revision: { increment: 1 } },
    });
    if (cas.count !== 1) fail("CONFLICT", "O modelo mudou. Recarregue.");
    await tx.modeloItemChecklist.updateMany({
      where: { identidadeId: identity.id, ativo: true },
      data: { ativo: false },
    });
    const novo = await tx.modeloItemChecklist.create({
      data: {
        identidadeId: identity.id,
        versao: (last?.versao ?? 0) + 1,
        tipo: c.escopo === "GLOBAL" ? null : c.escopo,
        codigo: c.codigo,
        nome: c.nome,
        descricao: c.descricao,
        secao: c.secao,
        obrigatorio: c.obrigatorio,
        ordem: c.ordem,
        ativo: c.ativo,
        autorId: ator.kind === "INTERNO" ? ator.id : null,
      },
    });
    const result = {
      identidadeId: identity.id,
      revision: identity.revision + 1,
      modeloId: novo.id,
    };
    await registrarEvento(tx, ator, {
      mutationId: c.mutationId,
      payload,
      agregadoTipo: "MODELO",
      agregadoId: identity.id,
      revision: identity.revision + 1,
      tipo: "CHECKLIST_MODELO_PUBLICADO",
      dados: { modeloId: novo.id, versao: novo.versao, ativo: novo.ativo },
      resultado: result,
    });
    return result;
  });
}
export async function publicarModelo(ator: AtorChecklist, input: unknown) {
  return executarModelo(ator, {
    operation: "PUBLICAR",
    input: publicarModeloSchema.parse(input),
  });
}
export async function revisarModelo(
  ator: AtorChecklist,
  input: unknown,
  operation: "DESATIVAR" | "ORDENAR",
) {
  return executarModelo(ator, {
    operation,
    input: revisarModeloSchema.parse(input),
  });
}
