"use server";
import db from "@/lib/prisma";
import { criarSlaInstancia } from "@/lib/bpm/sla";
import { auth } from "../../../auth";
import { promoverNolossLeadSchema } from "@/lib/validations/bpm";
import {
  exigirAcessoBpmCard,
  exigirAcessoBpmPipeline,
  usuarioElegivelResponsavelBpm,
} from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { notificarPendenciasLeadsBpm } from "@/lib/bpm/notificacoes-leads-server";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";
import { resolverAutoridadeAdministrativaPipeline } from "@/lib/bpm/acesso-pipeline";
import { ativarCadenciasNaEntradaBpm } from "@/lib/bpm/cadencias/ativacao-automatica";
import { cnpjEhValido, normalizarCNPJ } from "@/lib/format-cnpj";
import { erroEhCnpjDuplicado } from "@/lib/cnpj/erro-unicidade";
import { proporVinculoEmpresaPorCnpj, ErroVinculoEmpresa } from "@/lib/bpm/cnpj-empresa-vinculo-server";
import { CODIGO_CNPJ_EXISTENTE, MENSAGEM_CNPJ_EXISTENTE } from "@/lib/bpm/cnpj-empresa-vinculo";
import { etapaEhNovosLeads } from "@/lib/bpm/novos-leads";
import { normalizarNomeEtapa } from "@/lib/bpm/novos-leads";
import { verificarTransicaoPermitidaBpm } from "@/lib/bpm/requisitos-etapa-server";

async function obterPipelineRevisaoRadar() {
  return db.bpmPipeline.findFirst({
    where: { nome: "Revisão de Radar", ativo: true },
    select: { id: true, visualizacaoConfigJson: true, setores: { select: { setor: { select: { id: true, nome: true, ativo: true } } } } },
  });
}

