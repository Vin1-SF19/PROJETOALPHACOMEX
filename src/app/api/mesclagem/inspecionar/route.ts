import { NextRequest, NextResponse } from "next/server";

import {
  MESCLAGEM_NO_STORE_HEADERS,
  registrarAuditoriaMesclagemBestEffort,
  verificarAcessoMesclagem,
} from "@/lib/mesclagem/autorizacao";
import {
  ErroMesclagem,
  inspecionarArquivoMesclagem,
} from "@/lib/mesclagem";
import {
  adquirirLimiteMesclagem,
  obterIpMesclagem,
} from "@/lib/mesclagem/rate-limit";
import { validarMultipartMesclagem } from "@/lib/mesclagem/http-guards";
import {
  LIMITE_ARQUIVO_MESCLAGEM_MB,
  LIMITE_MULTIPART_ARQUIVO_MESCLAGEM_BYTES,
} from "@/lib/mesclagem/parsing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonError(error: string, status: number, code: string) {
  return NextResponse.json(
    { success: false, error, code },
    { status, headers: MESCLAGEM_NO_STORE_HEADERS },
  );
}

export async function POST(request: NextRequest) {
  let userId: number | null = null;
  let liberarLimite: (() => void) | null = null;
  try {
    const acesso = await verificarAcessoMesclagem();
    if (!acesso.autorizado) {
      if (acesso.userId !== null) {
        await registrarAuditoriaMesclagemBestEffort(acesso.userId, "MESCLAGEM_INSPETAR_NEGADA", "Inspeção negada; sucesso=false");
      }
      return jsonError(acesso.status === 401 ? "Não autenticado" : "Sem permissão para usar mesclagem", acesso.status, acesso.code);
    }
    userId = acesso.userId;

    validarMultipartMesclagem(
      request,
      LIMITE_MULTIPART_ARQUIVO_MESCLAGEM_BYTES,
      `O arquivo excede o limite de ${LIMITE_ARQUIVO_MESCLAGEM_MB} MB`,
    );
    const limite = adquirirLimiteMesclagem(userId, obterIpMesclagem(request.headers));
    if (!limite.permitido) {
      throw new ErroMesclagem(
        limite.motivo === "RATE_LIMIT" ? "Muitas tentativas de mesclagem; aguarde um minuto" : "Já existe uma mesclagem em processamento",
        limite.motivo,
        limite.motivo === "RATE_LIMIT" ? 429 : 409,
      );
    }
    liberarLimite = limite.liberar;

    const formData = await request.formData();
    const arquivo = formData.get("arquivo");
    if (!(arquivo instanceof File)) throw new ErroMesclagem("Arquivo é obrigatório", "INVALID_FORM_DATA");

    const inspecao = await inspecionarArquivoMesclagem(arquivo);
    await registrarAuditoriaMesclagemBestEffort(
      userId,
      "MESCLAGEM_INSPETAR",
      `Inspeção concluída; abas=${inspecao.abas.length}; sucesso=true`,
    );
    return NextResponse.json({ success: true, data: inspecao }, { status: 200, headers: MESCLAGEM_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof ErroMesclagem) {
      return jsonError(error.message, error.status, error.code);
    }
    if (userId !== null) {
      await registrarAuditoriaMesclagemBestEffort(userId, "MESCLAGEM_INSPETAR_FALHA", "Falha técnica na inspeção; sucesso=false");
    }
    return jsonError("Não foi possível inspecionar a planilha", 500, "INSPECT_FAILED");
  } finally {
    liberarLimite?.();
  }
}
