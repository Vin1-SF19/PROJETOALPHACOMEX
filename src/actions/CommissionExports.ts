"use server";

import { auth } from "../../auth";
import { createHash, randomUUID } from "crypto";
import { z } from "zod";
import db from "@/lib/prisma";
import { construirPreviewEspelho } from "@/lib/commissions/export/preview-builder";
import { gerarXlsxEspelho } from "@/lib/commissions/export/xlsx-generator";
import { gerarPdfEspelho } from "@/lib/commissions/export/pdf-generator";

/**
 * TODO(Fase 14 — Configurações/RBAC granular): mesma verificação de role temporária
 * documentada em `src/actions/CommissionSync.ts`.
 */
const ROLES_TEMPORARIAMENTE_PERMITIDOS = ["Admin", "CEO", "FINANCEIRO"];

async function exigirAcesso() {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Não autenticado" };

  const role = (session.user as { role?: string }).role ?? "";
  if (!ROLES_TEMPORARIAMENTE_PERMITIDOS.includes(role)) {
    return { ok: false as const, error: "Sem permissão" };
  }

  return { ok: true as const, userId: Number(session.user.id) };
}

const filtrosSchema = z.object({
  tipo: z.enum(["comissoes", "premios", "comissao_dsr", "todos"]),
  colaboradorId: z.number().int().positive().optional(),
  periodoInicio: z.coerce.date(),
  periodoFim: z.coerce.date(),
  status: z.string().optional(),
});

export async function PreviewExportacao(input: z.infer<typeof filtrosSchema>) {
  const acesso = await exigirAcesso();
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
});

export interface ArquivoGerado {
  formato: "PDF" | "XLSX";
  nomeArquivo: string;
  base64: string;
}

export async function ConfirmarExportacao(input: z.infer<typeof confirmarExportacaoSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = confirmarExportacaoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { tipo, colaboradorId, periodoInicio, periodoFim, status, formato } = parsed.data;

  try {
    const preview = await construirPreviewEspelho({ tipo, colaboradorId, periodoInicio, periodoFim, status });

    const colaboradorNome = colaboradorId
      ? (await db.usuarios.findUnique({ where: { id: colaboradorId }, select: { nome: true } }))?.nome
      : undefined;

    const codigoVerificacao = randomUUID();
    const arquivos: ArquivoGerado[] = [];
    let hashCombinado = "";

    if (formato === "XLSX" || formato === "AMBOS") {
      const bufferXlsx = await gerarXlsxEspelho({
        preview,
        tipo,
        periodoInicio,
        periodoFim,
        colaboradorNome,
        codigoVerificacao,
      });
      const hashXlsx = createHash("sha256").update(bufferXlsx).digest("hex");
      hashCombinado += hashXlsx;
      arquivos.push({
        formato: "XLSX",
        nomeArquivo: `espelho-comissoes-${codigoVerificacao}.xlsx`,
        base64: bufferXlsx.toString("base64"),
      });
    }

    if (formato === "PDF" || formato === "AMBOS") {
      const hashParaPdf = createHash("sha256").update(codigoVerificacao).digest("hex").slice(0, 16);
      const bufferPdf = await gerarPdfEspelho({
        preview,
        tipo,
        periodoInicio,
        periodoFim,
        colaboradorNome,
        codigoVerificacao,
        hash: hashParaPdf,
      });
      const hashPdf = createHash("sha256").update(bufferPdf).digest("hex");
      hashCombinado += hashPdf;
      arquivos.push({
        formato: "PDF",
        nomeArquivo: `espelho-comissoes-${codigoVerificacao}.pdf`,
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

    if (preview.linhas.length > 0) {
      await db.exportDocumentItem.createMany({
        data: preview.linhas.map((linha) => ({
          documentId: exportDocument.id,
          entryId: linha.entryId,
          linhaJson: JSON.stringify(linha),
        })),
      });
    }

    return {
      success: true,
      data: { exportDocumentId: exportDocument.id, codigoVerificacao, arquivos },
    } as const;
  } catch (error) {
    console.error("[ConfirmarExportacao]", error);
    return { success: false, error: "Erro interno ao gerar exportação" } as const;
  }
}
