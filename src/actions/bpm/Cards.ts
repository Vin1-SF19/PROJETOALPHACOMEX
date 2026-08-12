"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import {
  criarCardSchema,
  atualizarCardSchema,
  moverCardSchema,
  salvarRequisitosEMoverCardSchema,
} from "@/lib/validations/bpm";
import {
  exigirAcessoBpmCard,
  exigirAcessoBpmPipeline,
  exigirAcessoModuloBpm,
  isAdminRole,
  usuarioElegivelResponsavelBpm,
} from "@/lib/bpm/ownership";
import { executarAutomacaoFechamentoComercial } from "@/lib/bpm/automacoes";
import { buscarServicosContratados } from "@/actions/Clientes";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import {
  carregarCamposAplicaveisCardEtapa,
  carregarCamposAplicaveisEtapa,
  carregarCamposObrigatoriosEtapa,
} from "@/lib/bpm/requisitos-etapa-server";
import { listarCamposObrigatoriosFaltantes } from "@/lib/bpm/requisitos-etapa";
import {
  calcularDiaCicloNovosLeads,
  contarDiasUteisDecorridos,
  etapaEhNovosLeads,
  intervaloDiaCivilSaoPaulo,
  META_LIGACOES_NOVOS_LEADS,
} from "@/lib/bpm/novos-leads";
import { obterErroDataReuniaoParaMovimento } from "@/lib/bpm/agendar-reuniao";
import { obterErroTranscricaoParaMovimento } from "@/lib/bpm/reuniao-agendada";
import {
  etapaEhEmTratativa,
  obterErroChecklistParaSaidaEmTratativa,
  obterErroProximoContatoParaEntrada,
} from "@/lib/bpm/em-tratativa";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

export async function registrarHistoricoCard(
  params: {
    cardId: string;
    acao: string;
    usuarioId?: number;
    automacaoOrigem?: string;
    valorAnteriorJson?: string;
    valorNovoJson?: string;
  },
  client: Pick<typeof db, "bpmCardHistorico"> = db,
) {
  await client.bpmCardHistorico.create({ data: params });
}

/** Busca leve de empresa por razão social/nome fantasia/CNPJ para o seletor do modal de novo card. */
export async function BuscarEmpresasBpm(termo: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    await exigirAcessoModuloBpm(Number(session.user.id));
    const termoSeguro = termo.trim().slice(0, 120);
    if (termoSeguro.length < 2) return { success: true, data: [] };

    const empresas = await db.clientes.findMany({
      where: {
        OR: [
          { razaoSocial: { contains: termoSeguro } },
          { nomeFantasia: { contains: termoSeguro } },
          { cnpj: { contains: termoSeguro } },
        ],
      },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
      take: 20,
      orderBy: { razaoSocial: "asc" },
    });

    return { success: true, data: empresas };
  } catch (error) {
    console.error("[BuscarEmpresasBpm]", error);
    return { success: false, error: "Erro ao buscar empresas", data: [] };
  }
}

/** Lista usuários ativos para o seletor de responsável do card. */
export async function ListarUsuariosResponsavelBpm() {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    await exigirAcessoModuloBpm(Number(session.user.id));

    const usuarios = await db.usuarios.findMany({
      where: { status: "ATIVO" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });

    return { success: true, data: usuarios };
  } catch (error) {
    console.error("[ListarUsuariosResponsavelBpm]", error);
    return { success: false, error: "Erro ao buscar usuários", data: [] };
  }
}

