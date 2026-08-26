"use server";

// CRM de Canais e Parcerias — Fase 05 (Dashboard + Fila de Follow-up + Alertas).

import db from "@/lib/prisma";
import { getCtx } from "./parceiros";
import { calcularIndicadoresParceiro } from "@/lib/parceiros/desenvolvimento";
import { calcularPrioridadeFollowUp, followUpEstaVencido, DIA_MS } from "@/lib/parceiros/prioridade";

function inicioDoMes(offsetMeses: number): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() - offsetMeses);
  return d;
}

async function lerConfigRegras() {
  return db.parceiroConfig.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
    select: { diasAlertaSemIndicacao: true, diasInatividade: true, gerarTarefaAutomaticaAlertas: true },
  });
}

const ALERTA_TAREFA_TITULO: Record<AlertaParceiro["tipo"], string> = {
  SEM_PROXIMA_ACAO: "Definir próxima ação",
  FOLLOWUP_VENCIDO: "Follow-up vencido — retomar contato",
  PARCEIRO_INATIVO: "Reativar parceiro inativo",
  CADASTRO_PENDENTE: "Aprovar pré-cadastro pendente",
  SEM_INDICACAO: "Sem indicação no prazo — contatar parceiro",
};

/**
 * Gera `ParceiroTarefa` automáticas a partir dos alertas ativos, quando ligado em
 * `ParceiroConfig.gerarTarefaAutomaticaAlertas`. Idempotente: só cria se ainda não existir
 * uma tarefa automática PENDENTE do mesmo tipo para o mesmo parceiro — evita duplicar a
 * cada refresh do dashboard. Alertas sem `parceiroId` (ex: CADASTRO_PENDENTE) são ignorados,
 * pois não há parceiro para vincular a tarefa.
 *
 * Nota de segurança (auditada — aceita por desenho): chamada a partir de `ListarAlertasParceiros`,
 * que só exige `ctx` (sessão válida + acesso ao módulo), não `podeEditar`. Ou seja, qualquer
 * usuário com acesso de LEITURA ao Dashboard pode, como efeito colateral de abrir a aba
 * Alertas, disparar esta escrita no banco. Isso é intencional: (1) o toggle que liga a
 * automação (`gerarTarefaAutomaticaAlertas`) é Admin-only via `AtualizarRegrasParceiros`,
 * então a superfície só existe se um Admin optou por ativá-la; (2) o efeito é sempre a
 * criação de uma tarefa refletindo um alerta que já é público a qualquer leitor do módulo,
 * nunca uma ação destrutiva ou exposição de dado novo. Se essa automação ganhar efeitos mais
 * sensíveis no futuro (ex: notificar externamente, cobrar), mover a checagem para dentro
 * deste helper (`ctx.isAdmin || ctx.podeEditar`) antes de expandir o escopo.
 */
async function gerarTarefasAutomaticasDeAlertas(alertas: AlertaParceiro[]) {
  const candidatos = alertas.filter((a): a is AlertaParceiro & { parceiroId: number } => a.parceiroId !== undefined);
  if (candidatos.length === 0) return;

  const existentes = await db.parceiroTarefa.findMany({
    where: {
      status: "PENDENTE",
      origemAutomatica: true,
      parceiroId: { in: candidatos.map((a) => a.parceiroId) },
    },
    select: { parceiroId: true, alertaOrigemTipo: true },
  });
  const jaExiste = new Set(existentes.map((t) => `${t.parceiroId}:${t.alertaOrigemTipo}`));

  const novas = candidatos.filter((a) => !jaExiste.has(`${a.parceiroId}:${a.tipo}`));
  if (novas.length === 0) return;

  await db.parceiroTarefa.createMany({
    data: novas.map((a) => ({
      parceiroId: a.parceiroId,
      titulo: ALERTA_TAREFA_TITULO[a.tipo],
      descricao: a.detalhe,
      prioridade: "ALTA" as const,
      origemAutomatica: true,
      alertaOrigemTipo: a.tipo,
    })),
  });
}