export async function PromoverNolossLead(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = promoverNolossLeadSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos para promover lead" };
    const { nolossLeadId, etapaDestinoId, responsavelId, cnpj, radarPretendido, qualificacao } = parsed.data;

    const pipeline = await obterPipelineRevisaoRadar();
    if (!pipeline) return { success: false, error: "Pipeline Revisão de Radar não encontrado" };

    await exigirAcessoBpmPipeline(pipeline.id, userId);

    const [etapaDestino, usuarioAtual] = await Promise.all([
      db.bpmEtapa.findFirst({
        where: { id: etapaDestinoId, pipelineId: pipeline.id, ativo: true },
        select: {
          id: true,
          nome: true,
          visibilidades: {
            select: { perfil: true, podeVer: true, podeAgir: true },
          },
        },
      }),
      db.usuarios.findUnique({ where: { id: userId }, select: { role: true } }),
    ]);
    if (!etapaDestino) return { success: false, error: "Etapa de destino inválida" };
    if (!etapaEhNovosLeads(etapaDestino.nome)
      && !["agendar reunião", "standby", "stand by", "standby - follow up", "stand-by — follow-up semanal"].includes(normalizarNomeEtapa(etapaDestino.nome))) {
      return { success: false, error: "Novo Lead só pode avançar para Agendar reunião ou Standby." };
    }
    const administradorPipeline = Boolean(resolverAutoridadeAdministrativaPipeline({
      usuarioId: userId, role: usuarioAtual?.role ?? "",
      setoresPipeline: pipeline.setores?.map(({ setor }) => setor) ?? [],
      visualizacaoConfigJson: pipeline.visualizacaoConfigJson,
    }));
    if (!administradorPipeline && !resolverVisibilidadeEtapa(
      usuarioAtual?.role,
      etapaDestino.visibilidades,
    ).podeAgir) {
      return { success: false, error: "Seu perfil não pode agir na etapa de destino." };
    }
    const etapaInicial = etapaEhNovosLeads(etapaDestino.nome) ? etapaDestino : await db.bpmEtapa.findFirst({
      where: { pipelineId: pipeline.id, ativo: true, ehInicial: true },
      select: { id: true, nome: true, visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } } },
    });
    const acessoOrigem = etapaInicial && resolverVisibilidadeEtapa(usuarioAtual?.role, etapaInicial.visibilidades);
    if (!etapaInicial || !etapaEhNovosLeads(etapaInicial.nome) || (!administradorPipeline && (!acessoOrigem?.podeVer || !acessoOrigem.podeAgir))) {
      return { success: false, error: "Seu perfil não pode agir na coluna de novos leads." };
    }
    if (etapaInicial.id !== etapaDestinoId && !(await verificarTransicaoPermitidaBpm(etapaInicial.id, etapaDestinoId, "MANUAL")).permitida) {
      return { success: false, error: "A transição de Novo Lead para esta etapa não está permitida." };
    }


    if (!(await usuarioElegivelResponsavelBpm(pipeline.id, responsavelId))) {
      return { success: false, error: "Responsável inválido para este pipeline." };
    }

    const nolossLead = await db.nolossLead.findUnique({
      where: { id: nolossLeadId },
      select: { id: true, status: true, nome: true, email: true, utmSource: true, utmMedium: true },
    });
    if (!nolossLead || nolossLead.status !== "pending") {
      return { success: false, error: "Lead não encontrado ou já processado" };
    }

    const resultado = await db.$transaction(async (tx) => {
      await exigirAcessoBpmPipeline(pipeline.id, userId, tx);
      const [destinoAtual, perfilAtual, origemAtual] = await Promise.all([
        tx.bpmEtapa.findFirst({
          where: { id: etapaDestinoId, pipelineId: pipeline.id, ativo: true },
          select: {
            pipeline: { select: { visualizacaoConfigJson: true, setores: { select: { setor: { select: { id: true, nome: true, ativo: true } } } } } },
            visibilidades: {
              select: { perfil: true, podeVer: true, podeAgir: true },
            },
          },
        }),
        tx.usuarios.findUnique({ where: { id: userId }, select: { role: true } }),
        tx.bpmEtapa.findFirst({ where: { id: etapaInicial.id, pipelineId: pipeline.id, ativo: true },
          select: { visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } } } }),
      ]);
      const origemPermitida = origemAtual && resolverVisibilidadeEtapa(perfilAtual?.role, origemAtual.visibilidades);
      const administradorAtual = Boolean(resolverAutoridadeAdministrativaPipeline({
        usuarioId: userId, role: perfilAtual?.role ?? "",
        setoresPipeline: destinoAtual?.pipeline?.setores.map(({ setor }) => setor) ?? [],
        visualizacaoConfigJson: destinoAtual?.pipeline?.visualizacaoConfigJson,
      }));
      if (!origemAtual || !destinoAtual || (!administradorAtual && (!origemPermitida?.podeVer || !origemPermitida.podeAgir || !resolverVisibilidadeEtapa(
        perfilAtual?.role,
        destinoAtual.visibilidades,
      ).podeAgir))) {
        throw new Error("VISIBILIDADE_ETAPA_NEGADA");
      }

      const campos = await tx.bpmCampo.findMany({
        where: {
          pipelineId: pipeline.id, ativo: true,
          nome: { in: ["Radar pretendido", "Canal de origem", "Qualificação"] },
          etapaConfiguracoes: { some: { visivel: true, etapa: { pipelineId: pipeline.id } } },
        },
        select: { id: true, nome: true, tipo: true, opcoesJson: true, opcoes: { where: { ativo: true }, select: { rotulo: true } } },
      });
      const campoRadar = campos.find((campo) => campo.nome === "Radar pretendido");
      if (!campoRadar || campoRadar.tipo !== "selecao") throw new Error("RADAR_CAMPO_NAO_CONFIGURADO");
      const opcoesLegadas = (() => { try { return JSON.parse(campoRadar.opcoesJson ?? "[]"); } catch { return []; } })();
      const opcoesRadar = campoRadar.opcoes.length > 0
        ? campoRadar.opcoes.map((opcao) => opcao.rotulo)
        : Array.isArray(opcoesLegadas) ? opcoesLegadas.filter((opcao): opcao is string => typeof opcao === "string") : [];
      if (!radarPretendido || !opcoesRadar.includes(radarPretendido)) throw new Error("RADAR_OPCAO_INVALIDA");

      // CAS: garante que nenhuma outra promoção concorrente já consumiu este lead.
      const reservado = await tx.nolossLead.updateMany({
        where: { id: nolossLeadId, status: "pending" },
        data: { status: "promoted" },
      });
      if (reservado.count !== 1) return null;

      const razaoSocial = nolossLead.nome?.trim() || nolossLead.email?.trim() || "Lead sem nome";
      const clienteExistente = cnpj
        ? await tx.cliente.findUnique({ where: { cnpj }, select: { id: true } })
        : null;
      const cliente = clienteExistente ?? await tx.cliente.create({
        data: { razaoSocial, cnpj: cnpj ?? null, status: "ATIVO" },
        select: { id: true },
      });

      const card = await tx.bpmCard.create({
        data: {
          empresaId: cliente.id,
          pipelineId: pipeline.id,
          etapaId: etapaDestino.id,
          responsavelId,
          status: "ATIVO",
        },
        select: { id: true, createdAt: true },
      });

      const canalOrigem = nolossLead.utmSource?.trim() || nolossLead.utmMedium?.trim() || "NoLoss";
      for (const [nome, valor] of [
        ["Radar pretendido", radarPretendido],
        ["Canal de origem", canalOrigem],
        ["Qualificação", qualificacao],
      ] as const) {
        if (!valor) continue;
        const campo = campos.find((item) => item.nome === nome);
        if (!campo) throw new Error("NOVO_LEAD_CAMPO_NAO_CONFIGURADO");
        await tx.bpmCardCampoValor.create({ data: { cardId: card.id, campoId: campo.id, valor } });
      }

      await tx.nolossLead.update({
        where: { id: nolossLeadId },
        data: {
          promotedClienteId: cliente.id,
          promotedCardId: card.id,
          promotedAt: new Date(),
          promotedByUserId: userId,
        },
      });

      await criarSlaInstancia({ cardId: card.id }, "ENTRADA_ETAPA", tx, card.createdAt);
      await ativarCadenciasNaEntradaBpm({
        cardId: card.id,
        pipelineAnteriorId: null,
        etapaAnteriorId: null,
        pipelineDestinoId: pipeline.id,
        etapaDestinoId: etapaDestino.id,
        evento: "CARD_CRIADO",
        usuarioId: userId,
      }, tx);

      return { cardId: card.id };
    });

    if (!resultado) {
      return { success: false, error: "Lead não encontrado ou já processado" };
    }

    await notificarPendenciasLeadsBpm({ pipelineId: pipeline.id });
    await notificarPipelineBpm({
      pipelineId: pipeline.id,
      cardId: resultado.cardId,
      tipo: "CARD_CRIADO",
    });

    return { success: true, data: resultado };
  } catch (error) {
    console.error("[PromoverNolossLead]", error);
    const msg = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado"
      : error instanceof Error && error.message === "VISIBILIDADE_ETAPA_NEGADA"
        ? "Seu perfil não pode agir na etapa de destino."
        : error instanceof Error && error.message === "RADAR_OPCAO_INVALIDA"
          ? "Selecione uma opção válida de Radar pretendido."
        : error instanceof Error && error.message === "RADAR_CAMPO_NAO_CONFIGURADO"
          ? "Configure o campo Radar pretendido como seleção no Novo Lead."
        : error instanceof Error && error.message === "NOVO_LEAD_CAMPO_NAO_CONFIGURADO"
          ? "Configure os campos de Canal de origem e Qualificação no Novo Lead."
        : "Erro ao promover lead";
    return { success: false, error: msg };
  }
}

