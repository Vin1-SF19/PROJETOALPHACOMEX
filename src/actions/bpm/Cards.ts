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
  checarAcessoConfigPipeline,
  checarAcessoDiretoriaBpm,
  isAdminRole,
  usuarioElegivelResponsavelBpm,
} from "@/lib/bpm/ownership";
import { executarAutomacaoFechamentoComercial } from "@/lib/bpm/automacoes";
import { buscarServicosContratados } from "@/actions/Clientes";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import {
  carregarCamposAplicaveisCardEtapa,
} from "@/lib/bpm/requisitos-etapa-server";
import {
  calcularDiaCicloNovosLeads,
  contarDiasUteisDecorridos,
  CRIAR_CARD_CONTEXTO_ALTERADO_MENSAGEM,
  CRIAR_CARD_DESTINO_INVALIDO_MENSAGEM,
  etapaEhNovosLeads,
  intervaloDiaCivilSaoPaulo,
  META_LIGACOES_NOVOS_LEADS,
} from "@/lib/bpm/novos-leads";
import {
  ACESSO_BOAS_VINDAS_NEGADO_MENSAGEM,
  etapaEhBoasVindas,
  NOME_ETAPA_BOAS_VINDAS,
} from "@/lib/bpm/boas-vindas";
import { obterErroDataReuniaoParaMovimento } from "@/lib/bpm/agendar-reuniao";
import { obterErroTranscricaoParaMovimento } from "@/lib/bpm/reuniao-agendada";
import {
  etapaEhEmTratativa,
  obterErroChecklistParaSaidaEmTratativa,
  obterErroProximoContatoParaEntrada,
} from "@/lib/bpm/em-tratativa";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";
import {
  configuracaoEntradaFechadoEhValida,
  CONFIGURACAO_FECHADO_INVALIDA_MENSAGEM,
  etapaEhFechado,
  STATUS_POS_FECHAMENTO_INICIAL,
} from "@/lib/bpm/status-pos-fechamento";
import {
  CONFIGURACAO_LOST_INVALIDA_MENSAGEM,
  campoEhMotivoLost,
  campoEhMotivoLostOutro,
  etapaEhLost,
  resolverConfiguracaoLost,
  validarMotivoLost,
  type CampoConfiguracaoLost,
  type ConfiguracaoLost,
} from "@/lib/bpm/lost";
import { obterErroTransicaoMonitoramento } from "@/lib/bpm/monitoramento";
import {
  etapaEhAlinhamentoEstrategico,
  obterErroCamposAlinhamentoParaSaida,
} from "@/lib/bpm/alinhamento-estrategico";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

type ClienteContextoCriacao = Pick<typeof db, "bpmPipeline" | "bpmEtapa">;

async function destinoEhEtapaCanonicaNovosLeads(
  pipelineId: string,
  etapaId: string,
  client: ClienteContextoCriacao = db,
): Promise<boolean> {
  const [pipeline, etapasAtivas] = await Promise.all([
    client.bpmPipeline.findUnique({
      where: { id: pipelineId },
      select: { ativo: true },
    }),
    client.bpmEtapa.findMany({
      where: { pipelineId, ativo: true },
      select: { id: true, nome: true, ordem: true },
    }),
  ]);
  const candidatas = etapasAtivas.filter((etapa) =>
    etapaEhNovosLeads(etapa.nome),
  );
  const primeiraEtapa = [...etapasAtivas].sort((a, b) => a.ordem - b.ordem)[0];
  return pipeline?.ativo === true
    && candidatas.length === 1
    && primeiraEtapa?.id === etapaId
    && candidatas[0].id === etapaId;
}

type ClienteConfiguracaoLost = Pick<
  typeof db,
  "bpmCampo" | "bpmCampoObrigatorioEtapa" | "bpmCardCampoValor"
>;

type CampoLostCarregado = CampoConfiguracaoLost & { valor: string | null };

