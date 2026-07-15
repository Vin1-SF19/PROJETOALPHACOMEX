import { NextRequest, NextResponse } from "next/server";

import {
  CS_NPS_NO_STORE_HEADERS,
  registrarAuditoriaCsNpsBestEffort,
  verificarAcessoAdministrativoCsNps,
} from "@/lib/cs-nps/autorizacao";
import {
  ErroImportacao,
  gerarModeloImportacao,
  validarTiposImportacao,
} from "@/lib/cs-nps/importar-dados";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function jsonError(error: string, status: number, code: string) {
  return NextResponse.json(
    { success: false, error, code },
    { status, headers: CS_NPS_NO_STORE_HEADERS },
  );
}

export async function GET(request: NextRequest) {
  let userId: number | null = null;
  try {
    const acesso = await verificarAcessoAdministrativoCsNps();
    if (!acesso.autorizado) {
      if (acesso.userId !== null) {
        await registrarAuditoriaCsNpsBestEffort(
          acesso.userId,
          "IMPORTAR_CS_NPS_MODELO_NEGADO",
          "Download do modelo negado; sucesso=false",
        );
      }
      return jsonError(
        acesso.status === 401 ? "Não autenticado" : "Sem permissão para importar dados do CS & NPS",
        acesso.status,
        acesso.code,
      );
    }
    userId = acesso.userId;

    const tipos = validarTiposImportacao(
      (request.nextUrl.searchParams.get("tipos") ?? "")
        .split(",")
        .map((tipo) => tipo.trim())
        .filter(Boolean),
    );
    const buffer = await gerarModeloImportacao(tipos);
    await registrarAuditoriaCsNpsBestEffort(
      userId,
      "IMPORTAR_CS_NPS_MODELO",
      `Modelo gerado; tipos=${tipos.join(",")}; sucesso=true`,
    );

    const timestamp = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        ...CS_NPS_NO_STORE_HEADERS,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="cs-nps-modelo-importacao-${timestamp}.xlsx"`,
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (error) {
    if (error instanceof ErroImportacao) {
      return jsonError(error.message, error.status, error.code);
    }
    if (userId !== null) {
      await registrarAuditoriaCsNpsBestEffort(
        userId,
        "IMPORTAR_CS_NPS_MODELO_FALHA",
        "Falha técnica ao gerar modelo; sucesso=false",
      );
    }
    return jsonError("Não foi possível gerar o modelo", 500, "MODEL_FAILED");
  }
}