/** Completa opcionalmente o CNPJ de um card comprovadamente originado no NoLoss. */
export async function PreencherCnpjCardNoloss(cardId: string, cnpjInformado: string) {
  let usuario: { id: number; role: string | null } | null = null;
  const cnpj = normalizarCNPJ(cnpjInformado);
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    usuario = { id: Number(session.user.id), role: session.user.role ?? null };
    if (cnpjInformado.replace(/\D/g, "").length !== 14 || !cnpjEhValido(cnpj)) {
      return { success: false, error: "Informe um CNPJ válido." };
    }
    await exigirAcessoBpmCard(cardId, Number(session.user.id), session.user.role ?? null, "editarCard");
    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: { empresaId: true, pipelineId: true, versao: true, updatedAt: true,
        empresa: { select: { cnpj: true, updatedAt: true } },
        pipeline: { select: { nome: true } }, nolossLeadOrigem: { select: { id: true }, take: 1 } },
    });
    if (!card || card.pipeline.nome !== "Revisão de Radar" || card.nolossLeadOrigem.length === 0) {
      return { success: false, error: "Card de origem NoLoss não encontrado." };
    }
    if (card.empresa.cnpj) return { success: false, error: "Este cliente já possui CNPJ." };
    const atualizado = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(cardId, usuario!.id, usuario!.role, "editarCard", tx);
      const atual = await tx.bpmCard.findUnique({ where: { id: cardId }, select: {
        empresaId: true, pipelineId: true, versao: true, updatedAt: true,
        empresa: { select: { cnpj: true, updatedAt: true } },
        pipeline: { select: { nome: true } }, nolossLeadOrigem: { select: { id: true }, take: 1 },
      } });
      if (!atual || atual.empresaId !== card.empresaId || atual.pipelineId !== card.pipelineId
        || atual.versao !== card.versao || atual.updatedAt.getTime() !== card.updatedAt.getTime()
        || atual.pipeline.nome !== "Revisão de Radar" || !atual.nolossLeadOrigem.length) {
        throw new ErroVinculoEmpresa("O card mudou durante a edição. Recarregue e tente novamente.", "VINCULO_EMPRESA_CONFLITO");
      }
      if (atual.empresa.cnpj) return false;
      const propostaVinculo = await proporVinculoEmpresaPorCnpj({ cardId, cnpj, modo: "NOLOSS" }, usuario!, tx);
      if (propostaVinculo) return { propostaVinculo };
      const resultado = await tx.cliente.updateMany({ where: { id: atual.empresaId, cnpj: atual.empresa.cnpj,
        updatedAt: atual.empresa.updatedAt }, data: { cnpj } });
      if (resultado.count !== 1) return false;
      await tx.bpmCardHistorico.create({ data: {
        cardId, acao: "CNPJ_PREENCHIDO_NOLOSS", usuarioId: Number(session.user.id),
        valorNovoJson: JSON.stringify({ preenchido: true }),
      } });
      return true;
    });
    if (typeof atualizado === "object") return { success: false as const, error: MENSAGEM_CNPJ_EXISTENTE,
      code: CODIGO_CNPJ_EXISTENTE, propostaVinculo: atualizado.propostaVinculo };
    if (!atualizado) return { success: false, error: "O CNPJ já foi preenchido. Recarregue o card." };
    await Promise.allSettled([notificarPipelineBpm({ pipelineId: card.pipelineId, cardId, tipo: "CARD_ATUALIZADO" })]);
    return { success: true };
  } catch (error) {
    if (error instanceof ErroVinculoEmpresa) return { success: false as const, error: error.message, code: error.code };
    if (erroEhCnpjDuplicado(error) && usuario) {
      try {
        const propostaVinculo = await proporVinculoEmpresaPorCnpj({ cardId, cnpj, modo: "NOLOSS" }, usuario);
        if (propostaVinculo) return { success: false as const, error: MENSAGEM_CNPJ_EXISTENTE, code: CODIGO_CNPJ_EXISTENTE, propostaVinculo };
      } catch (conflito) {
        if (conflito instanceof ErroVinculoEmpresa) return { success: false as const, error: conflito.message, code: conflito.code };
      }
      return { success: false, error: "Este CNPJ já pertence a outra empresa. Recarregue o card antes de confirmar o vínculo." };
    }
    console.error("[PreencherCnpjCardNoloss]", error);
    return { success: false, error: "Não foi possível salvar o CNPJ." };
  }
}