export async function ListarCardsPipelineBpm(pipelineId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    await exigirAcessoBpmPipeline(pipelineId, Number(session.user.id));

    // D-021: card sempre tem empresa vinculada — select sempre inclui a empresa.
    const cards = await db.bpmCard.findMany({
      where: { pipelineId, status: "ATIVO" },
      select: {
        id: true,
        etapaId: true,
        servico: true,
        status: true,
        createdAt: true,
        primeiraVisualizacaoEm: true,
        statusPosFechamento: true,
        empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        responsavel: { select: { id: true, nome: true } },
        _count: { select: { tarefas: true, anexos: true } },
        // Só o campo "Canal de origem" — evita carregar todos os BpmCampo do card no board.
        campoValores: {
          where: { campo: { nome: "Canal de origem" } },
          select: { valor: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const agora = new Date();
    const { inicio, fim } = intervaloDiaCivilSaoPaulo(agora);
    const etapaNovosLeads = await db.bpmEtapa.findFirst({
      where: { pipelineId, nome: "Novos leads", ativo: true },
      select: { id: true },
    });
    const cardsNovosLeads = etapaNovosLeads
      ? cards.filter((card) => card.etapaId === etapaNovosLeads.id)
      : [];
    const interacoesHoje = cardsNovosLeads.length > 0
      ? await db.bpmInteracaoCard.findMany({
          where: {
            cardId: { in: cardsNovosLeads.map((card) => card.id) },
            tipo: "LIGACAO",
            createdAt: { gte: inicio, lt: fim },
          },
          select: { cardId: true },
        })
      : [];
    const ligacoesPorCard = new Map<string, number>();
    for (const interacao of interacoesHoje) {
      ligacoesPorCard.set(
        interacao.cardId,
        (ligacoesPorCard.get(interacao.cardId) ?? 0) + 1,
      );
    }

    return {
      success: true,
      data: cards.map((card) => {
        const ehNovoLead = card.etapaId === etapaNovosLeads?.id;
        return {
          ...card,
          ligacoesHoje: ehNovoLead ? (ligacoesPorCard.get(card.id) ?? 0) : 0,
          metaLigacoesDia: META_LIGACOES_NOVOS_LEADS,
          diasUteisDecorridos: ehNovoLead
            ? contarDiasUteisDecorridos(card.createdAt, agora)
            : 0,
          diaCiclo: ehNovoLead
            ? calcularDiaCicloNovosLeads(card.createdAt, agora)
            : 1,
        };
      }),
    };
  } catch (error) {
    console.error("[ListarCardsPipelineBpm]", error);
    return { success: false, error: "Erro ao buscar cards", data: [] };
  }
}

export async function ObterCardBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "visualizar");

    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      include: {
        empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true } },
        pipeline: { select: { id: true, nome: true } },
        etapa: {
          include: {
            // Transições permitidas a partir da etapa ATUAL — usado pela UI para mostrar só
            // os destinos alcançáveis (PainelProximaEtapa). Vazio = qualquer destino permitido
            // (mesmo fallback de MoverCardBpm).
            transicoesOrigem: { select: { etapaDestinoId: true } },
          },
        },
        responsavel: { select: { id: true, nome: true } },
        campoValores: { include: { campo: true } },
        membros: { include: { usuario: { select: { id: true, nome: true } } } },
        tarefas: { orderBy: { createdAt: "desc" } },
        anexos: { orderBy: { createdAt: "desc" } },
        historico: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { usuario: { select: { id: true, nome: true } } },
        },
        vinculosOrigem: { include: { cardDestino: { select: { id: true, pipelineId: true } } } },
        vinculosDestino: { include: { cardOrigem: { select: { id: true, pipelineId: true } } } },
      },
    });

    if (!card) return { success: false, error: "Card não encontrado" };

    const camposEtapa = await carregarCamposAplicaveisCardEtapa(
      card.id,
      card.pipelineId,
      card.etapaId,
    );

    // Indicador "nunca acessado" — primeiro acesso por QUALQUER usuário apaga a marcação.
    if (!card.primeiraVisualizacaoEm) {
      const agora = new Date();
      const atualizacao = await db.bpmCard.updateMany({
        where: { id: cardId, primeiraVisualizacaoEm: null },
        data: { primeiraVisualizacaoEm: agora },
      });
      card.primeiraVisualizacaoEm = agora;
      if (atualizacao.count > 0) {
        await notificarPipelineBpm({
          pipelineId: card.pipelineId,
          cardId,
          tipo: "PRIMEIRA_VISUALIZACAO",
        });
      }
    }

    return { success: true, data: { ...card, camposEtapa } };
  } catch (error) {
    console.error("[ObterCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao buscar card";
    return { success: false, error: msg };
  }
}

/** Lista nome e telefone das pessoas vinculadas à empresa do card. */
export async function ListarTelefonesCardBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Não autorizado", data: [] };
    }
    const userId = Number(session.user.id);

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "visualizar");

    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: { empresaId: true },
    });
    if (!card) return { success: false, error: "Card não encontrado", data: [] };

    const pessoas = await db.socios.findMany({
      where: {
        telefone: { not: null },
        OR: [
          { clienteId: card.empresaId },
          { empresaVinculos: { some: { empresaId: card.empresaId } } },
        ],
      },
      select: { id: true, nome: true, telefone: true },
      orderBy: [{ nome: "asc" }, { id: "asc" }],
    });

    const data = pessoas.flatMap((pessoa) => {
      const telefone = pessoa.telefone?.trim();
      return telefone ? [{ id: pessoa.id, nome: pessoa.nome, telefone }] : [];
    });

    return { success: true, data };
  } catch (error) {
    console.error("[ListarTelefonesCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado"
      : "Erro ao buscar telefones";
    return { success: false, error: msg, data: [] };
  }
}

