"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import {
  criarCardSchema,
  atualizarCardSchema,
  moverCardSchema,
} from "@/lib/validations/bpm";
import { exigirAcessoBpmCard, isAdminRole } from "@/lib/bpm/ownership";
import { executarAutomacaoFechamentoComercial } from "@/lib/bpm/automacoes";
import { buscarServicosContratados } from "@/actions/Clientes";

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
    if (!termo || termo.trim().length < 2) return { success: true, data: [] };

    const empresas = await db.clientes.findMany({
      where: {
        OR: [
          { razaoSocial: { contains: termo } },
          { nomeFantasia: { contains: termo } },
          { cnpj: { contains: termo } },
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

    return { success: true, data: cards };
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
        etapa: true,
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

    // Indicador "nunca acessado" — primeiro acesso por QUALQUER usuário apaga a marcação.
    if (!card.primeiraVisualizacaoEm) {
      const agora = new Date();
      await db.bpmCard.update({ where: { id: cardId }, data: { primeiraVisualizacaoEm: agora } });
      card.primeiraVisualizacaoEm = agora;
    }

    return { success: true, data: card };
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

    // D-021: empresa é sempre obrigatória — já garantido pelo schema Zod (empresaId obrigatório),
    // aqui confirmamos que a empresa de fato existe.
    const empresaExiste = await db.clientes.findUnique({ where: { id: empresaId }, select: { id: true } });
    if (!empresaExiste) return { success: false, error: "Empresa não encontrada" };

    const etapa = await db.bpmEtapa.findUnique({ where: { id: etapaId }, select: { pipelineId: true } });
    if (!etapa || etapa.pipelineId !== pipelineId) {
      return { success: false, error: "Etapa não pertence ao pipeline informado" };
    }

    // D-024: bloqueio de avanço/criação quando campos obrigatórios da etapa não estão preenchidos.
    const camposObrigatorios = await db.bpmCampo.findMany({
      where: { pipelineId, etapaId, obrigatorio: true },
      select: { id: true, nome: true },
    });
    const faltantes = camposObrigatorios.filter(
      (c) => !camposValores?.[c.id] || camposValores[c.id].trim() === "",
    );
    if (faltantes.length > 0) {
      return {
        success: false,
        error: `Campos obrigatórios não preenchidos: ${faltantes.map((f) => f.nome).join(", ")}`,
      };
    }

    const card = await db.$transaction(async (tx) => {
      const novoCard = await tx.bpmCard.create({
        data: { empresaId, pipelineId, etapaId, responsavelId, servico },
      });

      // D-041: responsável principal também é registrado como membro RESPONSAVEL.
      await tx.bpmCardMembro.create({
        data: { cardId: novoCard.id, userId: responsavelId, role: "RESPONSAVEL" },
      });

      if (camposValores) {
        const entradas = Object.entries(camposValores).filter(([, v]) => v.trim() !== "");
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
    return { success: true, data: card };
  } catch (error) {
    console.error("[CriarCardBpm]", error);
    return { success: false, error: "Erro ao criar card" };
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

    await db.$transaction(async (tx) => {
      await tx.bpmCard.update({ where: { id: cardId }, data: campos });

      if (camposValores) {
        for (const [campoId, valor] of Object.entries(camposValores)) {
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
          valorAnteriorJson: JSON.stringify(cardAnterior),
          valorNovoJson: JSON.stringify(campos),
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
    return { success: true };
  } catch (error) {
    console.error("[AtualizarCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao atualizar card";
    return { success: false, error: msg };
  }
}

export async function MoverCardBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = moverCardSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { cardId, etapaDestinoId } = parsed.data;

    // D-042: apenas o responsável do card ou um administrador pode movê-lo de etapa.
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "moverEtapa");

    const card = await db.bpmCard.findUnique({ where: { id: cardId } });
    if (!card) return { success: false, error: "Card não encontrado" };

    const etapaDestino = await db.bpmEtapa.findUnique({ where: { id: etapaDestinoId } });
    if (!etapaDestino || etapaDestino.pipelineId !== card.pipelineId) {
      return { success: false, error: "Etapa não pertence ao pipeline do card" };
    }

    if (card.etapaId === etapaDestinoId) return { success: true };

    // Máquina de estado do pipeline "Revisão de Radar" (plano-novos-leads-bpm.md): se a etapa de
    // ORIGEM tem QUALQUER transição cadastrada, só os destinos explicitamente permitidos valem.
    // Etapa sem nenhuma linha cadastrada continua permitindo qualquer destino (fallback preserva
    // o comportamento livre dos pipelines "Financeiro"/"Radar", que nunca pediram essa restrição).
    const transicoesDaOrigem = await db.bpmEtapaTransicaoPermitida.findMany({
      where: { etapaOrigemId: card.etapaId },
      select: { etapaDestinoId: true },
    });
    if (transicoesDaOrigem.length > 0) {
      const destinosPermitidos = new Set(transicoesDaOrigem.map((t) => t.etapaDestinoId));
      if (!destinosPermitidos.has(etapaDestinoId)) {
        return {
          success: false,
          error: `Não é possível mover diretamente desta etapa para "${etapaDestino.nome}" — verifique as etapas permitidas.`,
        };
      }
    }

    // Campos obrigatórios: (a) BpmCampo cadastrado DIRETO na etapa destino (mecanismo original);
    // (b) BpmCampo de nível pipeline (etapaId: null) marcado como obrigatório NESTA etapa via
    // BpmCampoObrigatorioEtapa — permite reaproveitar o mesmo campo (ex: "Valor acordado no
    // contrato") como obrigatório em várias etapas sem duplicá-lo.
    const [camposDiretos, camposViaJuncao] = await Promise.all([
      db.bpmCampo.findMany({
        where: { pipelineId: card.pipelineId, etapaId: etapaDestinoId, obrigatorio: true },
        select: { id: true, nome: true },
      }),
      db.bpmCampoObrigatorioEtapa.findMany({
        where: { etapaId: etapaDestinoId },
        select: { campo: { select: { id: true, nome: true } } },
      }),
    ]);
    const camposObrigatoriosDestino = [
      ...camposDiretos,
      ...camposViaJuncao.map((c) => c.campo),
    ].filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i); // dedupe por id

    if (camposObrigatoriosDestino.length > 0) {
      const valoresPreenchidos = await db.bpmCardCampoValor.findMany({
        where: { cardId, campoId: { in: camposObrigatoriosDestino.map((c) => c.id) } },
        select: { campoId: true, valor: true },
      });
      const preenchidoPorCampo = new Map(valoresPreenchidos.map((v) => [v.campoId, v.valor]));
      const faltantes = camposObrigatoriosDestino.filter(
        (c) => !preenchidoPorCampo.get(c.id) || preenchidoPorCampo.get(c.id)?.trim() === "",
      );
      if (faltantes.length > 0) {
        return {
          success: false,
          error: `Não é possível avançar: campos obrigatórios pendentes (${faltantes.map((f) => f.nome).join(", ")})`,
        };
      }
    }

    // Validação de ENTRADA (diferente de "obrigatório para mover"): Em Tratativa/Sem Viabilidade
    // exigem BpmCard.proximoContatoEm preenchido para o card poder ENTRAR na etapa — é coluna
    // nativa do BpmCard, não um BpmCampo, então precisa de checagem própria (ver plano, Coluna 4/7).
    const ETAPAS_EXIGEM_PROXIMO_CONTATO = ["Em tratativa", "Sem viabilidade"];
    if (ETAPAS_EXIGEM_PROXIMO_CONTATO.includes(etapaDestino.nome) && !card.proximoContatoEm) {
      return {
        success: false,
        error: `Não é possível avançar para "${etapaDestino.nome}": o campo "Próximo Contato" precisa estar preenchido.`,
      };
    }

    await db.$transaction(async (tx) => {
      await tx.bpmCard.update({ where: { id: cardId }, data: { etapaId: etapaDestinoId } });
      await tx.bpmCardHistorico.create({
        data: {
          cardId,
          acao: "CARD_MOVIDO",
          usuarioId: userId,
          valorAnteriorJson: JSON.stringify({ etapaId: card.etapaId }),
          valorNovoJson: JSON.stringify({ etapaId: etapaDestinoId }),
        },
      });
    });

    // D-009/D-034: automação em código, disparada após o card mudar de etapa.
    await executarAutomacaoFechamentoComercial(cardId, userId);

    revalidatePath(`${ROTA_BASE}/pipeline/${card.pipelineId}`);
    revalidatePath(ROTA_BASE);
    revalidatePath(`${ROTA_BASE}/tarefas`);
    return { success: true };
  } catch (error) {
    console.error("[MoverCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao mover card";
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