/** Todo indicador tem origem de dado clara — nada artificial. */
export async function ObterDashboardCanaisParcerias(periodoDias = 30) {
  const ctx = await getCtx();
  if (!ctx) return { success: false as const, error: "Sem permissão" };

  const cfg = await lerConfigRegras();
  const inicioPeriodo = new Date(Date.now() - periodoDias * DIA_MS);

  const [
    parceirosNoFunilAquisicao,
    novosParceiros,
    emAtivacao,
    ativos,
    recorrentes,
    inativos,
    indicacoesNoPeriodo,
    todosParceirosParaSemIndicacao,
  ] = await Promise.all([
    db.parceiroLead.count({ where: { status: { not: "CADASTRADO" } } }),
    db.parceiro.count({ where: { createdAt: { gte: inicioPeriodo } } }),
    db.parceiro.count({ where: { estagioDesenvolvimento: "EM_ATIVACAO" } }),
    db.parceiro.count({ where: { estagioDesenvolvimento: { in: ["ATIVO", "RECORRENTE"] } } }),
    db.parceiro.count({ where: { estagioDesenvolvimento: "RECORRENTE" } }),
    db.parceiro.count({ where: { estagioDesenvolvimento: "INATIVO" } }),
    db.indicacao.count({ where: { dataIndicacao: { gte: inicioPeriodo } } }),
    db.parceiro.findMany({
      where: { estagioDesenvolvimento: { in: ["ATIVO", "RECORRENTE", "ATIVADO_SEM_INDICACAO"] } },
      select: { id: true },
    }),
  ]);

  // "Sem indicação acima do prazo" e receita/contratos originados no período — derivados dos
  // registros reais de indicação de cada parceiro (não um contador solto).
  let semIndicacaoAcimaDoPrazo = 0;
  let contratosOriginadosNoPeriodo = 0;
  let receitaOriginadaNoPeriodo = 0;
  if (cfg.diasAlertaSemIndicacao !== null) {
    for (const p of todosParceirosParaSemIndicacao) {
      const ind = await calcularIndicadoresParceiro(p.id);
      if (ind.diasSemIndicacao !== null && ind.diasSemIndicacao > cfg.diasAlertaSemIndicacao) {
        semIndicacaoAcimaDoPrazo++;
      }
    }
  }

  const indicacoesComEmpresa = await db.indicacao.findMany({
    where: { dataIndicacao: { gte: inicioPeriodo } },
    select: { clienteId: true },
  });
  const clienteIdsPeriodo = [...new Set(indicacoesComEmpresa.map((i) => i.clienteId))];
  if (clienteIdsPeriodo.length > 0) {
    const servicos = await db.clienteServico.findMany({
      where: { clienteId: { in: clienteIdsPeriodo }, dataContratacao: { not: null } },
      select: { valorContrato: true },
    });
    contratosOriginadosNoPeriodo = servicos.length;
    receitaOriginadaNoPeriodo = servicos.reduce((s, x) => s + (x.valorContrato ?? 0), 0);
  }
  const conversaoNoPeriodo = indicacoesNoPeriodo > 0 ? contratosOriginadosNoPeriodo / indicacoesNoPeriodo : 0;

  // Evolução — 6 últimos meses (buckets simples, sem parametrização extra nesta primeira entrega).
  const evolucaoAquisicao: { mes: string; total: number }[] = [];
  const evolucaoAtivacao: { mes: string; total: number }[] = [];
  const evolucaoRecorrencia: { mes: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const de = inicioDoMes(i);
    const ate = inicioDoMes(i - 1);
    const [leadsNoMes, ativacoesNoMes, recorrenciasNoMes] = await Promise.all([
      db.parceiroLead.count({ where: { createdAt: { gte: de, lt: ate } } }),
      db.parceiroHistorico.count({
        where: { acao: "ESTAGIO_ALTERADO", valorNovoJson: { contains: '"estagioDesenvolvimento":"ATIVO"' }, createdAt: { gte: de, lt: ate } },
      }),
      db.parceiroHistorico.count({
        where: { acao: "ESTAGIO_ALTERADO", valorNovoJson: { contains: '"estagioDesenvolvimento":"RECORRENTE"' }, createdAt: { gte: de, lt: ate } },
      }),
    ]);
    const rotulo = de.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
    evolucaoAquisicao.push({ mes: rotulo, total: leadsNoMes });
    evolucaoAtivacao.push({ mes: rotulo, total: ativacoesNoMes });
    evolucaoRecorrencia.push({ mes: rotulo, total: recorrenciasNoMes });
  }

  return {
    success: true as const,
    indicadores: {
      parceirosNoFunilAquisicao,
      novosParceiros,
      emAtivacao,
      ativos,
      recorrentes,
      inativos,
      semIndicacaoAcimaDoPrazo,
      indicacoesNoPeriodo,
      contratosOriginadosNoPeriodo,
      conversaoNoPeriodo,
      receitaOriginadaNoPeriodo,
    },
    evolucao: { aquisicao: evolucaoAquisicao, ativacao: evolucaoAtivacao, recorrencia: evolucaoRecorrencia },
    periodoDias,
  };
}

export interface ItemFilaFollowUp {
  parceiroId: number;
  nome: string;
  potencialRecorrencia: number | null;
  ultimaIndicacaoEm: Date | null;
  diasSemIndicacao: number | null;
  proximaAcaoEm: Date | null;
  followUpVencido: boolean;
  estagioDesenvolvimento: string;
  prioridade: number;
}