export async function CriarCardBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = criarCardSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { empresaId, pipelineId, etapaId, responsavelId, servico, camposValores } = parsed.data;
    await exigirAcessoBpmPipeline(pipelineId, userId);
    if (!(await usuarioElegivelResponsavelBpm(pipelineId, responsavelId))) {
      return { success: false, error: "Responsável inválido para este pipeline." };
    }

    // D-021: empresa é sempre obrigatória — já garantido pelo schema Zod (empresaId obrigatório),
    // aqui confirmamos que a empresa de fato existe.
    const empresaExiste = await db.clientes.findUnique({ where: { id: empresaId }, select: { id: true } });
    if (!empresaExiste) return { success: false, error: "Empresa não encontrada" };

    const etapa = await db.bpmEtapa.findUnique({ where: { id: etapaId }, select: { pipelineId: true } });
    if (!etapa || etapa.pipelineId !== pipelineId) {
      return { success: false, error: "Etapa não pertence ao pipeline informado" };
    }

    // D-024: bloqueio de avanço/criação quando campos obrigatórios da etapa não estão preenchidos.
    const camposObrigatorios = await carregarCamposObrigatoriosEtapa(pipelineId, etapaId);
    const faltantes = listarCamposObrigatoriosFaltantes(
      camposObrigatorios,
      camposValores ?? {},
    );
    if (faltantes.length > 0) {
      return {
        success: false,
        error: `Campos obrigatórios não preenchidos: ${faltantes.map((f) => f.nome).join(", ")}`,
      };
    }

    if (camposValores && Object.keys(camposValores).length > 0) {
      const camposAplicaveis = await carregarCamposAplicaveisEtapa(pipelineId, etapaId);
      const idsAplicaveis = new Set(camposAplicaveis.map((campo) => campo.id));
      if (Object.keys(camposValores).some((campoId) => !idsAplicaveis.has(campoId))) {
        return {
          success: false,
          error: "Um ou mais campos não pertencem à etapa de criação selecionada.",
        };
      }
      const validacao = validarValoresCamposBpm(camposAplicaveis, camposValores);
      if (!validacao.success) return validacao;
    }

    const card = await db.$transaction(async (tx) => {
      await exigirAcessoBpmPipeline(pipelineId, userId, tx);
      const [etapaAtual, empresaAtual, responsavelElegivel] = await Promise.all([
        tx.bpmEtapa.findUnique({
          where: { id: etapaId },
          select: { pipelineId: true, ativo: true },
        }),
        tx.clientes.findUnique({ where: { id: empresaId }, select: { id: true } }),
        usuarioElegivelResponsavelBpm(pipelineId, responsavelId, tx),
      ]);
      if (!etapaAtual?.ativo || etapaAtual.pipelineId !== pipelineId) {
        throw new Error("CRIACAO_CARD_INVALIDA");
      }
      if (!empresaAtual || !responsavelElegivel) {
        throw new Error("CRIACAO_CARD_INVALIDA");
      }
      const camposAtuais = await carregarCamposAplicaveisEtapa(
        pipelineId,
        etapaId,
        tx,
      );
      const validacaoAtual = validarValoresCamposBpm(camposAtuais, camposValores ?? {});
      if (!validacaoAtual.success) {
        throw new Error(`CAMPO_INVALIDO:${validacaoAtual.error}`);
      }
      const obrigatoriosAtuais = camposAtuais.filter((campo) => campo.obrigatorio);
      const faltantesAtuais = listarCamposObrigatoriosFaltantes(
        obrigatoriosAtuais,
        validacaoAtual.valores,
      );
      if (faltantesAtuais.length > 0) throw new Error("CRIACAO_CARD_INVALIDA");

      const novoCard = await tx.bpmCard.create({
        data: { empresaId, pipelineId, etapaId, responsavelId, servico },
      });

      // D-041: responsável principal também é registrado como membro RESPONSAVEL.
      await tx.bpmCardMembro.create({
        data: { cardId: novoCard.id, userId: responsavelId, role: "RESPONSAVEL" },
      });

      if (camposValores) {
        const entradas = Object.entries(validacaoAtual.valores).filter(([, v]) => v !== "");
        if (entradas.length) {
          await tx.bpmCardCampoValor.createMany({
            data: entradas.map(([campoId, valor]) => ({ cardId: novoCard.id, campoId, valor })),
          });
        }
      }

      await tx.bpmCardHistorico.create({
        data: {
          cardId: novoCard.id,
          acao: "CARD_CRIADO",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ empresaId, pipelineId, etapaId, responsavelId }),
        },
      });

      return novoCard;
    });

    revalidatePath(`${ROTA_BASE}/pipeline/${pipelineId}`);
    await notificarPipelineBpm({ pipelineId, cardId: card.id, tipo: "CARD_CRIADO" });
    return { success: true, data: card };
  } catch (error) {
    console.error("[CriarCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado"
      : error instanceof Error && error.message === "CRIACAO_CARD_INVALIDA"
        ? "Os dados de criação mudaram ou não são mais válidos. Recarregue e tente novamente."
        : error instanceof Error && error.message.startsWith("CAMPO_INVALIDO:")
          ? error.message.slice("CAMPO_INVALIDO:".length)
          : "Erro ao criar card";
    return { success: false, error: msg };
  }
}

