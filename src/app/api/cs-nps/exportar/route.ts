import { NextResponse } from "next/server";

import {
  CS_NPS_NO_STORE_HEADERS,
  registrarAuditoriaCsNpsBestEffort,
  verificarAcessoAdministrativoCsNps,
} from "@/lib/cs-nps/autorizacao";
import { gerarExportacaoCompletaCsNps } from "@/lib/cs-nps/exportar-dados";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonError(error: string, status: number, code: string) {
  return NextResponse.json(
    { success: false, error, code },
    { status, headers: CS_NPS_NO_STORE_HEADERS },
  );
}

export async function GET() {
  let authenticatedUserId: number | null = null;

  try {
    const acesso = await verificarAcessoAdministrativoCsNps();
    if (!acesso.autorizado) {
      if (acesso.userId !== null) {
        await registrarAuditoriaCsNpsBestEffort(
          acesso.userId,
          "EXPORTAR_CS_NPS_NEGADO",
          "Exportação negada por acesso administrativo; sucesso=false",
        );
      }
      if (acesso.status === 401) {
        return jsonError("Não autenticado", 401, acesso.code);
      }
      return jsonError(
        "Sem permissão para exportar dados do CS & NPS",
        403,
        acesso.code,
      );
    }
    authenticatedUserId = acesso.userId;

    const exportacao = await gerarExportacaoCompletaCsNps();
    if (!exportacao) {
      return jsonError("Não há dados de clientes para exportar", 404, "EMPTY_EXPORT");
    }

    await registrarAuditoriaCsNpsBestEffort(
      acesso.userId,
      "EXPORTAR_CS_NPS_COMPLETO",
      `Exportação concluída; clientes=${exportacao.totalClientes}; sucesso=true`,
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `cs-nps-exportacao-completa-${timestamp}.xlsx`;

    return new Response(new Uint8Array(exportacao.buffer), {
      status: 200,
      headers: {
        ...CS_NPS_NO_STORE_HEADERS,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch {
    if (authenticatedUserId !== null) {
      await registrarAuditoriaCsNpsBestEffort(
        authenticatedUserId,
        "EXPORTAR_CS_NPS_FALHA",
        "Falha técnica na exportação; sucesso=false",
      );
    }
    return jsonError("Não foi possível gerar a exportação", 500, "EXPORT_FAILED");
  }
}