/** Fila de Follow-up — view operacional, ordenada por prioridade (quem mais precisa de atenção primeiro). */
export async function ListarFilaFollowUpParceiros(filtros?: { responsavelId?: number; potencialMin?: number }) {
  const ctx = await getCtx();
  if (!ctx) return { success: false as const, error: "Sem permissão", itens: [] as ItemFilaFollowUp[] };

  const parceiros = await db.parceiro.findMany({
    where: {
      ativo: true,
      estagioDesenvolvimento: { not: "INATIVO" }, // inativo é alerta separado, não compete na fila comercial
      responsavelId: filtros?.responsavelId,
      potencialRecorrencia: filtros?.potencialMin !== undefined ? { gte: filtros.potencialMin } : undefined,
    },
    select: { id: true, nome: true, potencialRecorrencia: true, estagioDesenvolvimento: true, proximaAcaoEm: true },
  });

  const itens: ItemFilaFollowUp[] = [];
  for (const p of parceiros) {
    const ind = await calcularIndicadoresParceiro(p.id);
    // RM-2026-2C7A4B: `proximaAcaoEm` agora é um campo real de `Parceiro` (mesmo padrão de
    // `ParceiroLead`), registrado via `RegistrarProximaAcaoParceiro` — deixou de ser hardcode.
    const proximaAcaoEm = p.proximaAcaoEm;
    itens.push({
      parceiroId: p.id,
      nome: p.nome,
      potencialRecorrencia: p.potencialRecorrencia,
      ultimaIndicacaoEm: ind.ultimaIndicacaoEm,
      diasSemIndicacao: ind.diasSemIndicacao,
      proximaAcaoEm,
      followUpVencido: followUpEstaVencido(proximaAcaoEm),
      estagioDesenvolvimento: p.estagioDesenvolvimento,
      prioridade: calcularPrioridadeFollowUp({
        potencialRecorrencia: p.potencialRecorrencia,
        proximaAcaoEm,
        diasSemIndicacao: ind.diasSemIndicacao,
        estagioDesenvolvimento: p.estagioDesenvolvimento,
      }),
    });
  }

  itens.sort((a, b) => b.prioridade - a.prioridade);
  return { success: true as const, itens };
}

export interface AlertaParceiro {
  tipo: "SEM_PROXIMA_ACAO" | "FOLLOWUP_VENCIDO" | "PARCEIRO_INATIVO" | "CADASTRO_PENDENTE" | "SEM_INDICACAO";
  parceiroId?: number;
  parceiroLeadId?: string;
  preCadastroId?: number;
  nome: string;
  detalhe: string;
}

/** Alertas configuráveis — todo prazo vem de `ParceiroConfig`, nunca hardcoded. */
export async function ListarAlertasParceiros() {
  const ctx = await getCtx();
  if (!ctx) return { success: false as const, error: "Sem permissão", alertas: [] as AlertaParceiro[] };

  const cfg = await lerConfigRegras();
  const alertas: AlertaParceiro[] = [];

  const parceirosInativos = await db.parceiro.findMany({
    where: { estagioDesenvolvimento: "INATIVO", ativo: true },
    select: { id: true, nome: true },
  });
  for (const p of parceirosInativos) {
    alertas.push({ tipo: "PARCEIRO_INATIVO", parceiroId: p.id, nome: p.nome, detalhe: `Sem movimentação há mais de ${cfg.diasInatividade} dias` });
  }

  if (cfg.diasAlertaSemIndicacao !== null) {
    const candidatos = await db.parceiro.findMany({
      where: { ativo: true, estagioDesenvolvimento: { not: "INATIVO" } },
      select: { id: true, nome: true },
    });
    for (const p of candidatos) {
      const ind = await calcularIndicadoresParceiro(p.id);
      if (ind.diasSemIndicacao !== null && ind.diasSemIndicacao > cfg.diasAlertaSemIndicacao) {
        alertas.push({ tipo: "SEM_INDICACAO", parceiroId: p.id, nome: p.nome, detalhe: `${ind.diasSemIndicacao} dias sem indicação (prazo: ${cfg.diasAlertaSemIndicacao})` });
      }
    }
  }

  const preCadastrosPendentes = await db.preCadastroParceiro.findMany({
    where: { status: "PENDENTE" },
    select: { id: true, nomeCompleto: true, createdAt: true },
  });
  for (const p of preCadastrosPendentes) {
    alertas.push({ tipo: "CADASTRO_PENDENTE", preCadastroId: p.id, nome: p.nomeCompleto, detalhe: "Pré-cadastro aguardando aprovação" });
  }

  if (cfg.gerarTarefaAutomaticaAlertas) {
    await gerarTarefasAutomaticasDeAlertas(alertas);
  }

  return { success: true as const, alertas };
}