export async function AtualizarCardBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = atualizarCardSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { cardId, camposValores, ...campos } = parsed.data;

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");

    const cardAnterior = await db.bpmCard.findUnique({ where: { id: cardId } });
    if (!cardAnterior) return { success: false, error: "Card não encontrado" };
    if (
      campos.responsavelId !== undefined
      && !(await usuarioElegivelResponsavelBpm(
        cardAnterior.pipelineId,
        campos.responsavelId,
      ))
    ) {
      return { success: false, error: "Responsável inválido para este pipeline." };
    }

    const snapshotAnterior = {
      ...(campos.responsavelId !== undefined
        ? { responsavelId: cardAnterior.responsavelId }
        : {}),
      ...(campos.servico !== undefined ? { servico: cardAnterior.servico } : {}),
      ...(campos.status !== undefined ? { status: cardAnterior.status } : {}),
      ...(campos.proximoContatoEm !== undefined
        ? { proximoContatoEm: cardAnterior.proximoContatoEm }
        : {}),
      ...(camposValores ? { camposAlterados: Object.keys(camposValores) } : {}),
    };

    await db.$transaction(async (tx) => {
      const cardAtual = await tx.bpmCard.findUnique({ where: { id: cardId } });
      if (
        !cardAtual
        || cardAtual.etapaId !== cardAnterior.etapaId
        || cardAtual.status !== cardAnterior.status
        || cardAtual.updatedAt.getTime() !== cardAnterior.updatedAt.getTime()
      ) {
        throw new Error("CONFLITO_ATUALIZACAO_CARD");
      }
      if (
        campos.responsavelId !== undefined
        && !(await usuarioElegivelResponsavelBpm(
          cardAtual.pipelineId,
          campos.responsavelId,
          tx,
        ))
      ) {
        throw new Error("RESPONSAVEL_INVALIDO");
      }

      let valoresValidados: Record<string, string> = {};
      if (camposValores && Object.keys(camposValores).length > 0) {
        const camposAplicaveis = await carregarCamposAplicaveisCardEtapa(
          cardId,
          cardAtual.pipelineId,
          cardAtual.etapaId,
          tx,
        );
        const validacao = validarValoresCamposBpm(camposAplicaveis, camposValores);
        if (!validacao.success) throw new Error(`CAMPO_INVALIDO:${validacao.error}`);
        valoresValidados = validacao.valores;
      }

      const atualizacao = await tx.bpmCard.updateMany({
        where: {
          id: cardId,
          etapaId: cardAnterior.etapaId,
          status: cardAnterior.status,
          updatedAt: cardAnterior.updatedAt,
        },
        data: campos,
      });
      if (atualizacao.count !== 1) throw new Error("CONFLITO_ATUALIZACAO_CARD");

      if (camposValores) {
        for (const [campoId, valor] of Object.entries(valoresValidados)) {
          await tx.bpmCardCampoValor.upsert({
            where: { cardId_campoId: { cardId, campoId } },
            create: { cardId, campoId, valor },
            update: { valor },
          });
        }
      }

      await tx.bpmCardHistorico.create({
        data: {
          cardId,
          acao: "CARD_ATUALIZADO",
          usuarioId: userId,
          valorAnteriorJson: JSON.stringify(snapshotAnterior),
          valorNovoJson: JSON.stringify({
            ...campos,
            ...(camposValores ? { camposAlterados: Object.keys(camposValores) } : {}),
          }),
        },
      });

      // Responsável principal sempre reflete o membro com role RESPONSAVEL.
      if (campos.responsavelId && campos.responsavelId !== cardAnterior.responsavelId) {
        await tx.bpmCardMembro.updateMany({
          where: { cardId, role: "RESPONSAVEL" },
          data: { role: "PARTICIPANTE" },
        });
        await tx.bpmCardMembro.upsert({
          where: { cardId_userId: { cardId, userId: campos.responsavelId } },
          create: { cardId, userId: campos.responsavelId, role: "RESPONSAVEL" },
          update: { role: "RESPONSAVEL" },
        });
      }
    });

    revalidatePath(`${ROTA_BASE}/pipeline/${cardAnterior.pipelineId}`);
    await notificarPipelineBpm({
      pipelineId: cardAnterior.pipelineId,
      cardId,
      tipo: "CARD_ATUALIZADO",
    });
    return { success: true };
  } catch (error) {
    console.error("[AtualizarCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado"
      : error instanceof Error && error.message === "CONFLITO_ATUALIZACAO_CARD"
        ? "O card mudou enquanto era editado. Recarregue e tente novamente."
        : error instanceof Error && error.message.startsWith("CAMPO_INVALIDO:")
          ? error.message.slice("CAMPO_INVALIDO:".length)
          : error instanceof Error && error.message === "RESPONSAVEL_INVALIDO"
            ? "Responsável inválido para este pipeline."
          : "Erro ao atualizar card";
    return { success: false, error: msg };
  }
}

