"use server";

import { z } from "zod";
import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { checarAcessoBpmCard } from "@/lib/bpm/ownership";
import { pendenciasNotaFiscal, resolverCamposNotaFiscal, validarDadosNotaFiscal, type DadosNotaFiscal } from "@/lib/bpm/financeiro-nota-fiscal";
import { sincronizarNotaFiscalCard } from "@/lib/bpm/financeiro-nota-fiscal-server";
import { extrairPathnamePrivadoAnexoBpm } from "@/lib/bpm/anexos-storage";
import { publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";
import { verificarLinkNotaFiscalAcessivel } from "@/lib/bpm/nota-fiscal-link";
import { randomUUID } from "node:crypto";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";
import { revalidatePath } from "next/cache";

const schema = z.object({
  cardId: z.string().min(1),
  emitida: z.enum(["Sim", "Não", ""]),
  dataEmissao: z.string().max(10),
  numero: z.string().max(120),
  valor: z.string().max(80),
  link: z.string().max(2048),
}).strict();

const ROTA = "/PainelAlpha/AlphaCRM";

async function exigirAcessoNotaFiscal(cardId: string, userId: number, role: string | null, client: typeof db = db, editar = false) {
  const acesso = await checarAcessoBpmCard(cardId, userId, role, "visualizar", client);
  if (!acesso.autorizado || (!acesso.isAdminGlobal && !acesso.role)) throw new Error("Não autorizado");
  if (editar && !acesso.isAdminGlobal) {
    const card = await client.bpmCard.findUnique({
      where: { id: cardId },
      select: { etapa: { select: { visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } } } } },
    });
    if (!card || !resolverVisibilidadeEtapa(acesso.perfilGlobal, card.etapa.visibilidades).podeAgir) throw new Error("Não autorizado");
  }
  return acesso;
}

async function carregarNotaFiscal(cardId: string, client: typeof db = db) {
  const card = await client.bpmCard.findUnique({
    where: { id: cardId },
    select: { id: true, pipelineId: true, status: true, etapaId: true, updatedAt: true, pipeline: { select: { chave: true } } },
  });
  if (!card) throw new Error("Card não encontrado.");
  const campos = resolverCamposNotaFiscal(card.pipeline.chave, await client.bpmCampo.findMany({
    where: { ativo: true, OR: [{ pipelineId: card.pipelineId }, { pipelinesAssociados: { some: { pipelineId: card.pipelineId } } }] },
    select: { id: true, chave: true, nome: true, tipo: true, escopo: true, ativo: true },
  }));
  const ids = Object.values(campos).map((campo) => campo.id);
  const valores = await client.bpmCardCampoValor.findMany({ where: { cardId, campoId: { in: ids } }, select: { campoId: true, valor: true } });
  const mapa = new Map(valores.map(({ campoId, valor }) => [campoId, valor ?? ""]));
  const dados: DadosNotaFiscal = {
    emitida: (mapa.get(campos.emitida.id) ?? "") as DadosNotaFiscal["emitida"],
    dataEmissao: mapa.get(campos.dataEmissao.id) ?? "",
    numero: mapa.get(campos.numero.id) ?? "",
    valor: mapa.get(campos.valor.id) ?? "",
    link: mapa.get(campos.link.id) ?? "",
  };
  const anexo = dados.link ? await client.bpmCardAnexo.findFirst({
    where: { id: dados.link, cardId, campoId: campos.link.id }, select: { url: true },
  }) : null;
  const arquivoUrl = anexo?.url && extrairPathnamePrivadoAnexoBpm(anexo.url)
    ? `/api/bpm/anexos/${dados.link}` : null;
  return { card, campos, dados, arquivoUrl };
}

export async function ObterNotaFiscalFinanceiroBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Não autorizado");
    const acesso = await exigirAcessoNotaFiscal(cardId, Number(session.user.id), session.user.role ?? null);
    const { card, dados, arquivoUrl } = await carregarNotaFiscal(cardId);
    const permissao = await db.bpmCard.findUnique({ where: { id: cardId }, select: { etapa: { select: { visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } } } } } });
    const podeEditar = acesso.isAdminGlobal || Boolean(permissao && resolverVisibilidadeEtapa(acesso.perfilGlobal, permissao.etapa.visibilidades).podeAgir);
    return { success: true as const, data: { ...dados, arquivoUrl, concluido: card.status === "CONCLUIDO", podeEditar } };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível carregar a NF." };
  }
}

