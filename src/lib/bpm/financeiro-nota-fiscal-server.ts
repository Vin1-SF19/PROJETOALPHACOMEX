import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { extrairPathnamePrivadoAnexoBpm } from "@/lib/bpm/anexos-storage";
import { publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";
import { CHAVES_CAMPOS } from "@/lib/bpm/financeiro-config.client";
import { pendenciasNotaFiscal, type DadosNotaFiscal } from "@/lib/bpm/financeiro-nota-fiscal";

const CHAVES = [CHAVES_CAMPOS.NF_EMITIDA, CHAVES_CAMPOS.NUMERO_NF,
  CHAVES_CAMPOS.DATA_EMISSAO_NF, CHAVES_CAMPOS.VALOR_NF, CHAVES_CAMPOS.LINK_NF];

export async function carregarEstadoNotaFiscal(cardId: string, pipelineId: string, tx: Prisma.TransactionClient) {
  const campos = await tx.bpmCampo.findMany({
    where: { pipelineId, ativo: true, chave: { in: CHAVES } }, select: { id: true, chave: true },
  });
  if (campos.length !== CHAVES.length) return null;
  const ids = new Map(campos.map((campo) => [campo.chave, campo.id]));
  const valores = await tx.bpmCardCampoValor.findMany({
    where: { cardId, campoId: { in: campos.map((campo) => campo.id) } }, select: { campoId: true, valor: true },
  });
  const porId = new Map(valores.map((item) => [item.campoId, item.valor ?? ""]));
  const valor = (chave: string) => porId.get(ids.get(chave) ?? "") ?? "";
  const dados: DadosNotaFiscal = {
    emitida: valor(CHAVES_CAMPOS.NF_EMITIDA) as DadosNotaFiscal["emitida"],
    numero: valor(CHAVES_CAMPOS.NUMERO_NF), dataEmissao: valor(CHAVES_CAMPOS.DATA_EMISSAO_NF),
    valor: valor(CHAVES_CAMPOS.VALOR_NF), link: valor(CHAVES_CAMPOS.LINK_NF),
  };
  const anexo = dados.link ? await tx.bpmCardAnexo.findFirst({
    where: { id: dados.link, cardId, campoId: ids.get(CHAVES_CAMPOS.LINK_NF) }, select: { url: true },
  }) : null;
  const arquivoValido = Boolean(anexo?.url && extrairPathnamePrivadoAnexoBpm(anexo.url));
  return { dados, arquivoValido };
}

export async function exigirNotaFiscalParaConcluirTarefa(cardId: string, pipelineId: string, tx: Prisma.TransactionClient) {
  const estado = await carregarEstadoNotaFiscal(cardId, pipelineId, tx);
  if (!estado || estado.dados.emitida !== "Sim" || pendenciasNotaFiscal(estado.dados, estado.arquivoValido).length) {
    throw new Error("Registre uma NF válida antes de concluir a tarefa de emissão.");
  }
}

/** Registra mudanças da NF e reconcilia apenas tarefas EMISSAO_NF do próprio card. */
export async function sincronizarNotaFiscalCard(params: {
  cardId: string; pipelineId: string; tx: Prisma.TransactionClient; usuarioId?: number | null;
}) {
  const { cardId, pipelineId, tx } = params;
  const estado = await carregarEstadoNotaFiscal(cardId, pipelineId, tx);
  if (!estado) return;
  const { dados, arquivoValido } = estado;
  const pendencias = pendenciasNotaFiscal(dados, arquivoValido);
  if (dados.emitida === "Sim" && pendencias.length) throw new Error(`REQUISITOS_PENDENTES:${pendencias.join(", ")}`);

  const ultimo = await tx.bpmCardHistorico.findFirst({
    where: { cardId, acao: { in: ["NOTA_FISCAL_EMITIDA", "NOTA_FISCAL_ATUALIZADA", "NOTA_FISCAL_PENDENTE"] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { valorNovoJson: true },
  });
  const anterior = ultimo?.valorNovoJson ? JSON.parse(ultimo.valorNovoJson) as DadosNotaFiscal : null;
  if (dados.emitida === "Sim" && JSON.stringify(anterior) !== JSON.stringify(dados)) {
    await tx.bpmCardHistorico.create({ data: {
      cardId, acao: anterior?.emitida === "Sim" ? "NOTA_FISCAL_ATUALIZADA" : "NOTA_FISCAL_EMITIDA",
      usuarioId: params.usuarioId ?? null,
      valorAnteriorJson: anterior ? JSON.stringify(anterior) : null,
      valorNovoJson: JSON.stringify(dados),
    } });
  }
  if (dados.emitida === "Não" && anterior?.emitida === "Sim") {
    await tx.bpmCardHistorico.create({ data: {
      cardId, acao: "NOTA_FISCAL_PENDENTE", usuarioId: params.usuarioId ?? null,
      valorAnteriorJson: JSON.stringify(anterior), valorNovoJson: JSON.stringify(dados),
    } });
  }
  if (dados.emitida === "Sim") {
    const pendentes = await tx.bpmTarefa.findMany({
      where: { cardId, tipo: "EMISSAO_NF", status: "PENDENTE" }, select: { id: true, titulo: true },
    });
    for (const tarefa of pendentes) {
      const atualizada = await tx.bpmTarefa.updateMany({
        where: { id: tarefa.id, status: "PENDENTE" }, data: { status: "CONCLUIDA", concluidaEm: new Date() },
      });
      if (!atualizada.count) continue;
      const historico = await tx.bpmCardHistorico.create({ data: {
        cardId, acao: "TAREFA_CONCLUIDA", usuarioId: params.usuarioId ?? null,
        valorNovoJson: JSON.stringify({ titulo: tarefa.titulo, tipo: "EMISSAO_NF" }),
      } });
      await publicarEventoBpm({ tipo: "TAREFA_CONCLUIDA", entidadeTipo: "TAREFA", entidadeId: tarefa.id,
        cardId, pipelineId, valorAnterior: { status: "PENDENTE" },
        valorNovo: { tarefaId: tarefa.id, tipo: "EMISSAO_NF", titulo: tarefa.titulo, status: "CONCLUIDA" },
        atorTipo: params.usuarioId ? "USUARIO" : "SISTEMA", atorUserId: params.usuarioId ?? undefined,
        correlationId: randomUUID(), idempotencyKey: `nf-tarefa-concluida:${historico.id}` }, tx);
    }
  } else if (dados.emitida === "Não") {
    const concluidas = await tx.bpmTarefa.findMany({
      where: { cardId, tipo: "EMISSAO_NF", status: "CONCLUIDA" }, select: { id: true, titulo: true },
    });
    for (const tarefa of concluidas) {
      await tx.bpmTarefa.update({ where: { id: tarefa.id }, data: { status: "PENDENTE", concluidaEm: null } });
      await tx.bpmCardHistorico.create({ data: {
        cardId, acao: "TAREFA_NF_REABERTA", usuarioId: params.usuarioId ?? null,
        valorNovoJson: JSON.stringify({ titulo: tarefa.titulo, motivo: "NF emitida = Não" }),
      } });
    }
  }
}
