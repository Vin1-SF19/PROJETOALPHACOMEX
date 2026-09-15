import { NextRequest, NextResponse } from "next/server";

import {
  MESCLAGEM_NO_STORE_HEADERS,
  registrarAuditoriaMesclagemBestEffort,
  verificarAcessoMesclagem,
} from "@/lib/mesclagem/autorizacao";
import {
  ErroMesclagem,
  criarPreviaMesclagem,
} from "@/lib/mesclagem";
import {
  adquirirLimiteMesclagem,
  obterIpMesclagem,
} from "@/lib/mesclagem/rate-limit";
import { extrairParametrosMultipartMesclagem } from "@/lib/mesclagem/schemas";
import { validarMultipartMesclagem } from "@/lib/mesclagem/http-guards";
import {
  LIMITE_ARQUIVO_MESCLAGEM_MB,
  LIMITE_MULTIPART_DUPLO_MESCLAGEM_BYTES,
} from "@/lib/mesclagem/parsing";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

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
        await registrarAuditoriaMesclagemBestEffort(acesso.userId, "MESCLAGEM_PREVIA_NEGADA", "Prévia negada; sucesso=false");
      }
      return jsonError(acesso.status === 401 ? "Não autenticado" : "Sem permissão para usar mesclagem", acesso.status, acesso.code);
    }
    userId = acesso.userId;

    validarMultipartMesclagem(
      request,
      LIMITE_MULTIPART_DUPLO_MESCLAGEM_BYTES,
      `Cada arquivo deve ter no máximo ${LIMITE_ARQUIVO_MESCLAGEM_MB} MB`,
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
    const parametros = extrairParametrosMultipartMesclagem(formData);

    const previa = await criarPreviaMesclagem(parametros);

    await registrarAuditoriaMesclagemBestEffort(
      userId,
      "MESCLAGEM_PREVIA",
      `Prévia concluída; totalLinhas=${previa.resultado.resumo.totalLinhas}; comMatch=${previa.resultado.resumo.comMatch}; sucesso=true`,
    );
    return NextResponse.json({ success: true, data: previa }, { status: 200, headers: MESCLAGEM_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof ErroMesclagem) {
      return jsonError(error.message, error.status, error.code);
    }
    if (userId !== null) {
      await registrarAuditoriaMesclagemBestEffort(userId, "MESCLAGEM_PREVIA_FALHA", "Falha técnica na prévia; sucesso=false");
    }
    return jsonError("Não foi possível preparar a prévia", 500, "PREVIEW_FAILED");
  } finally {
    liberarLimite?.();
  }
}
