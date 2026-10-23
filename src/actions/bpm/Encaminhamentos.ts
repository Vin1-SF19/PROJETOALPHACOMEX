"use server";

import { z } from "zod";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { ehFechamentoComercialLivre } from "@/lib/bpm/automacoes/financeiro-movimento-livre";
import { validarRecuperacaoFinanceiraAtual } from "@/lib/bpm/automacoes/recuperacao-financeiro-server";
import { bpmCardIdSchema, etapaIdCardSchema } from "@/lib/validations/bpm";
import { exigirAcessoBpmCard, exigirAcessoBpmPipeline, isAdminRole } from "@/lib/bpm/ownership";
import { parametrosEncaminhamentoSchema } from "@/lib/bpm/automacoes/schemas";
import { executarEncaminhamentoBpm } from "@/lib/bpm/automacoes/encaminhamento";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { notificarPendenciasLeadsBpm } from "@/lib/bpm/notificacoes-leads-server";

export type EncaminhamentoCardBpm = {
  automacaoId: string; nome: string;
  destinoPipeline: { id: string; nome: string }; destinoEtapa: { id: string; nome: string };
  estado: "NAO_DISPARADO" | "AGUARDANDO" | "ENVIADO" | "FALHOU" | "INDISPONIVEL";
  motivo: string | null; solicitadoEm: string | null; enviadoEm: string | null;
  execucaoId: string | null; cardDestinoId: string | null;
  podeEnviar: boolean; podeRepetir: boolean; excecaoAdministrativa: boolean; automaticoFinanceiro?: boolean;
};

const solicitarSchema = z.object({ cardId: bpmCardIdSchema, automacaoId: z.string().cuid(),
  etapaOrigemEsperadaId: etapaIdCardSchema, versaoEsperada: z.number().int().nonnegative(),
  idempotencyKey: z.string().trim().min(8).max(160) }).strict();
const repetirSchema = z.object({ cardId: bpmCardIdSchema, execucaoId: z.string().cuid() }).strict();
const selectCard = { id: true, pipelineId: true, etapaId: true, versao: true, status: true, empresaId: true };

async function identidade(cardId: string, admin = false) {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isInteger(userId) || userId < 1) throw new Error("Não autorizado");
  const usuario = await db.usuarios.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true } });
  if (!usuario || usuario.status !== "ATIVO" || admin && !isAdminRole(usuario.role)) throw new Error("Não autorizado");
  // Reading a previously forwarded/concluded source is necessary for safe retries.
  await exigirAcessoBpmCard(cardId, userId, usuario.role, "visualizar");
  return usuario;
}

function erroPublico(error: unknown) {
  if (error instanceof z.ZodError) return "Revise os dados do encaminhamento.";
  if (error instanceof Error && ["Não autorizado", "Recuperação disponível somente no fechamento comercial.", "Regra automática de envio ao Financeiro indisponível.", "As condições do envio automático ao Financeiro não foram atendidas.", "Card indisponível para encaminhamento", "Automação indisponível para esta etapa.",
    "O card mudou de etapa ou foi atualizado. Recarregue antes de encaminhar.", "Encaminhamento não encontrado.",
    "O encaminhamento já está em andamento.", "Somente encaminhamentos administrativos com falha podem ser repetidos aqui.",
    "Pipeline de destino inativo", "Pipeline/etapa de destino inválidos", "O card foi atualizado. Recarregue e tente novamente.",
    "O card mudou de etapa. Atualize antes de encaminhar.",
    "A configuração do envio mudou. Atualize o card e solicite um novo encaminhamento."].includes(error.message)) return error.message;
  return "Não foi possível encaminhar. Atualize o card e tente novamente.";
}