async function carregarConfiguracaoLost(params: {
  pipelineId: string;
  etapaLostId: string;
  cardId?: string;
}, client: ClienteConfiguracaoLost = db): Promise<{
  configuracao: ConfiguracaoLost;
  campos: CampoLostCarregado[];
}> {
  const [camposPipeline, associados] = await Promise.all([
    client.bpmCampo.findMany({
      where: { pipelineId: params.pipelineId },
      select: {
        id: true,
        pipelineId: true,
        etapaId: true,
        nome: true,
        tipo: true,
        opcoesJson: true,
        obrigatorio: true,
        ordem: true,
      },
    }),
    client.bpmCampoObrigatorioEtapa.findMany({
      where: {
        etapaId: params.etapaLostId,
        campo: { pipelineId: params.pipelineId },
      },
      select: { campoId: true },
    }),
  ]);
  const resultado = resolverConfiguracaoLost({
    camposPipeline,
    etapaLostId: params.etapaLostId,
    campoIdsObrigatoriosEtapa: associados.map((item) => item.campoId),
  });
  if (!resultado.success) throw new Error("CONFIGURACAO_LOST_INVALIDA");

  const ids = [
    resultado.configuracao.motivo.id,
    resultado.configuracao.complemento.id,
  ];
  const valores = params.cardId
    ? await client.bpmCardCampoValor.findMany({
        where: { cardId: params.cardId, campoId: { in: ids } },
        select: { campoId: true, valor: true },
      })
    : [];
  const valorPorCampo = new Map(
    valores.map((item) => [item.campoId, item.valor]),
  );
  const motivo = {
    ...resultado.configuracao.motivo,
    obrigatorio: true,
    valor: valorPorCampo.get(resultado.configuracao.motivo.id) ?? null,
  };
  const complemento = {
    ...resultado.configuracao.complemento,
    obrigatorio: false,
    valor: valorPorCampo.get(resultado.configuracao.complemento.id) ?? null,
  };
  return {
    configuracao: { motivo, complemento },
    campos: [motivo, complemento],
  };
}

function mesclarCamposPorId<T extends { id: string }>(
  campos: readonly T[],
  adicionais: readonly T[],
): T[] {
  const porId = new Map(campos.map((campo) => [campo.id, campo]));
  for (const campo of adicionais) porId.set(campo.id, campo);
  return [...porId.values()];
}

function validarMotivoLostNosCampos(
  campos: readonly CampoLostCarregado[],
  valores: Readonly<Record<string, string | null | undefined>>,
) {
  const motivos = campos.filter((campo) => campoEhMotivoLost(campo.nome));
  const complementos = campos.filter((campo) =>
    campoEhMotivoLostOutro(campo.nome),
  );
  if (motivos.length !== 1 || complementos.length !== 1) {
    return { success: false as const, error: CONFIGURACAO_LOST_INVALIDA_MENSAGEM };
  }
  return validarMotivoLost({
    configuracao: { motivo: motivos[0], complemento: complementos[0] },
    valores,
  });
}

