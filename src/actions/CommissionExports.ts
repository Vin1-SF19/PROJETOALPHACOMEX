"use server";

import { auth } from "../../auth";
import { createHash, randomUUID } from "crypto";
import { z } from "zod";
import db from "@/lib/prisma";
import { construirPreviewEspelho } from "@/lib/commissions/export/preview-builder";
import { gerarXlsxEspelho } from "@/lib/commissions/export/xlsx-generator";
import { gerarPdfEspelho } from "@/lib/commissions/export/pdf-generator";
import { verificarAcessoCategoria, type CategoriaPermissao } from "@/lib/commissions/permissions";

async function exigirAcesso(categoria: CategoriaPermissao) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Não autenticado" };

  const role = (session.user as { role?: string }).role ?? "";
  const resultado = await verificarAcessoCategoria(Number(session.user.id), role, categoria);
  if (!resultado.ok) return { ok: false as const, error: resultado.error ?? "Sem permissão" };

  return { ok: true as const, userId: resultado.userId! };
}

const filtrosSchema = z.object({
  tipo: z.enum(["comissoes", "premios"]),
  colaboradorId: z.number().int().positive(),
  periodoInicio: z.coerce.date(),
  periodoFim: z.coerce.date(),
});

export async function PreviewExportacao(input: z.infer<typeof filtrosSchema>) {
  const acesso = await exigirAcesso("EXPORTAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = filtrosSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const preview = await construirPreviewEspelho(parsed.data);
    return { success: true, data: preview } as const;
  } catch (error) {
    console.error("[PreviewExportacao]", error);
    return { success: false, error: "Erro interno ao montar prévia" } as const;
  }
}

const confirmarExportacaoSchema = filtrosSchema.extend({
  formato: z.enum(["PDF", "XLSX", "AMBOS"]),
  /**
   * Ajustes manuais feitos na prévia (seção do prompt: "poder pré-visualizar e fazer
   * ajustes manuais antes de exportar") — aplicados só no arquivo final, NUNCA persistidos
   * no CommissionEntry real. Para corrigir um lançamento de forma permanente e auditada,
   * o usuário deve usar "Ajuste Manual" no modal de detalhes (CriarAjusteManual).
   */
  ajustes: z.array(z.object({ entryId: z.string().min(1), valorA: z.number().int(), valorB: z.number().int() })).optional(),
});

export interface ArquivoGerado {
  formato: "PDF" | "XLSX";
  nomeArquivo: string;
  base64: string;
}

