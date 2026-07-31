import db from "@/lib/prisma";

/**
 * Monta as linhas do espelho de comissões/prêmios NO FORMATO REAL usado pela empresa
 * (validado contra PDFs de referência: "ESPELHO DE COMISSÕES" e "ESPELHO DE PRÊMIOS",
 * 2026-07-30) — SEM PERSISTIR NADA. Sempre 1 espelho = 1 colaborador (nunca mistura
 * vários colaboradores numa mesma exportação, diferente do formato técnico anterior).
 *
 * Comissão: colunas Data | Empresa | Comissão | DSR | Total.
 * Prêmio: colunas Data | Empresa | Êxito | De Primeira | Total.
 */

export type TipoEspelho = "comissoes" | "premios";

export interface FiltrosPreview {
  tipo: TipoEspelho;
  colaboradorId: number;
  periodoInicio: Date;
  periodoFim: Date;
}

export interface LinhaEspelhoComissao {
  entryId: string;
  data: Date;
  empresaNome: string;
  comissaoCents: number;
  dsrCents: number;
  totalCents: number;
}

export interface LinhaEspelhoPremio {
  entryId: string;
  data: Date;
  empresaNome: string;
  exitoCents: number;
  primeiraCents: number;
  totalCents: number;
}

export interface PreviewResult {
  tipo: TipoEspelho;
  colaboradorId: number;
  colaboradorNome: string;
  cargoNome: string | null;
  periodoInicio: Date;
  periodoFim: Date;
  linhasComissao: LinhaEspelhoComissao[];
  linhasPremio: LinhaEspelhoPremio[];
  totais: {
    comissaoCents: number;
    dsrCents: number;
    exitoCents: number;
    primeiraCents: number;
    totalGeralCents: number;
  };
}

export async function construirPreviewEspelho(filtros: FiltrosPreview): Promise<PreviewResult> {
  const usuario = await db.usuarios.findUnique({
    where: { id: filtros.colaboradorId },
    select: { nome: true, cargo: true },
  });

  const fimExclusivo = new Date(filtros.periodoFim);
  fimExclusivo.setUTCHours(0, 0, 0, 0);
  fimExclusivo.setUTCDate(fimExclusivo.getUTCDate() + 1);
  const inicioInclusivo = new Date(filtros.periodoInicio);
  inicioInclusivo.setUTCHours(0, 0, 0, 0);

  const entries = await db.commissionEntry.findMany({
    where: {
      collaboratorId: filtros.colaboradorId,
      event: {
        eventDate: { gte: inicioInclusivo, lt: fimExclusivo },
      },
    },
    include: { componentes: true, event: true },
    orderBy: { event: { eventDate: "asc" } },
  });

  const linhasComissao: LinhaEspelhoComissao[] = [];
  const linhasPremio: LinhaEspelhoPremio[] = [];

  for (const entry of entries) {
    const comissaoCents = entry.componentes.filter((c) => c.tipo === "COMISSAO").reduce((s, c) => s + c.valorCents, 0);
    const dsrCents = entry.componentes.filter((c) => c.tipo === "DSR").reduce((s, c) => s + c.valorCents, 0);
    const premioCents = entry.componentes.filter((c) => c.tipo === "PREMIO").reduce((s, c) => s + c.valorCents, 0);

    const empresaNome = entry.event?.razaoSocial ?? "";
    const data = entry.event?.eventDate ?? entry.createdAt;

    if (filtros.tipo === "comissoes" && (comissaoCents > 0 || dsrCents > 0)) {
      linhasComissao.push({
        entryId: entry.id,
        data,
        empresaNome,
        comissaoCents,
        dsrCents,
        totalCents: comissaoCents + dsrCents,
      });
    }

    if (filtros.tipo === "premios" && premioCents > 0) {
      // Prêmio de "primeira tentativa" é um componente PREMIO específico da regra
      // "*-primeira-tentativa" (ver seed-rules.ts) — identificado pela memória de cálculo,
      // nunca por um valor fixo hardcoded aqui (evita quebrar se o valor da regra mudar).
      let exitoCents = 0;
      let primeiraCents = 0;
      for (const componente of entry.componentes) {
        if (componente.tipo !== "PREMIO") continue;
        try {
          const memoria = JSON.parse(componente.memoriaCalculoJson) as { ruleName?: string };
          if (memoria.ruleName?.toLowerCase().includes("primeira tentativa")) {
            primeiraCents += componente.valorCents;
          } else {
            exitoCents += componente.valorCents;
          }
        } catch {
          exitoCents += componente.valorCents;
        }
      }

      linhasPremio.push({
        entryId: entry.id,
        data,
        empresaNome,
        exitoCents,
        primeiraCents,
        totalCents: exitoCents + primeiraCents,
      });
    }
  }

  const totais = {
    comissaoCents: linhasComissao.reduce((s, l) => s + l.comissaoCents, 0),
    dsrCents: linhasComissao.reduce((s, l) => s + l.dsrCents, 0),
    exitoCents: linhasPremio.reduce((s, l) => s + l.exitoCents, 0),
    primeiraCents: linhasPremio.reduce((s, l) => s + l.primeiraCents, 0),
    totalGeralCents:
      linhasComissao.reduce((s, l) => s + l.totalCents, 0) + linhasPremio.reduce((s, l) => s + l.totalCents, 0),
  };

  return {
    tipo: filtros.tipo,
    colaboradorId: filtros.colaboradorId,
    colaboradorNome: usuario?.nome ?? "Colaborador não encontrado",
    cargoNome: usuario?.cargo ?? null,
    periodoInicio: filtros.periodoInicio,
    periodoFim: filtros.periodoFim,
    linhasComissao,
    linhasPremio,
    totais,
  };
}
