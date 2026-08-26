// CRM de Canais e Parcerias — Fase 03 (Desenvolvimento do Parceiro).
// Ciclo de vida pós-cadastro vive como campos/estados diretamente em `Parceiro`
// (decisão de arquitetura confirmada com o usuário) — sem Kanban de card por parceiro.

import db from "@/lib/prisma";

// Lê o singleton `ParceiroConfig` diretamente (em vez de importar `obterConfigParceiros` de
// `@/actions/convites-parceiro.ts`) para não criar dependência circular: `convites-parceiro.ts`
// já importa `criarParceiro` de `parceiros.ts`, e este módulo é importado por `parceiros.ts`
// (hook de "primeira indicação" em `criarIndicacao`).
async function lerDiasInatividadeConfigurado(): Promise<number> {
  const cfg = await db.parceiroConfig.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
    select: { diasInatividade: true },
  });
  return cfg.diasInatividade;
}

export const ESTAGIOS_DESENVOLVIMENTO = [
  "NOVO",
  "EM_ATIVACAO",
  "ATIVADO_SEM_INDICACAO",
  "PRIMEIRA_INDICACAO",
  "ATIVO",
  "RECORRENTE",
  "INATIVO",
  "EM_REATIVACAO",
] as const;

export type EstagioDesenvolvimento = (typeof ESTAGIOS_DESENVOLVIMENTO)[number];

// Sequência linear "produtiva" do Kanban (RM-2026-2C7A4B) — usada só para decidir se um
// avanço manual de 1 posição é permitido. INATIVO/EM_REATIVACAO ficam FORA da sequência
// (mesmo espírito de SAIDAS_LATERAIS no Kanban de Aquisição): saem/entram por regra própria,
// não por posição numérica.
const SEQUENCIA_ESTAGIOS_PRODUTIVOS: EstagioDesenvolvimento[] = [
  "NOVO",
  "EM_ATIVACAO",
  "ATIVADO_SEM_INDICACAO",
  "PRIMEIRA_INDICACAO",
  "ATIVO",
  "RECORRENTE",
];

/**
 * Valida se um movimento manual no Kanban de Desenvolvimento é permitido — adaptado de
 * `podeMoverPara` (Kanban de Aquisição, `parceiros-aquisicao.ts`). Regras:
 * - Dentro da sequência produtiva: avança 1 posição, ou corrige livremente para trás.
 * - INATIVO → EM_REATIVACAO: única saída manual permitida a partir de INATIVO.
 * - EM_REATIVACAO → qualquer estágio produtivo: reingresso manual livre (mesmo espírito de
 *   "retomar de uma saída lateral" no Kanban de Aquisição).
 * - Nenhum estágio produtivo pode ir direto para INATIVO manualmente (isso é sempre automático,
 *   via `executarJobDesenvolvimentoParceiros` — não é decisão de clique humano).
 */
