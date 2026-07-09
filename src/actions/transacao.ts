"use server";

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { transacaoLoteSchema } from "@/lib/validations/extrato";

const MESES_ABREV_PT: Record<string, number> = {
  JAN: 0, FEV: 1, MAR: 2, ABR: 3, MAI: 4, JUN: 5,
  JUL: 6, AGO: 7, SET: 8, OUT: 9, NOV: 10, DEZ: 11,
};

/** Converte string de data (DD/MM/YYYY ou "DD MES YYYY") em Date, ou null se o formato não é reconhecido. */
function parseDataParaDate(texto: string): Date | null {
  const t = texto.trim();

  const isoOuBarra = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (isoOuBarra) {
    const [, d, m, y] = isoOuBarra;
    const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return isNaN(dt.getTime()) ? null : dt;
  }

  const comMesAbrev = t.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]{3})\s+(\d{4})$/);
  if (comMesAbrev) {
    const [, d, mesAbrev, y] = comMesAbrev;
    const mesIdx = MESES_ABREV_PT[mesAbrev.toUpperCase()];
    if (mesIdx !== undefined) {
      const dt = new Date(Date.UTC(Number(y), mesIdx, Number(d)));
      return isNaN(dt.getTime()) ? null : dt;
    }
  }

  return null;
}

function parseMoeda(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (!valor) return 0;
  const apenasNumeros = String(valor).replace(/[^\d.,-]/g, "");
  const valorLimpo = apenasNumeros.replace(/\./g, "").replace(",", ".");
  return parseFloat(valorLimpo) || 0;
}

export async function SalvarTransacoesLote(transacoes: unknown[], bancoId: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const parsed = transacaoLoteSchema.safeParse(transacoes);
    if (!parsed.success) {
      return { success: false, error: "Dados inválidos", details: parsed.error.flatten() };
    }

    const idVinculado = Number(bancoId);
    if (isNaN(idVinculado)) return { success: false, error: "Banco inválido." };

    const dadosParaBanco = parsed.data.map((t) => {
      const dataParseada = parseDataParaDate(t.data ?? "");
      return {
        data: dataParseada,
        dataOriginalTexto: dataParseada ? null : (t.data || null),
        descricao: t.descricao.toUpperCase().trim(),
        valor: parseMoeda(t.valor),
        bancoId: String(t.bancoId ?? ""),
        mesReferencia: String(t.mesReferencia ?? ""),
        origemArquivo: t.origemArquivo ? String(t.origemArquivo) : "EXTRATO",
        BancosVinculadosId: idVinculado,
      };
    });

    await db.transacao.createMany({ data: dadosParaBanco });

    revalidatePath(`/PainelAlpha/ExtratosBancarios`);
    return { success: true, count: dadosParaBanco.length };
  } catch (error) {
    console.error("[SalvarTransacoesLote]", error);
    return { success: false, error: "Erro ao salvar transações." };
  }
}

export async function BuscarTransacoesPorBanco(
  bancoId: number,
  params?: { page?: number; pageSize?: number; busca?: string },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: [], error: "Não autorizado" };

    const idNumerico = Math.floor(Number(bancoId));
    if (isNaN(idNumerico)) return { success: false, data: [], error: "Banco inválido." };

    const page = params?.page && params.page > 0 ? params.page : 1;
    const pageSize = params?.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 25;
    const busca = params?.busca?.trim();

    const where = {
      BancosVinculadosId: idNumerico,
      ...(busca ? { descricao: { contains: busca.toUpperCase() } } : {}),
    };

    const [transacoes, total] = await Promise.all([
      db.transacao.findMany({
        where,
        // nulls: "last" — transações com data incerta (dataOriginalTexto) vão
        // para o fim da lista, não poluem a primeira página que o analista vê.
        orderBy: { data: { sort: "asc", nulls: "last" } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.transacao.count({ where }),
    ]);

    return {
      success: true,
      data: transacoes,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  } catch (error) {
    console.error("[BuscarTransacoesPorBanco]", error);
    return { success: false, data: [], error: "Erro ao buscar transações." };
  }
}

export async function DeletarTransacoesLote(ids: string[]) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: false, error: "Nenhum id informado." };
    }

    await db.transacao.deleteMany({ where: { id: { in: ids } } });
    revalidatePath("/PainelAlpha/ExtratosBancarios");
    return { success: true };
  } catch (error) {
    console.error("[DeletarTransacoesLote]", error);
    return { success: false, error: "Erro ao excluir." };
  }
}