type DadosMovimentoComRequisitos = {
  cardId: string;
  etapaDestinoId: string;
  camposValores: Record<string, string>;
  proximoContatoEm?: Date | null;
};

type ClienteContextoMovimento = Pick<
  typeof db,
  "bpmCard" | "bpmEtapa" | "bpmEtapaTransicaoPermitida"
>;

async function carregarContextoMovimento(
  cardId: string,
  etapaDestinoId: string,
  client: ClienteContextoMovimento = db,
) {
  const [card, etapaDestino] = await Promise.all([
    client.bpmCard.findUnique({
      where: { id: cardId },
      include: { etapa: { select: { nome: true } } },
    }),
    client.bpmEtapa.findUnique({ where: { id: etapaDestinoId } }),
  ]);
  if (!card) return { error: "Card não encontrado" } as const;
  if (!etapaDestino || etapaDestino.pipelineId !== card.pipelineId) {
    return { error: "Etapa não pertence ao pipeline do card" } as const;
  }

  const transicoes = await client.bpmEtapaTransicaoPermitida.findMany({
    where: { etapaOrigemId: card.etapaId },
    select: { etapaDestinoId: true },
  });
  if (
    transicoes.length > 0
    && !transicoes.some((transicao) => transicao.etapaDestinoId === etapaDestinoId)
  ) {
    return {
      error: `Não é possível mover diretamente desta etapa para "${etapaDestino.nome}" — verifique as etapas permitidas.`,
    } as const;
  }
  return { card, etapaDestino } as const;
}

async function carregarCamposTransicao(params: {
  cardId: string;
  pipelineId: string;
  etapaOrigemId: string;
  etapaOrigemNome: string;
  etapaDestinoId: string;
  etapaDestinoNome: string;
}, client: Parameters<typeof carregarCamposAplicaveisCardEtapa>[3] = db) {
  const [camposOrigemTodos, camposDestino] = await Promise.all([
    etapaEhNovosLeads(params.etapaOrigemNome)
      ? carregarCamposAplicaveisCardEtapa(
          params.cardId,
          params.pipelineId,
          params.etapaOrigemId,
          client,
        )
      : Promise.resolve([]),
    carregarCamposAplicaveisCardEtapa(
      params.cardId,
      params.pipelineId,
      params.etapaDestinoId,
      client,
    ),
  ]);
  const camposOrigem = camposOrigemTodos.filter((campo) => campo.obrigatorio);
  const origemPorId = new Map(camposOrigem.map((campo) => [campo.id, campo]));
  const destinoPorId = new Map(camposDestino.map((campo) => [campo.id, campo]));
  const ids = new Set([...origemPorId.keys(), ...destinoPorId.keys()]);

  return [...ids].map((id) => {
    const origem = origemPorId.get(id);
    const destino = destinoPorId.get(id);
    const campo = destino ?? origem;
    if (!campo) throw new Error("Campo da transição não encontrado");
    const contexto = origem && destino
      ? "AMBOS"
      : origem
        ? "ORIGEM"
        : "DESTINO";
    return {
      ...campo,
      obrigatorio: Boolean(origem?.obrigatorio || destino?.obrigatorio),
      valor: destino?.valor ?? origem?.valor ?? null,
      contexto,
      etapaAplicacaoNome: contexto === "ORIGEM"
        ? params.etapaOrigemNome
        : contexto === "DESTINO"
          ? params.etapaDestinoNome
          : `${params.etapaOrigemNome} / ${params.etapaDestinoNome}`,
    };
  }).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
}

