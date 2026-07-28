import db from "@/lib/prisma";

/**
 * Monta as linhas do espelho de comissões/prêmios (seção 21-23 do prompt original) a
 * partir de filtros — SEM PERSISTIR NADA. Cada linha reflete os dados reais disponíveis;
 * campos que dependem de infraestrutura ainda não implementada (honorários/tarifário real
 * por serviço, que dependem de `TariffVersion` — ainda não populado até a Fase 14) ficam
 * como `null`, nunca inventados.
 */

export type TipoEspelho = "comissoes" | "premios" | "comissao_dsr" | "todos";

export interface FiltrosPreview {
  tipo: TipoEspelho;
  colaboradorId?: number;
  periodoInicio: Date;
  periodoFim: Date;
  status?: string;
}

export interface LinhaEspelho {
  entryId: string;
  componenteId: string;
  data: Date;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  servico: string;
  evento: string;
  honorariosCents: number | null;
  tarifarioCents: number | null;
  baseComissionavelCents: number | null;
  formaPagamento: string | null;
  percentual: number | null;
  valorFixoCents: number | null;
  comissaoCents: number;
  dsrCents: number;
  premioCents: number;
  ajusteCents: number;
  totalCents: number;
  previsao: Date | null;
  pagamento: Date | null;
  status: string;
  observacao: string | null;
  colaboradorId: number;
  colaboradorNome: string;
  cargoNome: string | null;
}

export interface PreviewResult {
  linhas: LinhaEspelho[];
  totais: {
    comissaoCents: number;
    dsrCents: number;
    premioCents: number;
    ajusteCents: number;
    totalGeralCents: number;
  };
}

function tiposDeComponenteParaFiltro(tipo: TipoEspelho): string[] {
  switch (tipo) {
    case "comissoes":
      return ["COMISSAO"];
    case "premios":
      return ["PREMIO"];
    case "comissao_dsr":
      return ["COMISSAO", "DSR"];
    case "todos":
      return ["COMISSAO", "PREMIO", "DSR", "AJUSTE"];
    default: {
      const _exhaustive: never = tipo;
      return _exhaustive;
    }
  }
}

export async function construirPreviewEspelho(filtros: FiltrosPreview): Promise<PreviewResult> {
  const tiposComponente = tiposDeComponenteParaFiltro(filtros.tipo);

  const entries = await db.commissionEntry.findMany({
    where: {
      ...(filtros.colaboradorId ? { collaboratorId: filtros.colaboradorId } : {}),
      ...(filtros.status ? { status: filtros.status } : {}),
      createdAt: { gte: filtros.periodoInicio, lte: filtros.periodoFim },
    },
    include: {
      componentes: { where: { tipo: { in: tiposComponente } } },
      ajustes: true,
      alocacoes: true,
      event: true,
    },
  });

  const linhas: LinhaEspelho[] = [];

  for (const entry of entries) {
    if (entry.componentes.length === 0) continue; // sem componente do tipo filtrado — não entra no espelho

    const usuario = await db.usuarios.findUnique({
      where: { id: entry.collaboratorId },
      select: { nome: true, cargo: true },
    });

    const comissaoCents = entry.componentes.filter((c) => c.tipo === "COMISSAO").reduce((s, c) => s + c.valorCents, 0);
    const dsrCents = entry.componentes.filter((c) => c.tipo === "DSR").reduce((s, c) => s + c.valorCents, 0);
    const premioCents = entry.componentes.filter((c) => c.tipo === "PREMIO").reduce((s, c) => s + c.valorCents, 0);
    const ajusteCents = entry.ajustes.reduce((s, a) => s + (a.valorAjustadoCents - a.valorOriginalCents), 0);

    const componentePercentual = entry.componentes.find((c) => c.percentual !== null);
    const componenteFixo = entry.componentes.find((c) => c.percentual === null);

    const ultimaAlocacao = entry.alocacoes.length > 0 ? entry.alocacoes[entry.alocacoes.length - 1] : null;
    const ultimoPagamento = ultimaAlocacao
      ? await db.payment.findUnique({ where: { id: ultimaAlocacao.paymentId }, select: { data: true } })
      : null;

    linhas.push({
      entryId: entry.id,
      componenteId: entry.componentes[0].id,
      data: entry.event?.eventDate ?? entry.createdAt,
      cnpj: entry.event?.cnpj ?? "",
      razaoSocial: entry.event?.razaoSocial ?? "",
      nomeFantasia: entry.event?.nomeFantasia ?? null,
      servico: entry.event?.servico ?? "",
      evento: entry.event?.eventType ?? "",
      // Honorários/tarifário real por serviço dependem de TariffVersion — ainda não
      // populado (Fase 14). Nunca inventar um valor aqui.
      honorariosCents: null,
      tarifarioCents: null,
      baseComissionavelCents: entry.event?.commissionableBaseCents ?? null,
      formaPagamento: entry.event?.formaPagamento ?? null,
      percentual: componentePercentual?.percentual ?? null,
      valorFixoCents: componenteFixo?.valorCents ?? null,
      comissaoCents,
      dsrCents,
      premioCents,
      ajusteCents,
      totalCents: entry.totalCents,
      previsao: entry.contractualDueDate,
      pagamento: ultimoPagamento?.data ?? null,
      status: entry.status,
      observacao: entry.ajustes.map((a) => a.justificativa).join("; ") || null,
      colaboradorId: entry.collaboratorId,
      colaboradorNome: usuario?.nome ?? "Colaborador não encontrado",
      cargoNome: usuario?.cargo ?? null,
    });
  }

  const totais = linhas.reduce(
    (acc, l) => ({
      comissaoCents: acc.comissaoCents + l.comissaoCents,
      dsrCents: acc.dsrCents + l.dsrCents,
      premioCents: acc.premioCents + l.premioCents,
      ajusteCents: acc.ajusteCents + l.ajusteCents,
      totalGeralCents: acc.totalGeralCents + l.totalCents,
    }),
    { comissaoCents: 0, dsrCents: 0, premioCents: 0, ajusteCents: 0, totalGeralCents: 0 },
  );

  return { linhas, totais };
}