/** Status is independent from the card's current column; hidden destinations never leak data. */
export async function ObterEncaminhamentosCardBpm(cardIdInput: string) {
  try {
    const cardId = bpmCardIdSchema.parse(cardIdInput);
    const usuario = await identidade(cardId);
    const card = await db.bpmCard.findUnique({ where: { id: cardId }, select: { ...selectCard, pipeline: { select: { nome: true, chave: true } }, etapa: { select: { nome: true, chave: true } } } });
    if (!card) throw new Error("Card indisponível para encaminhamento");
    const automacoes = await db.bpmAutomacao.findMany({ where: { pipelineId: card.pipelineId,
      acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE", OR: [{ etapaId: card.etapaId, ativa: true }, { execucoes: { some: { cardId } } }] },
      select: { id: true, nome: true, etapaId: true, ativa: true, parametrosJson: true,
        execucoes: { where: { cardId }, orderBy: { createdAt: "desc" }, take: 1,
          select: { id: true, status: true, gatilhoTipo: true, createdAt: true, executadoEm: true } } },
      orderBy: { createdAt: "asc" }, take: 50 });
    const regras: EncaminhamentoCardBpm[] = [];
    for (const automacao of automacoes) {
      let bruto: unknown;
      try { bruto = JSON.parse(automacao.parametrosJson); } catch { continue; }
      const parsed = parametrosEncaminhamentoSchema.safeParse(bruto);
      if (!parsed.success) continue;
      try { await exigirAcessoBpmPipeline(parsed.data.pipelineId, usuario.id); } catch { continue; }
      const etapa = await db.bpmEtapa.findFirst({ where: { id: parsed.data.etapaId, pipelineId: parsed.data.pipelineId },
        select: { id: true, nome: true, ativo: true, pipeline: { select: { id: true, nome: true, chave: true, ativo: true } } } });
      if (!etapa) continue;
      const vinculo = await db.bpmCardVinculo.findFirst({ where: { cardOrigemId: card.id,
        cardDestino: { pipelineId: etapa.pipeline.id, empresaId: card.empresaId, status: { not: "ARQUIVADO" } } },
        select: { cardDestinoId: true, createdAt: true } });
      if (vinculo) {
        try { await exigirAcessoBpmCard(vinculo.cardDestinoId, usuario.id, usuario.role, "visualizar"); }
        catch { continue; }
      }
      let execucao: (typeof automacao.execucoes)[number] | undefined = automacao.execucoes[0];
      let configuracaoAlterada = false;
      if (execucao?.gatilhoTipo === "ENCAMINHAMENTO_ADMIN") {
        const autorizacao = await db.bpmCardHistorico.findFirst({ where: { cardId, acao: "ENCAMINHAMENTO_ADMIN_SOLICITADO",
          valorNovoJson: { contains: execucao.id } }, orderBy: { createdAt: "desc" }, select: { valorNovoJson: true } });
        try {
          const anterior = parametrosEncaminhamentoSchema.parse(JSON.parse(autorizacao?.valorNovoJson ?? "{}").parametros);
          configuracaoAlterada = JSON.stringify(anterior) !== JSON.stringify(parsed.data);
        } catch { configuracaoAlterada = true; }
        if (configuracaoAlterada) execucao = undefined;
      }
      const disponivel = automacao.ativa && etapa.ativo && etapa.pipeline.ativo && automacao.etapaId === card.etapaId && card.status !== "ARQUIVADO";
      const aguardando = Boolean(execucao && ["PENDENTE", "EM_EXECUCAO", "AGUARDANDO"].includes(execucao.status));
      const falhou = execucao?.status === "FALHA";
      const estado: EncaminhamentoCardBpm["estado"] = vinculo ? "ENVIADO" : aguardando ? "AGUARDANDO" : falhou ? "FALHOU" : disponivel ? "NAO_DISPARADO" : "INDISPONIVEL";
      const admin = isAdminRole(usuario.role);
      const automaticoFinanceiro = admin && disponivel && Boolean(card.pipeline && card.etapa) && ehFechamentoComercialLivre(card.pipeline, card.etapa) && etapa.pipeline.chave === "financeiro";
      regras.push({ automacaoId: automacao.id, nome: automacao.nome, destinoPipeline: etapa.pipeline,
        destinoEtapa: { id: etapa.id, nome: etapa.nome }, estado,
        motivo: estado === "NAO_DISPARADO" ? automaticoFinanceiro ? "O envio ao Financeiro será realizado automaticamente." : configuracaoAlterada
          ? "A regra de envio mudou. Confira o destino atualizado e use Encaminhar para solicitar o novo envio."
          : "Reposicionar o card não executa o envio. Use Encaminhar para enviar ao próximo setor."
          : estado === "AGUARDANDO" ? "O encaminhamento está sendo processado."
          : estado === "FALHOU" ? execucao?.gatilhoTipo === "ENCAMINHAMENTO_ADMIN"
            ? "O envio falhou. Verifique a regra e tente novamente neste encaminhamento."
            : "A automação falhou. O Admin pode solicitar um novo encaminhamento apenas para este envio, sem repetir outras ações."
          : estado === "INDISPONIVEL" ? "A regra está inativa ou o card não está mais na etapa de envio." : null,
        solicitadoEm: execucao?.createdAt.toISOString() ?? null,
        enviadoEm: vinculo ? vinculo.createdAt.toISOString() : null,
        execucaoId: execucao?.id ?? null, cardDestinoId: vinculo?.cardDestinoId ?? null,
        podeEnviar: admin && disponivel && !vinculo && !aguardando && (!falhou || execucao?.gatilhoTipo !== "ENCAMINHAMENTO_ADMIN"),
        podeRepetir: admin && disponivel && !vinculo && falhou && execucao?.gatilhoTipo === "ENCAMINHAMENTO_ADMIN",
        excecaoAdministrativa: admin, automaticoFinanceiro });
    }
    return { success: true as const, data: { regras } };
  } catch (error) { return { success: false as const, error: erroPublico(error) }; }
}

async function executarSelecionado(cardId: string, execucaoId: string) {
  const execucao = await db.bpmAutomacaoExecucao.findUnique({ where: { id: execucaoId },
    select: { id: true, automacaoId: true, cardId: true, automacao: { select: { parametrosJson: true } } } });
  if (!execucao || execucao.cardId !== cardId) throw new Error("Encaminhamento não encontrado.");
  try {
    const resultado = await db.$transaction(async (tx) => {
      const enviado = await executarEncaminhamentoBpm({ cardId, execucaoId,
        automacaoId: execucao.automacaoId, parametros: JSON.parse(execucao.automacao.parametrosJson) }, tx);
      await tx.bpmAutomacaoExecucao.update({ where: { id: execucaoId }, data: { status: "SUCESSO", mensagemErro: null,
        resultadoJson: JSON.stringify(enviado), executadoEm: new Date() } });
      return enviado;
    });
    // All post-commit effects are isolated from the durable execution outcome.
    await Promise.allSettled([
      Promise.resolve().then(() => revalidatePath("/PainelAlpha/AlphaCRM")),
      notificarPipelineBpm({ cardId, tipo: "CARD_ATUALIZADO" }),
      notificarPipelineBpm({ cardId: resultado.cardId, tipo: "CARD_CRIADO" }),
      ...( "recepcao" in resultado && resultado.recepcao ? [notificarPendenciasLeadsBpm(resultado.recepcao)] : []),
    ]);
    return { success: true as const, data: { execucaoId, cardDestinoId: resultado.cardId, existente: resultado.existente, versao: resultado.versao } };
  } catch (error) {
    await db.bpmAutomacaoExecucao.update({ where: { id: execucaoId }, data: { status: "FALHA",
      mensagemErro: erroPublico(error), executadoEm: new Date() } });
    throw error;
  }
}

async function solicitarEncaminhamento(input: z.input<typeof solicitarSchema>, automaticoFinanceiro = false) {
  try {
    const dados = solicitarSchema.parse(input);
    const usuario = await identidade(dados.cardId, true);
    const automacao = await db.bpmAutomacao.findFirst({ where: { id: dados.automacaoId, ativa: true,
      acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE" }, select: { id: true, pipelineId: true, etapaId: true, parametrosJson: true } });
    if (!automacao) throw new Error("Automação indisponível para esta etapa.");
    const parametros = parametrosEncaminhamentoSchema.parse(JSON.parse(automacao.parametrosJson));
    await exigirAcessoBpmPipeline(parametros.pipelineId, usuario.id);
    const configuracaoHash = createHash("sha256").update(JSON.stringify(parametros)).digest("hex").slice(0, 16);
    const eventoChave = `ENCAMINHAMENTO_ADMIN:${dados.cardId}:${parametros.pipelineId}:${configuracaoHash}`;
    const preparada = await db.$transaction(async (tx) => {
      if (automaticoFinanceiro) await validarRecuperacaoFinanceiraAtual(tx, dados.cardId, automacao.id, parametros);
      const existente = await tx.bpmAutomacaoExecucao.findUnique({ where: { automacaoId_eventoChave: { automacaoId: automacao.id, eventoChave } },
        select: { id: true, status: true } });
      if (existente) return existente;
      const card = await tx.bpmCard.findUnique({ where: { id: dados.cardId }, select: selectCard });
      if (!card || card.status === "ARQUIVADO" || card.pipelineId !== automacao.pipelineId || card.etapaId !== automacao.etapaId) throw new Error("Automação indisponível para esta etapa.");
      if (card.etapaId !== dados.etapaOrigemEsperadaId || card.versao !== dados.versaoEsperada) throw new Error("O card mudou de etapa ou foi atualizado. Recarregue antes de encaminhar.");
      const execucao = await tx.bpmAutomacaoExecucao.create({ data: { cardId: dados.cardId, automacaoId: automacao.id,
        eventoChave, gatilhoTipo: "ENCAMINHAMENTO_ADMIN", status: "EM_EXECUCAO", iniciadoEm: new Date(), tentativas: 1 },
        select: { id: true, status: true } });
      await tx.bpmCardHistorico.create({ data: { cardId: dados.cardId, usuarioId: usuario.id,
        acao: "ENCAMINHAMENTO_ADMIN_SOLICITADO", automacaoOrigem: automacao.id,
        valorNovoJson: JSON.stringify({ execucaoId: execucao.id, pipelineDestinoId: parametros.pipelineId,
          etapaOrigemId: card.etapaId, etapaDestinoId: parametros.etapaId, versaoEsperada: card.versao, parametros, idempotencyKey: dados.idempotencyKey,
          excecaoAdministrativa: true, statusOrigemPreservado: card.status,
          ...(automaticoFinanceiro ? { recuperacaoAutomaticaFinanceiro: true } : {}) }) } });
      return { ...execucao, criada: true };
    });
    if (!("criada" in preparada)) {
      if (preparada.status !== "SUCESSO") throw new Error("O encaminhamento já está em andamento.");
      const card = await db.bpmCard.findUnique({ where: { id: dados.cardId }, select: { versao: true, empresaId: true } });
      const vinculo = card ? await db.bpmCardVinculo.findFirst({ where: { cardOrigemId: dados.cardId,
        cardDestino: { pipelineId: parametros.pipelineId, empresaId: card.empresaId, status: { not: "ARQUIVADO" } } }, select: { cardDestinoId: true } }) : null;
      if (!vinculo || !card) throw new Error("Encaminhamento não encontrado.");
      await exigirAcessoBpmCard(vinculo.cardDestinoId, usuario.id, usuario.role, "visualizar");
      return { success: true as const, data: { execucaoId: preparada.id, cardDestinoId: vinculo.cardDestinoId, existente: true, versao: card.versao } };
    }
    return await executarSelecionado(dados.cardId, preparada.id);
  } catch (error) { return { success: false as const, error: erroPublico(error) }; }
}

export async function SolicitarEncaminhamentoCardBpm(input: z.input<typeof solicitarSchema>) {
  return solicitarEncaminhamento(input);
}

/** Abertura autenticada recupera somente o Financeiro pendente deste card. */
export async function RecuperarEncaminhamentoFinanceiroCardBpm(input: z.input<typeof solicitarSchema>) {
  return solicitarEncaminhamento(input, true);
}

export async function RepetirEncaminhamentoCardBpm(input: z.input<typeof repetirSchema>) {
  try {
    const dados = repetirSchema.parse(input);
    const usuario = await identidade(dados.cardId, true);
    await db.$transaction(async (tx) => {
      const execucao = await tx.bpmAutomacaoExecucao.findFirst({ where: { id: dados.execucaoId, cardId: dados.cardId,
        gatilhoTipo: "ENCAMINHAMENTO_ADMIN", status: "FALHA" }, select: { id: true, automacaoId: true,
          automacao: { select: { ativa: true, acaoTipo: true, pipelineId: true, etapaId: true, parametrosJson: true } } } });
      const card = await tx.bpmCard.findUnique({ where: { id: dados.cardId }, select: selectCard });
      if (!execucao || !card || !execucao.automacao.ativa || execucao.automacao.acaoTipo !== "CRIAR_CARD_OUTRO_PIPELINE"
        || execucao.automacao.etapaId !== card.etapaId || execucao.automacao.pipelineId !== card.pipelineId) {
        throw new Error("Somente encaminhamentos administrativos com falha podem ser repetidos aqui.");
      }
      const parametros = parametrosEncaminhamentoSchema.parse(JSON.parse(execucao.automacao.parametrosJson));
      const autorizacaoAnterior = await tx.bpmCardHistorico.findFirst({ where: { cardId: dados.cardId,
        acao: "ENCAMINHAMENTO_ADMIN_SOLICITADO", valorNovoJson: { contains: dados.execucaoId } },
        orderBy: { createdAt: "desc" }, select: { valorNovoJson: true } });
      let parametrosAnteriores: unknown;
      let recuperacaoAutomaticaFinanceiro = false;
      try {
        const registro = JSON.parse(autorizacaoAnterior?.valorNovoJson ?? "{}");
        parametrosAnteriores = registro.parametros;
        recuperacaoAutomaticaFinanceiro = registro.recuperacaoAutomaticaFinanceiro === true;
      } catch { parametrosAnteriores = null; }
      const anterior = parametrosEncaminhamentoSchema.safeParse(parametrosAnteriores);
      if (!anterior.success || JSON.stringify(anterior.data) !== JSON.stringify(parametros)) {
        throw new Error("A configuração do envio mudou. Atualize o card e solicite um novo encaminhamento.");
      }
      await exigirAcessoBpmPipeline(parametros.pipelineId, usuario.id, tx);
      if (recuperacaoAutomaticaFinanceiro) await validarRecuperacaoFinanceiraAtual(tx, dados.cardId, execucao.automacaoId, parametros);
      const claim = await tx.bpmAutomacaoExecucao.updateMany({ where: { id: dados.execucaoId, status: "FALHA" },
        data: { status: "EM_EXECUCAO", iniciadoEm: new Date(), tentativas: { increment: 1 } } });
      if (claim.count !== 1) throw new Error("O encaminhamento já está em andamento.");
      await tx.bpmCardHistorico.create({ data: { cardId: dados.cardId, usuarioId: usuario.id,
        acao: "ENCAMINHAMENTO_ADMIN_SOLICITADO", automacaoOrigem: execucao.automacaoId,
        valorNovoJson: JSON.stringify({ execucaoId: execucao.id, pipelineDestinoId: parametros.pipelineId,
          etapaOrigemId: card.etapaId, etapaDestinoId: parametros.etapaId, versaoEsperada: card.versao, parametros,
          retentativa: true, excecaoAdministrativa: true, statusOrigemPreservado: card.status,
          ...(recuperacaoAutomaticaFinanceiro ? { recuperacaoAutomaticaFinanceiro: true } : {}) }) } });
    });
    return await executarSelecionado(dados.cardId, dados.execucaoId);
  } catch (error) { return { success: false as const, error: erroPublico(error) }; }
}