async function carregarGuardasNativasMovimento(params: {
  cardId: string;
  etapaOrigemNome: string;
  etapaDestinoNome: string;
  dataReuniao: Date | null;
  transcricaoReuniao: string | null;
  proximoContatoEm: Date | null;
}, client: Pick<typeof db, "bpmChecklistFollowUp"> = db) {
  const guardas = [
    obterErroDataReuniaoParaMovimento({
      etapaOrigemNome: params.etapaOrigemNome,
      etapaDestinoNome: params.etapaDestinoNome,
      dataReuniao: params.dataReuniao,
    }),
    obterErroTranscricaoParaMovimento({
      etapaOrigemNome: params.etapaOrigemNome,
      etapaDestinoNome: params.etapaDestinoNome,
      transcricaoReuniao: params.transcricaoReuniao,
    }),
    obterErroProximoContatoParaEntrada({
      etapaDestinoNome: params.etapaDestinoNome,
      proximoContatoEm: params.proximoContatoEm,
    }),
  ].filter((erro): erro is string => Boolean(erro));

  if (etapaEhEmTratativa(params.etapaOrigemNome)) {
    const ultimoChecklist = await client.bpmChecklistFollowUp.findFirst({
      where: { cardId: params.cardId },
      select: { completo: true },
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    });
    const erroChecklist = obterErroChecklistParaSaidaEmTratativa({
      etapaOrigemNome: params.etapaOrigemNome,
      ultimoChecklist,
    });
    if (erroChecklist) guardas.push(erroChecklist);
  }
  return guardas;
}

export async function ObterRequisitosTransicaoBpm(cardId: string, etapaDestinoId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "visualizar");

    const contexto = await carregarContextoMovimento(cardId, etapaDestinoId);
    if ("error" in contexto) return { success: false, error: contexto.error };
    const { card, etapaDestino } = contexto;
    const campos = await carregarCamposTransicao({
      cardId,
      pipelineId: card.pipelineId,
      etapaOrigemId: card.etapaId,
      etapaOrigemNome: card.etapa.nome,
      etapaDestinoId,
      etapaDestinoNome: etapaDestino.nome,
    });
    const faltantes = campos
      .filter((campo) => campo.obrigatorio && !campo.valor?.trim())
      .map((campo) => ({
        id: campo.id,
        nome: campo.nome,
        contexto: campo.contexto,
        etapaAplicacaoNome: campo.etapaAplicacaoNome,
      }));
    const guardas = await carregarGuardasNativasMovimento({
      cardId,
      etapaOrigemNome: card.etapa.nome,
      etapaDestinoNome: etapaDestino.nome,
      dataReuniao: card.dataReuniao,
      transcricaoReuniao: card.transcricaoReuniao,
      proximoContatoEm: card.proximoContatoEm,
    });

    return {
      success: true,
      data: {
        etapaDestino: { id: etapaDestino.id, nome: etapaDestino.nome },
        campos,
        faltantes,
        guardas,
        proximoContatoEm: card.proximoContatoEm,
        podeMover: faltantes.length === 0 && guardas.length === 0,
      },
    };
  } catch (error) {
    console.error("[ObterRequisitosTransicaoBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado"
      : "Erro ao buscar requisitos da transição";
    return { success: false, error: msg };
  }
}

