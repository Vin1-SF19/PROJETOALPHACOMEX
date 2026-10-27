"use server";
import { carregarEscopoLeituraBpm } from "@/lib/bpm/visao-equipe-server";

import db from "@/lib/prisma";
import { auth } from "../../../auth";
import {
  checarAcessoBpmPipeline,
  checarAcessoConfigPipeline,
  exigirAcessoBpmCard,
  exigirAcessoModuloBpm,
} from "@/lib/bpm/ownership";
import { resolverNivelAcessoPipeline } from "@/lib/bpm/acesso-pipeline";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";
import { carregarCamposAplicaveisCardEtapa } from "@/lib/bpm/requisitos-etapa-server";

const POR_PAGINA = 20;

type LocalizacaoArquivamento = {
  pipelineNome: string;
  etapaNome: string;
};

function localizacaoArquivada(
  evento: { valorAnteriorJson: string | null } | null | undefined,
  atual: LocalizacaoArquivamento,
): LocalizacaoArquivamento {
  try {
    const dados = JSON.parse(evento?.valorAnteriorJson ?? "null") as Record<string, unknown> | null;
    if (typeof dados?.pipelineNome === "string" && typeof dados.etapaNome === "string") {
      return { pipelineNome: dados.pipelineNome, etapaNome: dados.etapaNome };
    }
  } catch { /* cards antigos preservam pipeline e etapa no próprio registro */ }
  return atual;
}

async function contextoArquivo() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = Number(session.user.id);
  await exigirAcessoModuloBpm(userId);
  const [admin, usuario, pipelines] = await Promise.all([
    checarAcessoConfigPipeline(userId, "visualizarPipeline"),
    db.usuarios.findUnique({ where: { id: userId }, select: { role: true } }),
    db.bpmPipeline.findMany({ select: { id: true, visualizacaoConfigJson: true, setores: { select: { setor: { select: { id: true, nome: true, ativo: true } } } } } }),
  ]);
  const acessos = await Promise.all(pipelines.map((pipeline) => checarAcessoBpmPipeline(pipeline.id, userId)));
  const pipelineIdsAdministrativos = pipelines.filter((pipeline) => resolverNivelAcessoPipeline({
    usuarioId: userId, role: usuario?.role ?? "", visualizacaoConfigJson: pipeline.visualizacaoConfigJson,
    setoresPipeline: pipeline.setores?.map(({ setor }) => setor) ?? [],
  }) === "ADMINISTRATIVO").map((pipeline) => pipeline.id);
  return { userId, admin, role: usuario?.role ?? null, pipelineIdsAdministrativos,
    pipelineIds: pipelines.filter((_, index) => acessos[index]).map((pipeline) => pipeline.id) };
}

