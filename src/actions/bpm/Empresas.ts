"use server";
import db from "@/lib/prisma";
import { auth } from "../../../auth";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { normalizarDadosEmpresaBpm, type ClienteEmpresaFonte } from "@/lib/bpm/dados-empresa";

const SELECT_SERVICO_CLIENTE = {
  servico: true,
  status: true,
  analistaResponsavel: true,
  dataContratacao: true,
  dataExito: true,
  formaPagamento: true,
  valorContrato: true,
  closerNome: true,
  origemLead: true,
  canalAquisicao: true,
  canalOutro: true,
  updatedAt: true,
} as const;

type ClienteComServicos = {
  id: number;
  status: string;
  cnpj: string | null;
  razaoSocial: string;
  nomeFantasia: string | null;
  dataConstituicao: string | null;
  uf: string | null;
  municipio: string | null;
  regimeTributario: string | null;
  servicos: {
    servico: string;
    status: string;
    analistaResponsavel: string | null;
    dataContratacao: string | null;
    dataExito: string | null;
    formaPagamento: string | null;
    valorContrato: number | null;
    closerNome: string | null;
    origemLead: string | null;
    canalAquisicao: string | null;
    canalOutro: string | null;
    updatedAt: Date;
  }[];
};

/**
 * Achata `Cliente` + UM `ClienteServico` no formato que `dados-empresa.ts` já espera
 * (empresa+serviço combinados, mesmo shape de 1 linha de `clientes` legado).
 */
function achatarClienteServico(
  cliente: ClienteComServicos,
  servico: ClienteComServicos["servicos"][number] | null,
): ClienteEmpresaFonte {
  return {
    id: cliente.id,
    status: cliente.status,
    cnpj: cliente.cnpj ?? "",
    razaoSocial: cliente.razaoSocial,
    nomeFantasia: cliente.nomeFantasia,
    dataConstituicao: cliente.dataConstituicao,
    uf: cliente.uf,
    municipio: cliente.municipio,
    regimeTributario: cliente.regimeTributario,
    servicos: servico?.servico ?? null,
    analistaResponsavel: servico?.analistaResponsavel ?? null,
    dataContratacao: servico?.dataContratacao ?? null,
    dataExito: servico?.dataExito ?? null,
    formaPagamento: servico?.formaPagamento ?? null,
    valorContrato: servico?.valorContrato ?? null,
    closerNome: servico?.closerNome ?? null,
    origemLead: servico?.origemLead ?? null,
    canalAquisicao: servico?.canalAquisicao ?? null,
    canalOutro: servico?.canalOutro ?? null,
    socios: [],
  };
}

/**
 * Achata `Cliente` + TODOS os `ClienteServico` em N registros — equivalente às N
 * linhas que `clientes` (legado) tinha por CNPJ, uma por serviço contratado.
 * Preserva a visão agregada de múltiplos serviços (status/analistas/closers/etc
 * distintos por serviço) que `normalizarDadosEmpresaBpm` já sabia consolidar.
 */
function achatarTodosServicos(cliente: ClienteComServicos): ClienteEmpresaFonte[] {
  if (cliente.servicos.length === 0) return [achatarClienteServico(cliente, null)];
  return cliente.servicos.map((servico) => achatarClienteServico(cliente, servico));
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
            servicos: { select: SELECT_SERVICO_CLIENTE },
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

    // `Cliente.cnpj` já é normalizado/único (Fase 2 do Cliente Master) — não precisa
    // mais de `cnpjsPossiveis` com/sem máscara (essa lógica só continua necessária
    // para consultar tabelas legadas que ainda guardam CNPJ com formato solto).
    const cnpjLimpo = card.empresa.cnpj?.replace(/\D/g, "") ?? "";

    const [pessoasVinculadas, preAnalise, radarFiscal] = await Promise.all([
      db.pessoaClienteVinculo.findMany({
        where: { clienteId: card.empresa.id },
        select: {
          vinculo: true,
          pessoa: { select: { id: true, nome: true, celular: true, dataNascimento: true, observacao: true } },
        },
        orderBy: { pessoa: { nome: "asc" } },
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
      cnpjLimpo.length === 14
        ? db.radar_fiscal.findFirst({
            where: { cnpj: cnpjLimpo },
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
          })
        : Promise.resolve(null),
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

    const registrosCs = achatarTodosServicos(card.empresa);
    // Empresa principal = serviço mais recentemente atualizado, mesmo critério já
    // usado em outros pontos da Fase 3 (Indicacao/Parceiros) para "estado atual".
    const empresaAchatada = [...registrosCs].sort((a, b) => {
      const servA = card.empresa.servicos.find((s) => s.servico === a.servicos);
      const servB = card.empresa.servicos.find((s) => s.servico === b.servicos);
      return (servB?.updatedAt.getTime() ?? 0) - (servA?.updatedAt.getTime() ?? 0);
    })[0];
    const pessoasFonte = pessoasVinculadas.map((v) => ({
      id: v.pessoa.id,
      nome: v.pessoa.nome,
      telefone: v.pessoa.celular,
      obs: v.pessoa.observacao,
      dataNascimento: v.pessoa.dataNascimento,
      vinculo: v.vinculo,
    }));

    const data = normalizarDadosEmpresaBpm({
      empresaPrincipal: empresaAchatada,
      registrosCs,
      pessoasVinculadas: pessoasFonte,
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
 * Perfil consolidado de uma empresa (Empresa = `Cliente`, Cliente Master): todos os
 * BpmCard dela em qualquer pipeline, agrupados, + histórico consolidado de
 * todos esses cards. Não há ownership check restritivo por card individual
 * aqui — é uma visão agregada por empresa, exige apenas sessão autenticada,
 * igual ao padrão de outras consultas agregadas do painel (ex.: buscarClientes).
 */
export async function ObterPerfilEmpresaBpm(empresaId: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const empresa = await db.cliente.findUnique({
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