export async function ConfirmarExportacao(input: z.infer<typeof confirmarExportacaoSchema>) {
  const acesso = await exigirAcesso("EXPORTAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = confirmarExportacaoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { tipo, colaboradorId, periodoInicio, periodoFim, formato, ajustes } = parsed.data;

  try {
    const preview = await construirPreviewEspelho({ tipo, colaboradorId, periodoInicio, periodoFim });

    if (ajustes && ajustes.length > 0) {
      const ajustePorEntry = new Map(ajustes.map((a) => [a.entryId, a]));

      if (tipo === "comissoes") {
        preview.linhasComissao = preview.linhasComissao.map((linha) => {
          const ajuste = ajustePorEntry.get(linha.entryId);
          if (!ajuste) return linha;
          return { ...linha, comissaoCents: ajuste.valorA, dsrCents: ajuste.valorB, totalCents: ajuste.valorA + ajuste.valorB };
        });
      } else {
        preview.linhasPremio = preview.linhasPremio.map((linha) => {
          const ajuste = ajustePorEntry.get(linha.entryId);
          if (!ajuste) return linha;
          return { ...linha, exitoCents: ajuste.valorA, primeiraCents: ajuste.valorB, totalCents: ajuste.valorA + ajuste.valorB };
        });
      }

      const linhas = tipo === "comissoes" ? preview.linhasComissao : preview.linhasPremio;
      preview.totais = {
        comissaoCents: tipo === "comissoes" ? preview.linhasComissao.reduce((s, l) => s + l.comissaoCents, 0) : 0,
        dsrCents: tipo === "comissoes" ? preview.linhasComissao.reduce((s, l) => s + l.dsrCents, 0) : 0,
        exitoCents: tipo === "premios" ? preview.linhasPremio.reduce((s, l) => s + l.exitoCents, 0) : 0,
        primeiraCents: tipo === "premios" ? preview.linhasPremio.reduce((s, l) => s + l.primeiraCents, 0) : 0,
        totalGeralCents: linhas.reduce((s, l) => s + l.totalCents, 0),
      };
    }

    const codigoVerificacao = randomUUID();
    const arquivos: ArquivoGerado[] = [];
    let hashCombinado = "";
    const nomeColaboradorArquivo = preview.colaboradorNome.replace(/[^a-zA-Z0-9]/g, "-");

    if (formato === "XLSX" || formato === "AMBOS") {
      const bufferXlsx = await gerarXlsxEspelho({ preview, codigoVerificacao });
      const hashXlsx = createHash("sha256").update(bufferXlsx).digest("hex");
      hashCombinado += hashXlsx;
      arquivos.push({
        formato: "XLSX",
        nomeArquivo: `espelho-${tipo}-${nomeColaboradorArquivo}-${codigoVerificacao.slice(0, 8)}.xlsx`,
        base64: bufferXlsx.toString("base64"),
      });
    }

    if (formato === "PDF" || formato === "AMBOS") {
      const bufferPdf = await gerarPdfEspelho({ preview, codigoVerificacao });
      const hashPdf = createHash("sha256").update(bufferPdf).digest("hex");
      hashCombinado += hashPdf;
      arquivos.push({
        formato: "PDF",
        nomeArquivo: `espelho-${tipo}-${nomeColaboradorArquivo}-${codigoVerificacao.slice(0, 8)}.pdf`,
        base64: bufferPdf.toString("base64"),
      });
    }

    const hashFinal = createHash("sha256").update(hashCombinado).digest("hex");

    const exportDocument = await db.exportDocument.create({
      data: {
        tipo,
        colaboradorId,
        periodoInicio,
        periodoFim,
        formato,
        codigoVerificacao,
        hash: hashFinal,
        geradoPorId: acesso.userId,
      },
    });

    return {
      success: true,
      data: { exportDocumentId: exportDocument.id, codigoVerificacao, arquivos },
    } as const;
  } catch (error) {
    console.error("[ConfirmarExportacao]", error);
    return { success: false, error: "Erro interno ao gerar exportação" } as const;
  }
}

/**
 * Histórico de espelhos já gerados — aba "Espelhos" das Configurações, somente leitura.
 * NOTA: só o METADADO da exportação é persistido (tipo/período/quem gerou/hash de
 * verificação) — o arquivo binário (PDF/XLSX) nunca é salvo, só devolvido uma vez no
 * momento da geração. Por isso não há "re-download": o usuário precisa gerar de novo.
 */
export async function ListarExportDocuments(input?: { page?: number; pageSize?: number }) {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const page = input?.page ?? 1;
  const pageSize = Math.min(input?.pageSize ?? 25, 100);

  try {
    const [documentos, total] = await Promise.all([
      db.exportDocument.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.exportDocument.count(),
    ]);

    const geradorIds = [...new Set(documentos.map((d) => d.geradoPorId))];
    const geradores = geradorIds.length > 0
      ? await db.usuarios.findMany({ where: { id: { in: geradorIds } }, select: { id: true, nome: true } })
      : [];
    const nomePorId = new Map(geradores.map((g) => [g.id, g.nome]));

    const data = documentos.map((d) => ({ ...d, geradoPorNome: nomePorId.get(d.geradoPorId) ?? null }));

    return {
      success: true,
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    } as const;
  } catch (error) {
    console.error("[ListarExportDocuments]", error);
    return { success: false, error: "Erro interno ao listar espelhos gerados" } as const;
  }
}
