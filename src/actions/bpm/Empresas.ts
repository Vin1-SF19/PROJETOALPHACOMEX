"use server";
import db from "@/lib/prisma";
import { auth } from "../../../auth";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { normalizarDadosEmpresaBpm } from "@/lib/bpm/dados-empresa";

function formatarCnpj(cnpj: string): string {
  const digitos = cnpj.replace(/\D/g, "");
  if (digitos.length !== 14) return cnpj;
  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/**
 * Consolida, sem mutações, os dados da empresa usados por Pré-Análise, CS&NPS,
 * Radar Fiscal e pelo próprio card. O ownership é validado antes de qualquer
 * consulta aos dados empresariais.
 */
export async function ObterDadosEmpresaCardBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: null };
    const userId = Number(session.user.id);

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "visualizar");

    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: {
        empresa: {
          select: {
            id: true,
            status: true,
            cnpj: true,
            razaoSocial: true,
            nomeFantasia: true,
            dataConstituicao: true,
            uf: true,
            municipio: true,
            regimeTributario: true,
            servicos: true,
            analistaResponsavel: true,
            dataContratacao: true,
            dataExito: true,
            formaPagamento: true,
            valorContrato: true,
            closerNome: true,
            origemLead: true,
            canalAquisicao: true,
            canalOutro: true,
            socios: {
              select: {
                id: true,
                nome: true,
                telefone: true,
                obs: true,
                dataNascimento: true,
                vinculo: true,
              },
            },
          },
        },
        responsavel: { select: { nome: true } },
        membros: {
          select: {
            role: true,
            usuario: { select: { nome: true } },
          },
        },
      },
    });
    if (!card) return { success: false, error: "Card não encontrado", data: null };

    const cnpjLimpo = card.empresa.cnpj.replace(/\D/g, "");
    const cnpjsPossiveis = Array.from(new Set([
      card.empresa.cnpj,
      cnpjLimpo,
      formatarCnpj(cnpjLimpo),
    ].filter(Boolean)));

    const [registrosCs, pessoasVinculadas, preAnalise, radarFiscal] = await Promise.all([
      db.clientes.findMany({
        where: { cnpj: { in: cnpjsPossiveis } },
        select: {
          id: true,
          status: true,
          cnpj: true,
          razaoSocial: true,
          nomeFantasia: true,
          dataConstituicao: true,
          uf: true,
          municipio: true,
          regimeTributario: true,
          servicos: true,
          analistaResponsavel: true,
          dataContratacao: true,
          dataExito: true,
          formaPagamento: true,
          valorContrato: true,
          closerNome: true,
          origemLead: true,
          canalAquisicao: true,
          canalOutro: true,
          socios: {
            select: {
              id: true,
              nome: true,
              telefone: true,
              obs: true,
              dataNascimento: true,
              vinculo: true,
            },
          },
        },
        orderBy: { id: "asc" },
      }),
      db.socios.findMany({
        where: {
          OR: [
            { clienteId: card.empresa.id },
            { empresaVinculos: { some: { empresaId: card.empresa.id } } },
          ],
        },
        select: {
          id: true,
          nome: true,
          telefone: true,
          obs: true,
          dataNascimento: true,
          vinculo: true,
        },
        orderBy: { nome: "asc" },
      }),
      cnpjLimpo.length === 14
        ? db.consultaPreAnalise.findUnique({
            where: { cnpj: cnpjLimpo },
            select: {
              regimeEA: true,
              qualificacao: true,
              submodalidade: true,
              capitalSocial: true,
              nomeResponsavel: true,
              telefoneContato: true,
              observacoes: true,
              dadosBrutos: true,
              updatedAt: true,
            },
          })
        : Promise.resolve(null),
      db.radar_fiscal.findFirst({
        where: { cnpj: { in: cnpjsPossiveis } },
        select: {
          qualificacao: true,
          situacao_cadastral: true,
          data_abertura: true,
          capital_social: true,
          regime_receita: true,
          regime_ea: true,
          data_opcao_simples: true,
          data_exclusao_simples: true,
          divida_tributaria: true,
          historico_regime: true,
          cnaes: true,
          qsa: true,
          data_consulta: true,
          perse_anexo: true,
          perse: true,
        },
      }),
    ]);

    const papeis: Record<string, string> = {
      RESPONSAVEL: "Responsável do card",
      ADMINISTRADOR: "Administrador do card",
      PARTICIPANTE: "Participante do card",
    };
    const responsaveisBpm = [
      { nome: card.responsavel.nome, papel: "Responsável do card" },
      ...card.membros.map((membro) => ({
        nome: membro.usuario.nome,
        papel: papeis[membro.role] || membro.role,
      })),
    ];

    const data = normalizarDadosEmpresaBpm({
      empresaPrincipal: card.empresa,
      registrosCs: registrosCs.length > 0 ? registrosCs : [card.empresa],
      pessoasVinculadas,
      preAnalise,
      radarFiscal,
      responsaveisBpm,
    });

    return { success: true, data };
  } catch (error) {
    console.error("[ObterDadosEmpresaCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado"
      : "Erro ao buscar dados da empresa";
    return { success: false, error: msg, data: null };
  }
}

/**
 * Perfil consolidado de uma empresa (Empresa = `clientes`, D-049): todos os
 * BpmCard dela em qualquer pipeline, agrupados, + histórico consolidado de
 * todos esses cards. Não há ownership check restritivo por card individual
 * aqui — é uma visão agregada por empresa, exige apenas sessão autenticada,
 * igual ao padrão de outras consultas agregadas do painel (ex.: buscarClientes).
 */
export async function ObterPerfilEmpresaBpm(empresaId: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const empresa = await db.clientes.findUnique({
      where: { id: empresaId },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, status: true },
    });
    if (!empresa) return { success: false, error: "Empresa não encontrada" };

    const cards = await db.bpmCard.findMany({
      where: { empresaId },
      select: {
        id: true,
        status: true,
        servico: true,
        createdAt: true,
        concluidoEm: true,
        pipeline: { select: { id: true, nome: true } },
        etapa: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
        _count: { select: { tarefas: true, anexos: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const cardIds = cards.map((c) => c.id);

    const historico = cardIds.length
      ? await db.bpmCardHistorico.findMany({
          where: { cardId: { in: cardIds } },
          include: {
            card: { select: { id: true, pipeline: { select: { nome: true } } } },
            usuario: { select: { id: true, nome: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : [];

    const cardsPorPipeline = new Map<string, typeof cards>();
    for (const card of cards) {
      const chave = card.pipeline.nome;
      if (!cardsPorPipeline.has(chave)) cardsPorPipeline.set(chave, []);
      cardsPorPipeline.get(chave)!.push(card);
    }

    return {
      success: true,
      data: {
        empresa,
        cardsPorPipeline: Array.from(cardsPorPipeline.entries()).map(([pipelineNome, cardsDoPipeline]) => ({
          pipelineNome,
          cards: cardsDoPipeline,
        })),
        totalCards: cards.length,
        historico,
      },
    };
  } catch (error) {
    console.error("[ObterPerfilEmpresaBpm]", error);
    return { success: false, error: "Erro ao buscar perfil da empresa" };
  }
}
