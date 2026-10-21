import "server-only";

import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { isAdminRole, exigirAcessoBpmCard, exigirAcessoBpmPipeline } from "@/lib/bpm/ownership";
import { criarSlaInstancia } from "@/lib/bpm/sla";
import { ativarCadenciasNaEntradaBpm } from "@/lib/bpm/cadencias/ativacao-automatica";
import { copiarCamposCardVinculado } from "@/lib/bpm/copiar-campos-card-vinculado";
import { carregarCamposFaltantesCardEtapa } from "@/lib/bpm/requisitos-etapa-server";
import { ehPipelineOperacional } from "@/lib/bpm/financeiro-config.client";
import { publicarEventoBpm } from "./eventos";
import { parametrosEncaminhamentoSchema } from "./schemas";

function parseObjeto(valor: string | null): Record<string, unknown> {
  try { const parsed: unknown = JSON.parse(valor ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.fromEntries(Object.entries(parsed)) : {};
  } catch { return {}; }
}

/** Authority comes from an authenticated request's persisted audit record, never action JSON. */
async function autorizacaoAdministrativa(tx: Prisma.TransactionClient, execucaoId: string, cardId: string, automacaoId: string, parametros: ReturnType<typeof parametrosEncaminhamentoSchema.parse>) {
  const execucao = await tx.bpmAutomacaoExecucao.findUnique({ where: { id: execucaoId },
    select: { cardId: true, automacaoId: true, gatilhoTipo: true, correlationId: true, eventoId: true, evento: { select: { profundidade: true } }, automacao: { select: { ativa: true, etapaId: true, pipelineId: true, acaoTipo: true } } } });
  if (!execucao || execucao.cardId !== cardId || execucao.automacaoId !== automacaoId) throw new Error("Execução incompatível com o encaminhamento");
  const contexto = { correlationId: execucao.correlationId ?? execucaoId, causationId: execucao.eventoId ?? execucaoId,
    profundidade: (execucao.evento?.profundidade ?? 0) + 1 };
  if (execucao.gatilhoTipo !== "ENCAMINHAMENTO_ADMIN") return { ...contexto, administrativo: null };
  const autorizacao = await tx.bpmCardHistorico.findFirst({ where: { cardId, acao: "ENCAMINHAMENTO_ADMIN_SOLICITADO",
    valorNovoJson: { contains: execucaoId } }, orderBy: { createdAt: "desc" }, select: { usuarioId: true, valorNovoJson: true } });
  const dados = parseObjeto(autorizacao?.valorNovoJson ?? null);
  if (execucao.cardId !== cardId || dados.execucaoId !== execucaoId || dados.pipelineDestinoId !== parametros.pipelineId || dados.etapaDestinoId !== parametros.etapaId
    || JSON.stringify(parametrosEncaminhamentoSchema.parse(dados.parametros)) !== JSON.stringify(parametros) || !autorizacao?.usuarioId
    || !execucao.automacao.ativa || execucao.automacao.acaoTipo !== "CRIAR_CARD_OUTRO_PIPELINE") throw new Error("Encaminhamento administrativo sem autorização válida");
  const ator = await tx.usuarios.findUnique({ where: { id: autorizacao.usuarioId }, select: { id: true, role: true, status: true } });
  if (!ator || ator.status !== "ATIVO" || !isAdminRole(ator.role)) throw new Error("Autorização administrativa indisponível");
  await exigirAcessoBpmCard(cardId, ator.id, ator.role, "visualizar", tx);
  await exigirAcessoBpmPipeline(parametros.pipelineId, ator.id, tx);
  return { ...contexto, administrativo: { usuarioId: ator.id, versaoEsperada: dados.versaoEsperada,
    etapaAutorizadaId: dados.etapaOrigemId, etapaOrigemId: execucao.automacao.etapaId, pipelineOrigemId: execucao.automacao.pipelineId } };
}

/** Shared central/legacy/manual handoff. Lock, dedupe, copy, links and outbox commit together. */
export async function executarEncaminhamentoBpm(input: {
  cardId: string; execucaoId: string; automacaoId: string; parametros: unknown;
}, client?: Prisma.TransactionClient) {
  const parametros = parametrosEncaminhamentoSchema.parse(input.parametros);
  const executar = async (tx: Prisma.TransactionClient) => {
    const card = await tx.bpmCard.findUnique({ where: { id: input.cardId }, select: {
      id: true, pipelineId: true, etapaId: true, versao: true, status: true, empresaId: true,
      responsavelId: true, servico: true, pipeline: { select: { chave: true, nome: true } },
    } });
    if (!card || card.status === "ARQUIVADO") throw new Error("Card indisponível para encaminhamento");
    const contexto = await autorizacaoAdministrativa(tx, input.execucaoId, card.id, input.automacaoId, parametros);
    const administrativo = contexto.administrativo;
    if (administrativo && (administrativo.etapaOrigemId !== card.etapaId || administrativo.etapaAutorizadaId !== card.etapaId || administrativo.pipelineOrigemId !== card.pipelineId)) {
      throw new Error("O card mudou de etapa. Atualize antes de encaminhar.");
    }
    const execucao = { id: input.execucaoId, automacaoId: input.automacaoId };
    const pipelineId = parametros.pipelineId; const etapaId = parametros.etapaId;
    const pipelineDestino = await tx.bpmPipeline.findFirst({ where: { id: pipelineId, ativo: true }, select: { id: true, chave: true } });
    if (!pipelineDestino) throw new Error("Pipeline de destino inativo");
    const etapa = await tx.bpmEtapa.findFirst({ where: { id: etapaId, pipelineId, ativo: true }, select: { id: true } });
    if (!etapa) throw new Error("Pipeline/etapa de destino inválidos");
    const handoffOperacional = card.pipeline.chave === "financeiro" && ehPipelineOperacional(pipelineDestino);
    const handoffFinanceiro = pipelineDestino.chave === "financeiro"
      && (card.pipeline.chave === "comercial" || card.pipeline.nome === "Revisão de Radar");
    if (handoffOperacional && card.status !== "CONCLUIDO" && !administrativo) {
      throw new Error("A contratação precisa estar concluída antes da liberação ao Operacional");
    }
    // A indicação pertence à negociação comercial, não ao card financeiro. O vínculo
    // direto mantém vendedor, origem, anexos e histórico localizáveis com as permissões
    // habituais de acesso ao card de origem.
    const negociacao = handoffOperacional ? await tx.bpmCardVinculo.findFirst({
      where: { cardDestinoId: card.id, cardOrigem: { empresaId: card.empresaId, pipeline: { OR: [
        { chave: "comercial" }, { nome: "Revisão de Radar" },
      ] } } },
      select: { cardOrigemId: true, cardOrigem: { select: { responsavelId: true, indicacaoOrigem: { select: { parceiroId: true } } } } },
    }) : null;
    const vincular = handoffOperacional || parametros.vincularAoOriginal !== false;
    const completarHandoff = async (tx: Prisma.TransactionClient, destinoId: string) => {
      if (!handoffOperacional) return;
      await tx.bpmCardVinculo.upsert({
        where: { cardOrigemId_cardDestinoId: { cardOrigemId: card.id, cardDestinoId: destinoId } },
        create: { cardOrigemId: card.id, cardDestinoId: destinoId }, update: {},
      });
      // A origem financeira tem precedência; o card comercial preenche somente
      // valores ainda ausentes no destino (o helper usa update vazio).
      await copiarCamposCardVinculado(tx, card.id, destinoId, pipelineId, etapaId);
      if (negociacao) {
        await tx.bpmCardVinculo.upsert({
          where: { cardOrigemId_cardDestinoId: { cardOrigemId: negociacao.cardOrigemId, cardDestinoId: destinoId } },
          create: { cardOrigemId: negociacao.cardOrigemId, cardDestinoId: destinoId }, update: {},
        });
        await copiarCamposCardVinculado(tx, negociacao.cardOrigemId, destinoId, pipelineId, etapaId);
      }
      // Um valor de campo "arquivo" é o ID de BpmCardAnexo, cujo acesso é
      // autorizado pelo card proprietário. Referências copiadas de outro card
      // não representam um anexo do destino; os documentos seguem nos cards
      // vinculados, sem duplicar o registro ou abrir uma URL direta.
      const camposArquivo = await tx.bpmCampo.findMany({
        where: { tipo: { in: ["arquivo", "url_ou_arquivo"] }, ativo: true,
          OR: [{ pipelineId }, { pipelinesAssociados: { some: { pipelineId } } }],
          etapaConfiguracoes: { some: { etapaId, visivel: true } } },
        select: { id: true, tipo: true },
      });
      if (camposArquivo.length) {
        const valoresArquivo = await tx.bpmCardCampoValor.findMany({
          where: { cardId: destinoId, campoId: { in: camposArquivo.map((campo) => campo.id) } },
          select: { campoId: true, valor: true },
        });
        const idsAnexo = valoresArquivo.filter((item) => item.valor && !/^https:\/\//i.test(item.valor)).map((item) => item.valor as string);
        const anexosProprios = idsAnexo.length ? await tx.bpmCardAnexo.findMany({
          where: { cardId: destinoId, id: { in: idsAnexo } }, select: { id: true },
        }) : [];
        const idsProprios = new Set(anexosProprios.map((anexo) => anexo.id));
        const tipoPorCampo = new Map(camposArquivo.map((campo) => [campo.id, campo.tipo]));
        const invalidos = valoresArquivo.filter((item) => item.valor && (
          tipoPorCampo.get(item.campoId) === "arquivo" || !/^https:\/\//i.test(item.valor)
        ) && !idsProprios.has(item.valor)).map((item) => item.campoId);
        if (invalidos.length) await tx.bpmCardCampoValor.deleteMany({ where: { cardId: destinoId, campoId: { in: invalidos } } });
      }
      const pendencias = await carregarCamposFaltantesCardEtapa(destinoId, pipelineId, etapaId, tx);
      if (pendencias.length && !administrativo) {
        const excecao = await tx.bpmCardHistorico.findFirst({
          where: { cardId: card.id, acao: "EXCECAO_LIBERACAO_OPERACIONAL" },
          orderBy: { createdAt: "desc" }, select: { id: true, usuarioId: true, valorNovoJson: true },
        });
        const autorizacao = excecao ? parseObjeto(excecao.valorNovoJson) : null;
        if (!excecao || autorizacao?.falhaExecucaoId !== execucao.id) {
          throw new Error(`Liberação ao Operacional bloqueada. Campos obrigatórios: ${pendencias.map((campo) => campo.nome).join(", ")}`);
        }
        const jaRegistrada = await tx.bpmCardHistorico.findFirst({
          where: { cardId: destinoId, acao: "LIBERACAO_OPERACIONAL_COM_EXCECAO", valorNovoJson: { contains: excecao.id } },
          select: { id: true },
        });
        if (!jaRegistrada) await tx.bpmCardHistorico.create({ data: {
          cardId: destinoId, acao: "LIBERACAO_OPERACIONAL_COM_EXCECAO", usuarioId: excecao.usuarioId,
          valorNovoJson: JSON.stringify({ autorizacaoId: excecao.id, camposDispensados: pendencias.map((campo) => ({ id: campo.id, nome: campo.nome })),
            autorizacao: excecao.valorNovoJson }),
        } });
      }
    };
    const vinculoExistente = await tx.bpmCardVinculo.findFirst({
      where: { cardOrigemId: card.id, cardDestino: { pipelineId, empresaId: card.empresaId, status: { not: "ARQUIVADO" } } },
      select: { cardDestinoId: true },
    });
    if (vinculoExistente) {
      if (handoffOperacional) await completarHandoff(tx, vinculoExistente.cardDestinoId);
      if (handoffFinanceiro) await copiarCamposCardVinculado(tx, card.id, vinculoExistente.cardDestinoId, pipelineId, etapaId);
      return { cardId: vinculoExistente.cardDestinoId, existente: true, versao: card.versao };
    }
    if (administrativo && administrativo.versaoEsperada !== card.versao) throw new Error("O card foi atualizado. Recarregue e tente novamente.");
    const lock = await tx.bpmCard.updateMany({ where: { id: card.id, versao: card.versao }, data: { versao: { increment: 1 } } });
    if (lock.count !== 1) throw new Error("O card foi atualizado. Recarregue e tente novamente.");
    // Recheck after the CAS write lock; another execution may have completed this negotiation.
    const concorrente = await tx.bpmCardVinculo.findFirst({ where: { cardOrigemId: card.id,
      cardDestino: { pipelineId, empresaId: card.empresaId, status: { not: "ARQUIVADO" } } }, select: { cardDestinoId: true } });
    if (concorrente) return { cardId: concorrente.cardDestinoId, existente: true, versao: card.versao + 1 };
    // No Operacional a identidade do processo é a negociação de origem. Um
    // card ativo da mesma empresa pode corresponder a outra contratação.
    if (parametros.somenteSeNaoExistirAtivo && !handoffOperacional) {
      const existente = await tx.bpmCard.findFirst({ where: { empresaId: card.empresaId, pipelineId, status: "ATIVO" }, select: { id: true } });
      if (existente && !handoffFinanceiro) {
        {
          if (vincular) await tx.bpmCardVinculo.upsert({ where: { cardOrigemId_cardDestinoId: { cardOrigemId: card.id, cardDestinoId: existente.id } },
            create: { cardOrigemId: card.id, cardDestinoId: existente.id }, update: {} });
          await completarHandoff(tx, existente.id);
        }
        return { cardId: existente.id, existente: true, versao: card.versao + 1 };
      }
    }
      const criado = await tx.bpmCard.create({ data: { empresaId: card.empresaId, pipelineId, etapaId, responsavelId: Number(parametros.responsavelId ?? card.responsavelId), servico: parametros.servico ? String(parametros.servico) : card.servico, membros: { create: { userId: Number(parametros.responsavelId ?? card.responsavelId), role: "RESPONSAVEL" } } } });
      if (vincular) await tx.bpmCardVinculo.create({ data: { cardOrigemId: card.id, cardDestinoId: criado.id } });
      if (!handoffOperacional) await copiarCamposCardVinculado(tx, card.id, criado.id, pipelineId, etapaId);
      if (handoffOperacional) {
        await completarHandoff(tx, criado.id);
        await tx.bpmCardHistorico.create({ data: {
          cardId: criado.id, acao: "CARD_CRIADO_POR_AUTOMACAO", automacaoOrigem: execucao.automacaoId,
          valorNovoJson: JSON.stringify({
            cardOrigemId: card.id, pipelineOrigem: card.pipeline.nome,
            negociacaoOrigemId: negociacao?.cardOrigemId ?? null,
            vendedorResponsavelId: negociacao?.cardOrigem.responsavelId ?? null,
            parceiroOrigemId: negociacao?.cardOrigem.indicacaoOrigem?.parceiroId ?? null,
          }),
        } });
      }
      await criarSlaInstancia({ cardId: criado.id }, "ENTRADA_ETAPA", tx, criado.createdAt);
      if (!administrativo) await ativarCadenciasNaEntradaBpm({
        cardId: criado.id,
        pipelineAnteriorId: null,
        etapaAnteriorId: null,
        pipelineDestinoId: pipelineId,
        etapaDestinoId: etapaId,
        evento: "CARD_CRIADO",
        automacaoOrigem: execucao.automacaoId,
        agora: criado.createdAt,
      }, tx);
      await tx.bpmCardHistorico.create({ data: { cardId: card.id, acao: "CARD_ENCAMINHADO",
        usuarioId: administrativo?.usuarioId ?? null, automacaoOrigem: input.automacaoId,
        valorNovoJson: JSON.stringify({ execucaoId: input.execucaoId, cardDestinoId: criado.id, pipelineDestinoId: pipelineId,
          etapaDestinoId: etapaId, excecaoAdministrativa: Boolean(administrativo), statusOrigemPreservado: card.status }) } });
      await publicarEventoBpm({ tipo: "CARD_CRIADO", entidadeTipo: "CARD", entidadeId: criado.id, cardId: criado.id,
        pipelineId, valorNovo: { etapaId, cardOrigemId: card.id, ...(administrativo ? { automacoesSuprimidas: true } : {}) }, atorTipo: administrativo ? "USUARIO" : "AUTOMACAO",
        atorUserId: administrativo?.usuarioId, atorExecucaoId: input.execucaoId, correlationId: contexto.correlationId,
        causationId: contexto.causationId, profundidade: contexto.profundidade, idempotencyKey: `automacao:${input.execucaoId}:card-criado:${criado.id}` }, tx);
      return { cardId: criado.id, existente: false, versao: card.versao + 1 };
  };
  return client ? executar(client) : db.$transaction(executar);
}
