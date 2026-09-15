import { NextResponse } from "next/server";

import {
  MESCLAGEM_NO_STORE_HEADERS,
  registrarAuditoriaMesclagemBestEffort,
  verificarAcessoMesclagem,
} from "@/lib/mesclagem/autorizacao";
import { ErroMesclagem, gerarTemplateMesclagem } from "@/lib/mesclagem";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function jsonError(error: string, status: number, code: string) {
  return NextResponse.json(
    { success: false, error, code },
    { status, headers: MESCLAGEM_NO_STORE_HEADERS },
  );
}

export async function GET() {
  let userId: number | null = null;
  try {
    const acesso = await verificarAcessoMesclagem();
    if (!acesso.autorizado) {
      if (acesso.userId !== null) {
        await registrarAuditoriaMesclagemBestEffort(acesso.userId, "MESCLAGEM_TEMPLATE_NEGADO", "Download do template negado; sucesso=false");
      }
      return jsonError(acesso.status === 401 ? "Não autenticado" : "Sem permissão para usar mesclagem", acesso.status, acesso.code);
    }
    userId = acesso.userId;

    const buffer = await gerarTemplateMesclagem();
    await registrarAuditoriaMesclagemBestEffort(userId, "MESCLAGEM_TEMPLATE", "Template baixado; sucesso=true");

    const timestamp = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        ...MESCLAGEM_NO_STORE_HEADERS,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="template-mesclagem-${timestamp}.xlsx"`,
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (error) {
    if (error instanceof ErroMesclagem) {
      return jsonError(error.message, error.status, error.code);
    }
    if (userId !== null) {
      await registrarAuditoriaMesclagemBestEffort(userId, "MESCLAGEM_TEMPLATE_FALHA", "Falha técnica ao baixar template; sucesso=false");
    }
    return jsonError("Não foi possível baixar o template", 500, "TEMPLATE_FAILED");
  }
}