export async function ListarCardsArquivadosBpm(pagina = 1) {
  try {
    const contexto = await contextoArquivo();
    const paginaValidada = Number.isSafeInteger(pagina) && pagina > 0 ? Math.min(pagina, 100000) : 1;
    const etapas = await db.bpmEtapa.findMany({
      where: { pipelineId: { in: contexto.pipelineIds } },
      select: { id: true, pipelineId: true, visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } } },
    });
    const etapaIds = etapas.filter((etapa) => contexto.admin || contexto.pipelineIdsAdministrativos.includes(etapa.pipelineId) || resolverVisibilidadeEtapa(contexto.role, etapa.visibilidades).podeVer)
      .map((etapa) => etapa.id);
    const escopoLeitura = await carregarEscopoLeituraBpm(contexto.userId, contexto.admin);
    const where = {
      status: "ARQUIVADO",
      pipelineId: { in: contexto.pipelineIds },
      etapaId: { in: etapaIds },
      ...escopoLeitura.where,
    };
    const [total, cards] = await Promise.all([
      db.bpmCard.count({ where }),
      db.bpmCard.findMany({
        where,
        select: {
          id: true, updatedAt: true, servico: true,
          empresa: { select: { razaoSocial: true, nomeFantasia: true, cnpj: true } },
          pipeline: { select: { nome: true } },
          etapa: { select: { nome: true } },
          responsavel: { select: { nome: true } },
          historico: { where: { acao: "CARD_ARQUIVADO" },
            orderBy: { createdAt: "desc" }, take: 1,
            select: { createdAt: true, valorAnteriorJson: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (paginaValidada - 1) * POR_PAGINA,
        take: POR_PAGINA,
      }),
    ]);
    return { success: true as const, data: {
      total, pagina: paginaValidada, porPagina: POR_PAGINA,
      cards: cards.map((card) => ({
        id: card.id, empresa: card.empresa, servico: card.servico,
        responsavel: card.responsavel.nome,
        arquivadoEm: card.historico[0]?.createdAt ?? card.updatedAt,
        localizacao: localizacaoArquivada(card.historico[0], {
          pipelineNome: card.pipeline.nome, etapaNome: card.etapa.nome,
        }),
      })),
    } };
  } catch (error) {
    console.error("[ListarCardsArquivadosBpm]", error);
    return { success: false as const, error: "Não foi possível consultar os cards arquivados" };
  }
}

export async function ObterCardArquivadoBpm(cardId: string) {
  try {
    const contexto = await contextoArquivo();
    if (!cardId || cardId.length > 100) return { success: false as const, error: "Card inválido" };
    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: {
        id: true, status: true, pipelineId: true, etapaId: true, createdAt: true, responsavelId: true,
        servico: true, tipoProcesso: true, proximoContatoEm: true, dataReuniao: true,
        transcricaoReuniao: true, statusPosFechamento: true,
        empresa: { select: { razaoSocial: true, nomeFantasia: true, cnpj: true } },
        pipeline: { select: { nome: true } }, etapa: { select: { nome: true } },
        responsavel: { select: { nome: true } },
        historico: { orderBy: { createdAt: "desc" }, take: 50,
          select: { acao: true, createdAt: true, valorAnteriorJson: true,
            usuario: { select: { nome: true } } } },
        anexos: { orderBy: { createdAt: "desc" },
          select: { id: true, nome: true, tipo: true, tamanho: true, createdAt: true, url: true } },
      },
    });
    if (!card || card.status !== "ARQUIVADO" || !contexto.pipelineIds.includes(card.pipelineId)) {
      return { success: false as const, error: "Card não encontrado" };
    }
    const acessoCard = await exigirAcessoBpmCard(card.id, contexto.userId, contexto.role, "visualizar");
    const acesso = acessoCard.isAdminGlobal || acessoCard.isAdminPipeline === true;
    const membro = acesso ? null : await db.bpmCardMembro.findUnique({
      where: { cardId_userId: { cardId, userId: contexto.userId } }, select: { role: true },
    });
    const perfil = acesso || membro?.role === "ADMINISTRADOR" ? "ADMIN"
      : card.responsavelId === contexto.userId || membro?.role === "RESPONSAVEL" ? "RESPONSAVEL" : "MEMBRO";
    const campos = await carregarCamposAplicaveisCardEtapa(card.id, card.pipelineId, card.etapaId, db, perfil);
    const evento = await db.bpmCardHistorico.findFirst({
      where: { cardId: card.id, acao: "CARD_ARQUIVADO" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, valorAnteriorJson: true },
    });
    return { success: true as const, data: {
      ...card,
      anexos: card.anexos.map((anexo) => ({
        id: anexo.id, nome: anexo.nome, tipo: anexo.tipo,
        tamanho: anexo.tamanho, createdAt: anexo.createdAt,
        url: `/api/bpm/anexos/${encodeURIComponent(anexo.id)}`,
      })),
      localizacao: localizacaoArquivada(evento, {
        pipelineNome: card.pipeline.nome, etapaNome: card.etapa.nome,
      }),
      arquivadoEm: evento?.createdAt ?? null,
      campos: campos.map((campo) => ({ nome: campo.nome, valor: campo.valor, tipo: campo.tipo })),
    } };
  } catch (error) {
    console.error("[ObterCardArquivadoBpm]", error);
    return { success: false as const, error: "Não foi possível consultar este card" };
  }
}