async function executarMovimentoComRequisitos(
  dados: DadosMovimentoComRequisitos,
  userId: number,
  userRole: string | null,
) {
  const { cardId, etapaDestinoId, camposValores, proximoContatoEm } = dados;
  await exigirAcessoBpmCard(cardId, userId, userRole, "moverEtapa");
  const contexto = await carregarContextoMovimento(cardId, etapaDestinoId);
  if ("error" in contexto) return { success: false, error: contexto.error };
  const { card, etapaDestino } = contexto;
  if (card.etapaId === etapaDestinoId) return { success: true };

  const camposTransicao = await carregarCamposTransicao({
    cardId,
    pipelineId: card.pipelineId,
    etapaOrigemId: card.etapaId,
    etapaOrigemNome: card.etapa.nome,
    etapaDestinoId,
    etapaDestinoNome: etapaDestino.nome,
  });
  const idsTransicao = new Set(camposTransicao.map((campo) => campo.id));
  if (Object.keys(camposValores).some((campoId) => !idsTransicao.has(campoId))) {
    return {
      success: false,
      error: "Um ou mais campos não pertencem aos requisitos desta transição.",
    };
  }
  const validacaoCampos = validarValoresCamposBpm(camposTransicao, camposValores);
  if (!validacaoCampos.success) return validacaoCampos;
  const valoresValidados = validacaoCampos.valores;

  const valoresEfetivos = new Map(
    camposTransicao.map((campo) => [campo.id, valoresValidados[campo.id] ?? campo.valor]),
  );
  const faltantes = camposTransicao.filter(
    (campo) => campo.obrigatorio && !valoresEfetivos.get(campo.id)?.trim(),
  );
  if (faltantes.length > 0) {
    const faltantesOrigem = faltantes.filter(
      (campo) => campo.contexto === "ORIGEM" || campo.contexto === "AMBOS",
    );
    return {
      success: false,
      error: faltantesOrigem.length > 0
        ? `Não é possível sair de ${card.etapa.nome}: campos obrigatórios pendentes (${faltantes.map((campo) => campo.nome).join(", ")}).`
        : `Não é possível avançar: campos obrigatórios pendentes (${faltantes.map((campo) => campo.nome).join(", ")})`,
    };
  }

  const proximoContatoEfetivo = proximoContatoEm === undefined
    ? card.proximoContatoEm
    : proximoContatoEm;
  const guardas = await carregarGuardasNativasMovimento({
    cardId,
    etapaOrigemNome: card.etapa.nome,
    etapaDestinoNome: etapaDestino.nome,
    dataReuniao: card.dataReuniao,
    transcricaoReuniao: card.transcricaoReuniao,
    proximoContatoEm: proximoContatoEfetivo,
  });
  if (guardas.length > 0) return { success: false, error: guardas[0] };

  const resultadoMovimento = await db.$transaction(async (tx) => {
    await exigirAcessoBpmCard(cardId, userId, userRole, "moverEtapa", tx);
    const contextoAtual = await carregarContextoMovimento(cardId, etapaDestinoId, tx);
    if ("error" in contextoAtual) {
      throw new Error(`MOVIMENTO_INVALIDO:${contextoAtual.error}`);
    }
    const { card: cardAtual, etapaDestino: destinoAtual } = contextoAtual;
    if (cardAtual.etapaId !== card.etapaId || cardAtual.status !== card.status) {
      throw new Error("CONFLITO_MOVIMENTO_CARD");
    }

    const camposAtuais = await carregarCamposTransicao({
      cardId,
      pipelineId: cardAtual.pipelineId,
      etapaOrigemId: cardAtual.etapaId,
      etapaOrigemNome: cardAtual.etapa.nome,
      etapaDestinoId,
      etapaDestinoNome: destinoAtual.nome,
    }, tx);
    const idsAtuais = new Set(camposAtuais.map((campo) => campo.id));
    if (Object.keys(camposValores).some((campoId) => !idsAtuais.has(campoId))) {
      throw new Error("MOVIMENTO_INVALIDO:Um ou mais campos não pertencem aos requisitos desta transição.");
    }
    const validacaoAtual = validarValoresCamposBpm(camposAtuais, camposValores);
    if (!validacaoAtual.success) {
      throw new Error(`MOVIMENTO_INVALIDO:${validacaoAtual.error}`);
    }
    const valoresEfetivosAtuais = new Map(
      camposAtuais.map((campo) => [
        campo.id,
        validacaoAtual.valores[campo.id] ?? campo.valor,
      ]),
    );
    const faltantesAtuais = camposAtuais.filter(
      (campo) => campo.obrigatorio && !valoresEfetivosAtuais.get(campo.id)?.trim(),
    );
    if (faltantesAtuais.length > 0) {
      throw new Error(
        `MOVIMENTO_INVALIDO:Campos obrigatórios pendentes (${faltantesAtuais.map((campo) => campo.nome).join(", ")}).`,
      );
    }
    const proximoContatoAtual = proximoContatoEm === undefined
      ? cardAtual.proximoContatoEm
      : proximoContatoEm;
    const guardasAtuais = await carregarGuardasNativasMovimento({
      cardId,
      etapaOrigemNome: cardAtual.etapa.nome,
      etapaDestinoNome: destinoAtual.nome,
      dataReuniao: cardAtual.dataReuniao,
      transcricaoReuniao: cardAtual.transcricaoReuniao,
      proximoContatoEm: proximoContatoAtual,
    }, tx);
    if (guardasAtuais.length > 0) {
      throw new Error(`MOVIMENTO_INVALIDO:${guardasAtuais[0]}`);
    }

    for (const [campoId, valor] of Object.entries(validacaoAtual.valores)) {
      await tx.bpmCardCampoValor.upsert({
        where: { cardId_campoId: { cardId, campoId } },
        create: { cardId, campoId, valor },
        update: { valor },
      });
    }
    const movimento = await tx.bpmCard.updateMany({
      where: { id: cardId, etapaId: cardAtual.etapaId, status: cardAtual.status },
      data: {
        etapaId: etapaDestinoId,
        ...(proximoContatoEm !== undefined ? { proximoContatoEm } : {}),
      },
    });
    if (movimento.count !== 1) {
      throw new Error("CONFLITO_MOVIMENTO_CARD");
    }
    await tx.bpmCardHistorico.create({
      data: {
        cardId,
        acao: "CARD_MOVIDO",
        usuarioId: userId,
        valorAnteriorJson: JSON.stringify({ etapaId: cardAtual.etapaId }),
        valorNovoJson: JSON.stringify({
          etapaId: etapaDestinoId,
          camposPreenchidos: Object.keys(validacaoAtual.valores),
          ...(proximoContatoEm !== undefined ? { proximoContatoEm } : {}),
        }),
      },
    });
    return { pipelineId: cardAtual.pipelineId };
  });

  await executarAutomacaoFechamentoComercial(cardId, userId);
  await notificarPipelineBpm({ pipelineId: resultadoMovimento.pipelineId, cardId, tipo: "CARD_MOVIDO" });
  revalidatePath(`${ROTA_BASE}/pipeline/${resultadoMovimento.pipelineId}`);
  revalidatePath(ROTA_BASE);
  revalidatePath(`${ROTA_BASE}/tarefas`);
  return { success: true };
}

export async function SalvarRequisitosEMoverCardBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const parsed = salvarRequisitosEMoverCardSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    return await executarMovimentoComRequisitos(
      parsed.data,
      Number(session.user.id),
      session.user.role ?? null,
    );
  } catch (error) {
    console.error("[SalvarRequisitosEMoverCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado"
      : error instanceof Error && error.message === "CONFLITO_MOVIMENTO_CARD"
        ? "O card mudou enquanto você preenchia os requisitos. Recarregue e tente novamente."
        : error instanceof Error && error.message.startsWith("MOVIMENTO_INVALIDO:")
          ? error.message.slice("MOVIMENTO_INVALIDO:".length)
        : "Erro ao salvar requisitos e mover card";
    return { success: false, error: msg };
  }
}

export async function MoverCardBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const parsed = moverCardSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    return await executarMovimentoComRequisitos(
      { ...parsed.data, camposValores: {} },
      Number(session.user.id),
      session.user.role ?? null,
    );
  } catch (error) {
    console.error("[MoverCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado"
      : error instanceof Error && error.message === "CONFLITO_MOVIMENTO_CARD"
        ? "O card mudou enquanto era movido. Recarregue e tente novamente."
        : error instanceof Error && error.message.startsWith("MOVIMENTO_INVALIDO:")
          ? error.message.slice("MOVIMENTO_INVALIDO:".length)
        : "Erro ao mover card";
    return { success: false, error: msg };
  }
}

function servicoBate(valor: string | null | undefined, servico: string): boolean {
  if (!valor) return false;
  return valor.toLowerCase().includes(servico.toLowerCase());
}

/**
 * Histórico da empresa (mesmo CNPJ) num serviço específico (ex: "TTD-409"),
 * cruzando 3 fontes já existentes: cadastros CS&NPS (`clientes`, um registro
 * por serviço contratado), contratos do Painel de Metas (`buscarServicosContratados`)
 * e outros cards do próprio Alpha BPM/CRM para a mesma empresa. Usado pelas tabs
 * de serviço do CardFullViewModal — nenhuma tabela nova, nenhuma migration.
 */
export async function ObterHistoricoServicoEmpresa(cardId: string, servico: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "visualizar");

    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: { empresaId: true, empresa: { select: { cnpj: true } } },
    });
    if (!card) return { success: false, error: "Card não encontrado" };

    const [registrosClientesTodos, contratosTodos, outrosCardsTodos] = await Promise.all([
      db.clientes.findMany({
        where: { cnpj: card.empresa.cnpj },
        select: {
          id: true, servicos: true, status: true, analistaResponsavel: true,
          dataContratacao: true, dataExito: true,
        },
        orderBy: { id: "desc" },
      }),
      buscarServicosContratados(card.empresa.cnpj),
      db.bpmCard.findMany({
        where: { empresaId: card.empresaId, id: { not: cardId } },
        select: {
          id: true, servico: true, status: true, createdAt: true,
          pipeline: { select: { nome: true } },
          etapa: { select: { nome: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const data = {
      registrosClientes: registrosClientesTodos.filter((c) => servicoBate(c.servicos, servico)),
      contratos: contratosTodos.filter((c) => servicoBate(c.servico, servico)),
      outrosCards: outrosCardsTodos.filter((c) => servicoBate(c.servico, servico)),
    };

    return { success: true, data };
  } catch (error) {
    console.error("[ObterHistoricoServicoEmpresa]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao buscar histórico do serviço";
    return { success: false, error: msg };
  }
}

export { isAdminRole };