export function podeMoverEstagioParceiro(atual: EstagioDesenvolvimento, destino: EstagioDesenvolvimento): boolean {
  if (atual === destino) return false;
  if (destino === "INATIVO") return false; // só automático (job de inatividade)

  if (atual === "INATIVO") return destino === "EM_REATIVACAO";

  if (atual === "EM_REATIVACAO") {
    return (SEQUENCIA_ESTAGIOS_PRODUTIVOS as readonly string[]).includes(destino);
  }

  if (destino === "EM_REATIVACAO") return false; // só alcançável a partir de INATIVO

  const idxAtual = SEQUENCIA_ESTAGIOS_PRODUTIVOS.indexOf(atual);
  const idxDestino = SEQUENCIA_ESTAGIOS_PRODUTIVOS.indexOf(destino);
  if (idxAtual === -1 || idxDestino === -1) return false;
  return idxDestino === idxAtual + 1 || idxDestino < idxAtual;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Transiciona o estágio SE for diferente do atual — idempotente, sempre grava histórico. */
export async function transicionarEstagioDesenvolvimento(
  parceiroId: number,
  novoEstagio: EstagioDesenvolvimento,
  opts: { usuarioId?: number | null; automacaoOrigem?: string } = {},
) {
  const atual = await db.parceiro.findUnique({ where: { id: parceiroId }, select: { estagioDesenvolvimento: true } });
  if (!atual) return { alterado: false as const };
  if (atual.estagioDesenvolvimento === novoEstagio) return { alterado: false as const };

  await db.$transaction([
    db.parceiro.update({
      where: { id: parceiroId },
      data: { estagioDesenvolvimento: novoEstagio, estagioDesenvolvimentoAtualizadoEm: new Date() },
    }),
    db.parceiroHistorico.create({
      data: {
        parceiroId,
        acao: "ESTAGIO_ALTERADO",
        valorAnteriorJson: JSON.stringify({ estagioDesenvolvimento: atual.estagioDesenvolvimento }),
        valorNovoJson: JSON.stringify({ estagioDesenvolvimento: novoEstagio }),
        usuarioId: opts.usuarioId ?? null,
        automacaoOrigem: opts.automacaoOrigem ?? null,
      },
    }),
  ]);
  return { alterado: true as const, estagioAnterior: atual.estagioDesenvolvimento as EstagioDesenvolvimento };
}

// Estágios "pré-produtivos" (ou reincidência pós-reativação) elegíveis a avançar
// automaticamente quando uma indicação é criada. `ATIVO`/`RECORRENTE` nunca são tocados por
// esta automação — uma vez lá, só ação manual ou o job de inatividade os move.
// RM-2026-2C7A4B: `INATIVO` saiu desta lista — a partir de agora, um parceiro inativo só volta
// a produzir via reativação explícita (`ReativarParceiro`, que move para `EM_REATIVACAO`
// primeiro); uma indicação chegando durante `EM_REATIVACAO` é o que resolve o destino final.
const ESTAGIOS_ELEGIVEIS_AVANCO_POR_INDICACAO: EstagioDesenvolvimento[] = [
  "NOVO",
  "EM_ATIVACAO",
  "ATIVADO_SEM_INDICACAO",
  "PRIMEIRA_INDICACAO",
  "EM_REATIVACAO",
];

/**
 * Chamado quando uma indicação é criada (`criarIndicacao`, `src/actions/parceiros.ts`).
 * 1ª indicação do parceiro → "PRIMEIRA_INDICACAO" (marco). Indicações seguintes → "ATIVO".
 * Decisão de produto documentada (não estava 100% explícita no pedido original): a etapa
 * "Primeira Indicação" é um marco de UMA indicação; a partir da 2ª, o parceiro já é "Ativo".
 */
export async function sincronizarEstagioAposIndicacao(parceiroId: number, opts: { usuarioId?: number | null } = {}) {
  const [totalIndicacoes, parceiro] = await Promise.all([
    db.indicacao.count({ where: { parceiroId } }),
    db.parceiro.findUnique({ where: { id: parceiroId }, select: { estagioDesenvolvimento: true } }),
  ]);
  if (!parceiro) return { alterado: false as const };
  if (!ESTAGIOS_ELEGIVEIS_AVANCO_POR_INDICACAO.includes(parceiro.estagioDesenvolvimento as EstagioDesenvolvimento)) {
    return { alterado: false as const };
  }

  const novoEstagio: EstagioDesenvolvimento = totalIndicacoes <= 1 ? "PRIMEIRA_INDICACAO" : "ATIVO";
  return transicionarEstagioDesenvolvimento(parceiroId, novoEstagio, {
    usuarioId: opts.usuarioId ?? null,
    automacaoOrigem: "indicacao:criada",
  });
}

/**
 * Job de manutenção (cron) — duas varreduras independentes:
 * 1) onboarding concluído (portal AlphaParceiros já grava `onboardingCompleto`), ainda parado em
 *    NOVO/EM_ATIVACAO → "ATIVADO_SEM_INDICACAO".
 * 2) inatividade: estágio "produtivo" sem indicação real há mais de `diasInatividade`
 *    (config, nunca hardcoded) → "INATIVO".
 */
export async function executarJobDesenvolvimentoParceiros() {
  const diasInatividade = await lerDiasInatividadeConfigurado();
  const resultado = { ativadosSemIndicacao: 0, marcadosInativos: 0 };

  const candidatosAtivacao = await db.parceiro.findMany({
    where: { onboardingCompleto: true, estagioDesenvolvimento: { in: ["NOVO", "EM_ATIVACAO"] } },
    select: { id: true },
  });
  for (const p of candidatosAtivacao) {
    const r = await transicionarEstagioDesenvolvimento(p.id, "ATIVADO_SEM_INDICACAO", { automacaoOrigem: "onboarding:concluido" });
    if (r.alterado) resultado.ativadosSemIndicacao++;
  }

  const limite = new Date(Date.now() - diasInatividade * DIA_MS);
  const candidatosInativos = await db.parceiro.findMany({
    where: {
      estagioDesenvolvimento: { in: ["EM_ATIVACAO", "ATIVADO_SEM_INDICACAO", "PRIMEIRA_INDICACAO", "ATIVO", "RECORRENTE"] },
      OR: [
        { estagioDesenvolvimentoAtualizadoEm: { lt: limite } },
        { estagioDesenvolvimentoAtualizadoEm: null, createdAt: { lt: limite } },
      ],
    },
    select: {
      id: true,
      indicacoes: { orderBy: { dataIndicacao: "desc" }, take: 1, select: { dataIndicacao: true } },
    },
  });
  for (const p of candidatosInativos) {
    const ultimaIndicacao = p.indicacoes[0]?.dataIndicacao ?? null;
    // Indicou depois do limite de corte — está ativo de verdade, não é inatividade real
    // mesmo que `estagioDesenvolvimentoAtualizadoEm` esteja desatualizado.
    if (ultimaIndicacao && ultimaIndicacao.getTime() >= limite.getTime()) continue;
    const r = await transicionarEstagioDesenvolvimento(p.id, "INATIVO", { automacaoOrigem: "inatividade:prazo-excedido" });
    if (r.alterado) resultado.marcadosInativos++;
  }

  return resultado;
}

export interface IndicadoresParceiro {
  jaIndicou: boolean;
  primeiraIndicacaoEm: Date | null;
  ultimaIndicacaoEm: Date | null;
  /** null quando o parceiro nunca indicou (não há data para calcular a partir de). */
  diasSemIndicacao: number | null;
  totalIndicacoes: number;
  totalOportunidades: number;
  contratosOriginados: number;
  conversao: number;
  receitaOriginada: number;
}

/** Indicadores SEMPRE derivados dos registros reais (`Indicacao`/`ClienteServico`/`BpmCard`) — nunca um contador solto. */
export async function calcularIndicadoresParceiro(parceiroId: number): Promise<IndicadoresParceiro> {
  const indicacoes = await db.indicacao.findMany({
    where: { parceiroId },
    select: { clienteId: true, dataIndicacao: true },
    orderBy: { dataIndicacao: "asc" },
  });

  const totalIndicacoes = indicacoes.length;
  const primeiraIndicacaoEm = indicacoes[0]?.dataIndicacao ?? null;
  const ultimaIndicacaoEm = totalIndicacoes > 0 ? indicacoes[totalIndicacoes - 1].dataIndicacao : null;
  const diasSemIndicacao = ultimaIndicacaoEm ? Math.floor((Date.now() - ultimaIndicacaoEm.getTime()) / DIA_MS) : null;

  const clienteIds = [...new Set(indicacoes.map((i) => i.clienteId))];
  const [servicos, totalOportunidades] = await Promise.all([
    clienteIds.length > 0
      ? db.clienteServico.findMany({
          where: { clienteId: { in: clienteIds } },
          select: { valorContrato: true, dataContratacao: true },
        })
      : Promise.resolve([]),
    clienteIds.length > 0 ? db.bpmCard.count({ where: { empresaId: { in: clienteIds } } }) : Promise.resolve(0),
  ]);

  const contratosOriginados = servicos.filter((s) => Boolean(s.dataContratacao)).length;
  const receitaOriginada = servicos.reduce((soma, s) => soma + (s.valorContrato ?? 0), 0);
  const conversao = totalIndicacoes > 0 ? contratosOriginados / totalIndicacoes : 0;

  return {
    jaIndicou: totalIndicacoes > 0,
    primeiraIndicacaoEm,
    ultimaIndicacaoEm,
    diasSemIndicacao,
    totalIndicacoes,
    totalOportunidades,
    contratosOriginados,
    conversao,
    receitaOriginada,
  };
}