export async function SalvarNotaFiscalFinanceiroBpm(input: unknown) {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new Error("Dados da nota fiscal inválidos.");
    const session = await auth();
    if (!session?.user?.id) throw new Error("Não autorizado");
    const userId = Number(session.user.id);
    const { cardId, ...dadosInformados } = parsed.data;
    const resultado = await db.$transaction(async (tx) => {
      await exigirAcessoNotaFiscal(cardId, userId, session.user.role ?? null, tx as typeof db, true);
      const atual = await carregarNotaFiscal(cardId, tx as typeof db);
      if (atual.card.status !== "CONCLUIDO") throw new Error("Use o formulário da etapa para registrar a NF antes da conclusão.");
      const dataEmissao = dadosInformados.emitida === "Sim" && !dadosInformados.dataEmissao.trim()
        ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
        : dadosInformados.dataEmissao;
      const dados = validarDadosNotaFiscal({ ...dadosInformados, dataEmissao }, atual.dados.link);
      const anexo = dados.link ? await tx.bpmCardAnexo.findFirst({
        where: { id: dados.link, cardId, campoId: atual.campos.link.id }, select: { url: true },
      }) : null;
      const pendencias = pendenciasNotaFiscal(dados, Boolean(anexo?.url && extrairPathnamePrivadoAnexoBpm(anexo.url)));
      if (pendencias.length) throw new Error(`Campos da NF pendentes: ${pendencias.join(", ")}.`);
      if (dados.emitida === "Sim" && dados.link.startsWith("https://")
        && (atual.dados.emitida !== "Sim" || dados.link !== atual.dados.link)) {
        await verificarLinkNotaFiscalAcessivel(dados.link);
      }
      const alterados = (Object.keys(dados) as (keyof DadosNotaFiscal)[]).filter((chave) => dados[chave] !== atual.dados[chave]);
      if (!alterados.length) return { pipelineId: atual.card.pipelineId, dados: atual.dados };
      const trava = await tx.bpmCard.updateMany({
        where: { id: cardId, status: "CONCLUIDO", etapaId: atual.card.etapaId, updatedAt: atual.card.updatedAt },
        data: { updatedAt: new Date(Math.max(Date.now(), atual.card.updatedAt.getTime() + 1)), versao: { increment: 1 } },
      });
      if (trava.count !== 1) throw new Error("O card mudou. Recarregue e tente novamente.");
      for (const chave of alterados) {
        const campoId = atual.campos[chave].id;
        await tx.bpmCardCampoValor.upsert({
          where: { cardId_campoId: { cardId, campoId } },
          create: { cardId, campoId, valor: dados[chave] },
          update: { valor: dados[chave] },
        });
      }
      await sincronizarNotaFiscalCard({ tx, cardId, pipelineId: atual.card.pipelineId, usuarioId: userId });
      const correlationId = randomUUID();
      await publicarEventoBpm({ tipo: "CARD_ATUALIZADO", entidadeTipo: "CARD", entidadeId: cardId,
        cardId, pipelineId: atual.card.pipelineId, valorAnterior: { notaFiscal: atual.dados },
        valorNovo: { notaFiscal: dados }, atorTipo: "USUARIO", atorUserId: userId,
        correlationId, idempotencyKey: `nota-fiscal-atualizada:${cardId}:${atual.card.updatedAt.toISOString()}` }, tx);
      for (const chave of alterados) {
        const campoId = atual.campos[chave].id;
        await publicarEventoBpm({ tipo: "CAMPO_ALTERADO", entidadeTipo: "CAMPO", entidadeId: campoId,
          cardId, pipelineId: atual.card.pipelineId,
          valorAnterior: { campoId, valor: atual.dados[chave] }, valorNovo: { campoId, valor: dados[chave] },
          atorTipo: "USUARIO", atorUserId: userId, correlationId,
          idempotencyKey: `nota-fiscal-campo:${cardId}:${atual.card.updatedAt.toISOString()}:${campoId}` }, tx);
      }
      return { pipelineId: atual.card.pipelineId, dados };
    });
    revalidatePath(ROTA);
    await notificarPipelineBpm({ pipelineId: resultado.pipelineId, tipo: "CARD_ATUALIZADO" });
    return { success: true as const, data: resultado.dados };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível salvar a NF." };
  }
}