/** Busca leve de empresa por razão social/nome fantasia/CNPJ para o seletor do modal de novo card. */
export async function BuscarEmpresasBpm(termo: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    await exigirAcessoModuloBpm(Number(session.user.id));
    const termoSeguro = termo.trim().slice(0, 120);
    if (termoSeguro.length < 2) return { success: true, data: [] };

    const empresas = await db.cliente.findMany({
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

/** Lista somente usuários ativos e elegíveis como responsáveis no pipeline. */
export async function ListarUsuariosResponsavelBpm(pipelineId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    if (!pipelineId?.trim()) {
      return { success: false, error: "Pipeline inválido", data: [] };
    }
    await exigirAcessoBpmPipeline(pipelineId, Number(session.user.id));
    const candidatos = await db.usuarios.findMany({
      where: { status: "ATIVO" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });
    const elegibilidades = await Promise.all(
      candidatos.map((usuario) =>
        usuarioElegivelResponsavelBpm(pipelineId, usuario.id),
      ),
    );
    const usuarios = candidatos.filter((_, indice) => elegibilidades[indice]);

    return { success: true, data: usuarios };
  } catch (error) {
    console.error("[ListarUsuariosResponsavelBpm]", error);
    return { success: false, error: "Erro ao buscar usuários", data: [] };
  }
}

export async function ListarCardsPipelineBpm(pipelineId: string) {
  try {
    const session = await auth();
    const userId = Number(session?.user?.id);
    const admin = Number.isFinite(userId)
      && await checarAcessoConfigPipeline(userId, "visualizarPipeline");
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    await exigirAcessoBpmPipeline(pipelineId, Number(session.user.id));
    const diretoria = await checarAcessoDiretoriaBpm(userId);

    // D-021: card sempre tem empresa vinculada — select sempre inclui a empresa.
    const cards = await db.bpmCard.findMany({
      where: {
        pipelineId,
        status: "ATIVO",
        ...(diretoria ? {} : { etapa: { nome: { not: NOME_ETAPA_BOAS_VINDAS } } }),
        ...(admin ? {} : { membros: { some: { userId } } }),
      },
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
        // Dados operacionais compactos para o card do board: próximo prazo e
        // anotação rápida pendente, sem carregar o histórico inteiro.
        tarefas: {
          where: { status: "PENDENTE" },
          select: { titulo: true, prazo: true, tipo: true },
          orderBy: [{ prazo: "asc" }, { createdAt: "asc" }],
          take: 10,
        },
        // Só o campo "Canal de origem" — evita carregar todos os BpmCampo do card no board.
        campoValores: {
          where: { campo: { nome: { in: ["Canal de origem", "Resumo da reunião"] } } },
          select: { valor: true, campo: { select: { nome: true } } },
          take: 2,
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

    const podeVerVinculado = async (id: string) => {
      try {
        await exigirAcessoBpmCard(id, userId, session.user.role ?? null, "visualizar");
        return true;
      } catch {
        return false;
      }
    };
    const visibilidadeVinculos = await Promise.all([
      ...card.vinculosOrigem.map((vinculo) => podeVerVinculado(vinculo.cardDestino.id)),
      ...card.vinculosDestino.map((vinculo) => podeVerVinculado(vinculo.cardOrigem.id)),
    ]);
    let indiceVinculo = 0;
    card.vinculosOrigem = card.vinculosOrigem.filter(() => visibilidadeVinculos[indiceVinculo++]);
    card.vinculosDestino = card.vinculosDestino.filter(() => visibilidadeVinculos[indiceVinculo++]);

    let camposEtapa = await carregarCamposAplicaveisCardEtapa(
      card.id,
      card.pipelineId,
      card.etapaId,
    );
    if (etapaEhLost(card.etapa.nome)) {
      const contextoLost = await carregarConfiguracaoLost({
        pipelineId: card.pipelineId,
        etapaLostId: card.etapaId,
        cardId: card.id,
      });
      camposEtapa = mesclarCamposPorId(camposEtapa, contextoLost.campos);
    }

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

    return {
      success: true,
      data: {
        ...card,
        anexos: card.anexos.map((anexo) => ({ ...anexo, url: `/api/bpm/anexos/${anexo.id}` })),
        camposEtapa,
      },
    };
  } catch (error) {
    console.error("[ObterCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado"
      : error instanceof Error && error.message === "CONFIGURACAO_LOST_INVALIDA"
        ? CONFIGURACAO_LOST_INVALIDA_MENSAGEM
        : "Erro ao buscar card";
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

    // Pessoa/PessoaClienteVinculo (Fase 3.2 do Cliente Master) — substitui `socios`.
    const vinculos = await db.pessoaClienteVinculo.findMany({
      where: { clienteId: card.empresaId },
      select: { pessoa: { select: { id: true, nome: true, celular: true } } },
      orderBy: { pessoa: { nome: "asc" } },
    });

    const data = vinculos.flatMap(({ pessoa }) => {
      const telefone = pessoa.celular?.trim();
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
    const { empresaId, novaEmpresa, pipelineId, etapaId, responsavelId, servico } = parsed.data;
    await exigirAcessoBpmPipeline(pipelineId, userId);
    if (!(await usuarioElegivelResponsavelBpm(pipelineId, responsavelId))) {
      return { success: false, error: "Responsável inválido para este pipeline." };
    }
    if (!(await destinoEhEtapaCanonicaNovosLeads(pipelineId, etapaId))) {
      return { success: false, error: CRIAR_CARD_DESTINO_INVALIDO_MENSAGEM };
    }

    // D-021: empresa é sempre obrigatória. `empresaId` vincula empresa já existente
    // (fluxo padrão de todas as etapas); `novaEmpresa` cria um `Cliente` novo na mesma
    // transação (Fase 3.2 do Cliente Master — único caminho do BPM que cria empresa,
    // usado só pelo botão "+" da etapa "Novos Leads").
    let cnpjNovaEmpresa: string | null = null;
    if (novaEmpresa) {
      cnpjNovaEmpresa = novaEmpresa.cnpj.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      const jaExiste = await db.cliente.findUnique({ where: { cnpj: cnpjNovaEmpresa }, select: { id: true } });
      if (jaExiste) {
        return { success: false, error: "Já existe uma empresa cadastrada com este CNPJ — busque e selecione-a." };
      }
    } else {
      const empresaExiste = await db.cliente.findUnique({ where: { id: empresaId }, select: { id: true } });
      if (!empresaExiste) return { success: false, error: "Empresa não encontrada" };
    }

    const card = await db.$transaction(async (tx) => {
      await exigirAcessoBpmPipeline(pipelineId, userId, tx);

      if (!(await destinoEhEtapaCanonicaNovosLeads(pipelineId, etapaId, tx))) {
        throw new Error("CRIACAO_CARD_CONTEXTO_ALTERADO");
      }
      if (!(await usuarioElegivelResponsavelBpm(pipelineId, responsavelId, tx))) {
        throw new Error("CRIACAO_CARD_INVALIDA");
      }

      let empresaIdResolvido = empresaId;
      if (novaEmpresa && cnpjNovaEmpresa) {
        // Reconfirma dentro da transação — outra requisição pode ter cadastrado
        // o mesmo CNPJ entre a checagem acima e agora.
        const jaExisteNaTx = await tx.cliente.findUnique({ where: { cnpj: cnpjNovaEmpresa }, select: { id: true } });
        if (jaExisteNaTx) throw new Error("CNPJ_JA_CADASTRADO");
        const criado = await tx.cliente.create({
          data: {
            cnpj: cnpjNovaEmpresa,
            razaoSocial: novaEmpresa.razaoSocial.trim(),
            nomeFantasia: novaEmpresa.nomeFantasia?.trim() || null,
            uf: novaEmpresa.uf?.trim().toUpperCase() || null,
            municipio: novaEmpresa.municipio?.trim() || null,
          },
        });
        empresaIdResolvido = criado.id;
      }
      if (!empresaIdResolvido) throw new Error("CRIACAO_CARD_INVALIDA");

      const empresaAtual = await tx.cliente.findUnique({
        where: { id: empresaIdResolvido },
        select: { id: true },
      });
      if (!empresaAtual) {
        throw new Error("CRIACAO_CARD_INVALIDA");
      }
      const novoCard = await tx.bpmCard.create({
        data: {
          empresaId: empresaIdResolvido,
          pipelineId,
          etapaId,
          responsavelId,
          servico,
        },
      });

      // D-041: responsável principal também é registrado como membro RESPONSAVEL.
      await tx.bpmCardMembro.create({
        data: { cardId: novoCard.id, userId: responsavelId, role: "RESPONSAVEL" },
      });

      await tx.bpmCardHistorico.create({
        data: {
          cardId: novoCard.id,
          acao: "CARD_CRIADO",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({
            empresaId: empresaIdResolvido,
            pipelineId,
            etapaId,
            responsavelId,
            empresaCriada: !!novaEmpresa,
          }),
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
      : error instanceof Error && error.message === "CNPJ_JA_CADASTRADO"
        ? "Já existe uma empresa cadastrada com este CNPJ — busque e selecione-a."
        : error instanceof Error && error.message === "CRIACAO_CARD_INVALIDA"
          ? "Os dados de criação mudaram ou não são mais válidos. Recarregue e tente novamente."
        : error instanceof Error && error.message === "CRIACAO_CARD_CONTEXTO_ALTERADO"
          ? CRIAR_CARD_CONTEXTO_ALTERADO_MENSAGEM
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
    if (!parsed.success) {
      const statusInvalido = parsed.error.issues.some(
        (issue) => issue.path[0] === "statusPosFechamento",
      );
      return {
        success: false,
        error: statusInvalido
          ? "Status pós-fechamento inválido."
          : parsed.error.flatten(),
      };
    }
    const { cardId, camposValores, versaoEsperadaEm, ...campos } = parsed.data;
    if (campos.statusPosFechamento !== undefined && !versaoEsperadaEm) {
      return {
        success: false,
        error: "A versão atual do card é obrigatória para alterar o status pós-fechamento.",
      };
    }

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");

    const cardAnterior = await db.bpmCard.findUnique({
      where: { id: cardId },
      include: { etapa: { select: { nome: true } } },
    });
    if (!cardAnterior) return { success: false, error: "Card não encontrado" };
    if (
      etapaEhLost(cardAnterior.etapa.nome)
      && camposValores !== undefined
      && !versaoEsperadaEm
    ) {
      return {
        success: false,
        error: "A versão atual do card é obrigatória para editar o Motivo de Lost.",
      };
    }
    if (
      versaoEsperadaEm
      && cardAnterior.updatedAt.getTime() !== versaoEsperadaEm.getTime()
    ) {
      return {
        success: false,
        error: "O card mudou enquanto era editado. Recarregue e tente novamente.",
      };
    }
    if (
      campos.responsavelId !== undefined
      && !(await usuarioElegivelResponsavelBpm(
        cardAnterior.pipelineId,
        campos.responsavelId,
      ))
    ) {
      return { success: false, error: "Responsável inválido para este pipeline." };
    }
    if (etapaEhLost(cardAnterior.etapa.nome)) {
      let camposAplicaveis = await carregarCamposAplicaveisCardEtapa(
        cardId,
        cardAnterior.pipelineId,
        cardAnterior.etapaId,
      );
      const contextoLost = await carregarConfiguracaoLost({
        pipelineId: cardAnterior.pipelineId,
        etapaLostId: cardAnterior.etapaId,
        cardId,
      });
      camposAplicaveis = mesclarCamposPorId(camposAplicaveis, contextoLost.campos);
      const validacaoCampos = validarValoresCamposBpm(
        camposAplicaveis,
        camposValores ?? {},
      );
      if (!validacaoCampos.success) return validacaoCampos;
      const validacaoLost = validarMotivoLost({
        configuracao: contextoLost.configuracao,
        valores: validacaoCampos.valores,
      });
      if (!validacaoLost.success) return validacaoLost;
    }

    const snapshotAnterior = {
      ...(campos.responsavelId !== undefined
        ? { responsavelId: cardAnterior.responsavelId }
        : {}),
      ...(campos.servico !== undefined ? { servico: cardAnterior.servico } : {}),
      ...(campos.status !== undefined ? { status: cardAnterior.status } : {}),
      ...(campos.statusPosFechamento !== undefined
        ? { statusPosFechamento: cardAnterior.statusPosFechamento }
        : {}),
      ...(campos.proximoContatoEm !== undefined
        ? { proximoContatoEm: cardAnterior.proximoContatoEm }
        : {}),
      ...(camposValores ? { camposAlterados: Object.keys(camposValores) } : {}),
    };

    await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(
        cardId,
        userId,
        session.user.role ?? null,
        "editarCard",
        tx,
      );
      const cardAtual = await tx.bpmCard.findUnique({
        where: { id: cardId },
        include: { etapa: { select: { nome: true } } },
      });
      if (
        !cardAtual
        || cardAtual.etapaId !== cardAnterior.etapaId
        || cardAtual.status !== cardAnterior.status
        || cardAtual.updatedAt.getTime() !== cardAnterior.updatedAt.getTime()
        || (
          versaoEsperadaEm
          && cardAtual.updatedAt.getTime() !== versaoEsperadaEm.getTime()
        )
      ) {
        throw new Error("CONFLITO_ATUALIZACAO_CARD");
      }
      if (
        campos.statusPosFechamento !== undefined
        && !etapaEhFechado(cardAtual.etapa.nome)
      ) {
        throw new Error("STATUS_POS_FECHAMENTO_FORA_DE_FECHADO");
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
      if (
        etapaEhLost(cardAtual.etapa.nome)
        || (camposValores && Object.keys(camposValores).length > 0)
      ) {
        let camposAplicaveis = await carregarCamposAplicaveisCardEtapa(
          cardId,
          cardAtual.pipelineId,
          cardAtual.etapaId,
          tx,
        );
        let configuracaoLostAtual: ConfiguracaoLost | null = null;
        if (etapaEhLost(cardAtual.etapa.nome)) {
          const contextoLostAtual = await carregarConfiguracaoLost({
            pipelineId: cardAtual.pipelineId,
            etapaLostId: cardAtual.etapaId,
            cardId,
          }, tx);
          configuracaoLostAtual = contextoLostAtual.configuracao;
          camposAplicaveis = mesclarCamposPorId(
            camposAplicaveis,
            contextoLostAtual.campos,
          );
        }
        const validacao = validarValoresCamposBpm(
          camposAplicaveis,
          camposValores ?? {},
        );
        if (!validacao.success) throw new Error(`CAMPO_INVALIDO:${validacao.error}`);
        valoresValidados = validacao.valores;
        if (configuracaoLostAtual) {
          const validacaoLostAtual = validarMotivoLost({
            configuracao: configuracaoLostAtual,
            valores: valoresValidados,
          });
          if (!validacaoLostAtual.success) {
            throw new Error(`MOTIVO_LOST_INVALIDO:${validacaoLostAtual.error}`);
          }
        }
      }

      const atualizacao = await tx.bpmCard.updateMany({
        where: {
          id: cardId,
          etapaId: cardAnterior.etapaId,
          status: cardAnterior.status,
          updatedAt: versaoEsperadaEm ?? cardAnterior.updatedAt,
        },
        // Avanca explicitamente a versao mesmo quando a edicao contem apenas
        // campos dinamicos. Um update vazio nao aciona @updatedAt no Prisma e
        // permitiria que duas abas passassem pelo mesmo CAS.
        data: { ...campos, updatedAt: new Date() },
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
        : error instanceof Error && error.message === "STATUS_POS_FECHAMENTO_FORA_DE_FECHADO"
          ? "O status pós-fechamento só pode ser alterado enquanto o card estiver em Fechado."
        : error instanceof Error && error.message === "CONFIGURACAO_LOST_INVALIDA"
          ? CONFIGURACAO_LOST_INVALIDA_MENSAGEM
        : error instanceof Error && error.message.startsWith("CAMPO_INVALIDO:")
          ? error.message.slice("CAMPO_INVALIDO:".length)
        : error instanceof Error && error.message.startsWith("MOTIVO_LOST_INVALIDO:")
          ? error.message.slice("MOTIVO_LOST_INVALIDO:".length)
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
  const [camposOrigemTodos, camposDestinoBase] = await Promise.all([
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
  let camposDestino = camposDestinoBase;
  if (etapaEhLost(params.etapaDestinoNome)) {
    const contextoLost = await carregarConfiguracaoLost({
      pipelineId: params.pipelineId,
      etapaLostId: params.etapaDestinoId,
      cardId: params.cardId,
    }, client);
    camposDestino = mesclarCamposPorId(camposDestino, contextoLost.campos);
  }
  const camposOrigem = camposOrigemTodos.filter((campo) => campo.obrigatorio);
  const origemPorId = new Map(camposOrigem.map((campo) => [campo.id, campo]));
  const destinoPorId = new Map(camposDestino.map((campo) => [campo.id, campo]));
  const ids = new Set([...origemPorId.keys(), ...destinoPorId.keys()]);

  return [...ids].map((id) => {
    const origem = origemPorId.get(id);
    const destino = destinoPorId.get(id);
    const campo = destino ?? origem;
    if (!campo) throw new Error("Campo da transição não encontrado");
    const contexto: "ORIGEM" | "DESTINO" | "AMBOS" = origem && destino
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

async function carregarCamposOrigemParaGuard(params: {
  cardId: string;
  pipelineId: string;
  etapaOrigemId: string;
  etapaOrigemNome: string;
}, client: Parameters<typeof carregarCamposAplicaveisCardEtapa>[3] = db) {
  if (!etapaEhAlinhamentoEstrategico(params.etapaOrigemNome)) return [];
  return carregarCamposAplicaveisCardEtapa(
    params.cardId,
    params.pipelineId,
    params.etapaOrigemId,
    client,
  );
}

async function carregarGuardasNativasMovimento(params: {
  cardId: string;
  etapaOrigemNome: string;
  etapaDestinoNome: string;
  dataReuniao: Date | null;
  transcricaoReuniao: string | null;
  proximoContatoEm: Date | null;
  camposEtapaOrigem?: readonly { nome: string; valor: string | null }[];
}, client: Pick<typeof db, "bpmChecklistFollowUp"> = db) {
  const guardas = [
    obterErroTransicaoMonitoramento({
      etapaOrigemNome: params.etapaOrigemNome,
      etapaDestinoNome: params.etapaDestinoNome,
    }),
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
    obterErroCamposAlinhamentoParaSaida({
      etapaOrigemNome: params.etapaOrigemNome,
      campos: params.camposEtapaOrigem ?? [],
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
    const camposEtapaOrigem = await carregarCamposOrigemParaGuard({
      cardId,
      pipelineId: card.pipelineId,
      etapaOrigemId: card.etapaId,
      etapaOrigemNome: card.etapa.nome,
    });
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
      camposEtapaOrigem,
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
      : error instanceof Error && error.message === "CONFIGURACAO_LOST_INVALIDA"
        ? CONFIGURACAO_LOST_INVALIDA_MENSAGEM
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
  if (etapaEhBoasVindas(etapaDestino.nome) && !(await checarAcessoDiretoriaBpm(userId))) {
    return { success: false, error: ACESSO_BOAS_VINDAS_NEGADO_MENSAGEM };
  }
  if (card.etapaId === etapaDestinoId) return { success: true };

  const camposTransicao = await carregarCamposTransicao({
    cardId,
    pipelineId: card.pipelineId,
    etapaOrigemId: card.etapaId,
    etapaOrigemNome: card.etapa.nome,
    etapaDestinoId,
    etapaDestinoNome: etapaDestino.nome,
  });
  if (
    etapaEhFechado(etapaDestino.nome)
    && !configuracaoEntradaFechadoEhValida(camposTransicao)
  ) {
    return { success: false, error: CONFIGURACAO_FECHADO_INVALIDA_MENSAGEM };
  }
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
  if (etapaEhLost(etapaDestino.nome)) {
    const validacaoLost = validarMotivoLostNosCampos(
      camposTransicao,
      valoresValidados,
    );
    if (!validacaoLost.success) return validacaoLost;
  }

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
  const camposEtapaOrigem = await carregarCamposOrigemParaGuard({
    cardId,
    pipelineId: card.pipelineId,
    etapaOrigemId: card.etapaId,
    etapaOrigemNome: card.etapa.nome,
  });
  const guardas = await carregarGuardasNativasMovimento({
    cardId,
    etapaOrigemNome: card.etapa.nome,
    etapaDestinoNome: etapaDestino.nome,
    dataReuniao: card.dataReuniao,
    transcricaoReuniao: card.transcricaoReuniao,
    proximoContatoEm: proximoContatoEfetivo,
    camposEtapaOrigem,
  });
  if (guardas.length > 0) return { success: false, error: guardas[0] };

  const resultadoMovimento = await db.$transaction(async (tx) => {
    await exigirAcessoBpmCard(cardId, userId, userRole, "moverEtapa", tx);
    const contextoAtual = await carregarContextoMovimento(cardId, etapaDestinoId, tx);
    if ("error" in contextoAtual) {
      throw new Error(`MOVIMENTO_INVALIDO:${contextoAtual.error}`);
    }
    const { card: cardAtual, etapaDestino: destinoAtual } = contextoAtual;
    if (etapaEhBoasVindas(destinoAtual.nome) && !(await checarAcessoDiretoriaBpm(userId, tx))) {
      throw new Error(`MOVIMENTO_INVALIDO:${ACESSO_BOAS_VINDAS_NEGADO_MENSAGEM}`);
    }
    if (
      cardAtual.etapaId !== card.etapaId
      || cardAtual.status !== card.status
      || cardAtual.updatedAt.getTime() !== card.updatedAt.getTime()
    ) {
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
    if (
      etapaEhFechado(destinoAtual.nome)
      && !configuracaoEntradaFechadoEhValida(camposAtuais)
    ) {
      throw new Error("CONFIGURACAO_FECHADO_INVALIDA");
    }
    const idsAtuais = new Set(camposAtuais.map((campo) => campo.id));
    if (Object.keys(camposValores).some((campoId) => !idsAtuais.has(campoId))) {
      throw new Error("MOVIMENTO_INVALIDO:Um ou mais campos não pertencem aos requisitos desta transição.");
    }
    const valoresParaValidar = etapaEhFechado(destinoAtual.nome)
      ? Object.fromEntries(
          camposAtuais.map((campo) => [
            campo.id,
            camposValores[campo.id] ?? campo.valor ?? "",
          ]),
        )
      : camposValores;
    const validacaoAtual = validarValoresCamposBpm(camposAtuais, valoresParaValidar);
    if (!validacaoAtual.success) {
      throw new Error(`MOVIMENTO_INVALIDO:${validacaoAtual.error}`);
    }
    if (etapaEhLost(destinoAtual.nome)) {
      const validacaoLostAtual = validarMotivoLostNosCampos(
        camposAtuais,
        validacaoAtual.valores,
      );
      if (!validacaoLostAtual.success) {
        const prefixo = validacaoLostAtual.error === CONFIGURACAO_LOST_INVALIDA_MENSAGEM
          ? "CONFIGURACAO_LOST_INVALIDA"
          : `MOVIMENTO_INVALIDO:${validacaoLostAtual.error}`;
        throw new Error(prefixo);
      }
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
    const camposEtapaOrigemAtuais = await carregarCamposOrigemParaGuard({
      cardId,
      pipelineId: cardAtual.pipelineId,
      etapaOrigemId: cardAtual.etapaId,
      etapaOrigemNome: cardAtual.etapa.nome,
    }, tx);
    const guardasAtuais = await carregarGuardasNativasMovimento({
      cardId,
      etapaOrigemNome: cardAtual.etapa.nome,
      etapaDestinoNome: destinoAtual.nome,
      dataReuniao: cardAtual.dataReuniao,
      transcricaoReuniao: cardAtual.transcricaoReuniao,
      proximoContatoEm: proximoContatoAtual,
      camposEtapaOrigem: camposEtapaOrigemAtuais,
    }, tx);
    if (guardasAtuais.length > 0) {
      throw new Error(`MOVIMENTO_INVALIDO:${guardasAtuais[0]}`);
    }

    const valoresSubmetidosValidados = Object.fromEntries(
      Object.keys(camposValores).map((campoId) => [
        campoId,
        validacaoAtual.valores[campoId],
      ]),
    );
    for (const [campoId, valor] of Object.entries(valoresSubmetidosValidados)) {
      await tx.bpmCardCampoValor.upsert({
        where: { cardId_campoId: { cardId, campoId } },
        create: { cardId, campoId, valor },
        update: { valor },
      });
    }
    const inicializarStatusPosFechamento = etapaEhFechado(destinoAtual.nome)
      && cardAtual.statusPosFechamento === null;
    const movimento = await tx.bpmCard.updateMany({
      where: {
        id: cardId,
        etapaId: cardAtual.etapaId,
        status: cardAtual.status,
        updatedAt: cardAtual.updatedAt,
      },
      data: {
        etapaId: etapaDestinoId,
        updatedAt: new Date(),
        ...(inicializarStatusPosFechamento
          ? { statusPosFechamento: STATUS_POS_FECHAMENTO_INICIAL }
          : {}),
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
          camposPreenchidos: Object.keys(valoresSubmetidosValidados),
          ...(etapaEhFechado(destinoAtual.nome)
            ? {
                statusPosFechamento: cardAtual.statusPosFechamento
                  ?? STATUS_POS_FECHAMENTO_INICIAL,
              }
            : {}),
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
        : error instanceof Error && error.message === "CONFIGURACAO_FECHADO_INVALIDA"
          ? CONFIGURACAO_FECHADO_INVALIDA_MENSAGEM
        : error instanceof Error && error.message === "CONFIGURACAO_LOST_INVALIDA"
          ? CONFIGURACAO_LOST_INVALIDA_MENSAGEM
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
        : error instanceof Error && error.message === "CONFIGURACAO_FECHADO_INVALIDA"
          ? CONFIGURACAO_FECHADO_INVALIDA_MENSAGEM
        : error instanceof Error && error.message === "CONFIGURACAO_LOST_INVALIDA"
          ? CONFIGURACAO_LOST_INVALIDA_MENSAGEM
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
 * Histórico da empresa num serviço específico (ex: "TTD-409"), cruzando 3 fontes já
 * existentes: cadastros CS&NPS (`ClienteServico`, um registro por serviço contratado),
 * contratos do Painel de Metas (`buscarServicosContratados`) e outros cards do próprio
 * Alpha BPM/CRM para a mesma empresa. Usado pelas tabs de serviço do CardFullViewModal.
 * Fase 3.6 do Cliente Master (2026-08-14): CS&NPS deixou de casar por CNPJ — agora usa
 * `clienteId` direto (FK real, funciona até para empresa "em constituição" sem CNPJ).
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

    const cnpjEmpresa = card.empresa.cnpj;
    const [registrosClientesTodos, contratosTodos, outrosCardsTodos] = await Promise.all([
      db.clienteServico.findMany({
        where: { clienteId: card.empresaId },
        select: {
          id: true, servico: true, status: true, analistaResponsavel: true,
          dataContratacao: true, dataExito: true,
        },
        orderBy: { id: "desc" },
      }),
      cnpjEmpresa ? buscarServicosContratados(cnpjEmpresa) : Promise.resolve([]),
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

    const acessosOutrosCards = await Promise.all(
      outrosCardsTodos.map(async (outroCard) => {
        try {
          await exigirAcessoBpmCard(outroCard.id, userId, session.user.role ?? null, "visualizar");
          return outroCard;
        } catch {
          return null;
        }
      }),
    );
    const outrosCardsVisiveis = acessosOutrosCards.filter(
      (outroCard): outroCard is (typeof outrosCardsTodos)[number] => Boolean(outroCard),
    );
    const data = {
      registrosClientes: registrosClientesTodos.filter((c) => servicoBate(c.servico, servico)),
      contratos: contratosTodos.filter((c) => servicoBate(c.servico, servico)),
      outrosCards: outrosCardsVisiveis.filter((c) => servicoBate(c.servico, servico)),
    };

    return { success: true, data };
  } catch (error) {
    console.error("[ObterHistoricoServicoEmpresa]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao buscar histórico do serviço";
    return { success: false, error: msg };
  }
}

export { isAdminRole };
