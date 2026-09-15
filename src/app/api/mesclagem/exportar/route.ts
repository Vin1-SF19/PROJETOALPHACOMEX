import { NextRequest, NextResponse } from "next/server";

import {
  MESCLAGEM_NO_STORE_HEADERS, registrarAuditoriaMesclagemBestEffort, verificarAcessoMesclagem,
} from "@/lib/mesclagem/autorizacao";
import {
  ErroMesclagem, gerarXlsxMesclagem, processarMesclagem,
} from "@/lib/mesclagem";
import { registrarHistoricoMesclagem } from "@/lib/mesclagem/historico";
import { adquirirLimiteMesclagem, obterIpMesclagem } from "@/lib/mesclagem/rate-limit";
import { extrairParametrosMultipartMesclagem } from "@/lib/mesclagem/schemas";
import { validarMultipartMesclagem } from "@/lib/mesclagem/http-guards";
import {
  LIMITE_ARQUIVO_MESCLAGEM_MB,
  LIMITE_MULTIPART_DUPLO_MESCLAGEM_BYTES,
} from "@/lib/mesclagem/parsing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function jsonError(error: string, status: number, code: string) {
  return NextResponse.json({ success: false, error, code }, { status, headers: MESCLAGEM_NO_STORE_HEADERS });
}

function nomeResultado(): string {
  return `mesclagem-planilhas-${new Date().toISOString().slice(0, 10)}.xlsx`;
}

function respostaXlsx(buffer: Buffer, historicoId: string, nome: string): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      ...MESCLAGEM_NO_STORE_HEADERS,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "X-Mesclagem-Historico-Id": historicoId,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Use POST para gerar e registrar a exportação", code: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: { ...MESCLAGEM_NO_STORE_HEADERS, Allow: "POST" } },
  );
}

/** Reprocessa o payload atual, persiste os três artefatos privados e devolve o resultado. */
export async function POST(request: NextRequest) {
  let userId: number | null = null;
  let liberarLimite: (() => void) | null = null;
  try {
    const acesso = await verificarAcessoMesclagem();
    if (!acesso.autorizado) {
      if (acesso.userId !== null) await registrarAuditoriaMesclagemBestEffort(acesso.userId, "MESCLAGEM_EXPORTAR_NEGADA", "Exportação negada; sucesso=false");
      return jsonError(acesso.status === 401 ? "Não autenticado" : "Sem permissão para usar mesclagem", acesso.status, acesso.code);
    }
    userId = acesso.userId;
    validarMultipartMesclagem(
      request,
      LIMITE_MULTIPART_DUPLO_MESCLAGEM_BYTES,
      `Cada arquivo deve ter no máximo ${LIMITE_ARQUIVO_MESCLAGEM_MB} MB`,
    );
    const limite = adquirirLimiteMesclagem(userId, obterIpMesclagem(request.headers));
    if (!limite.permitido) throw new ErroMesclagem(
      limite.motivo === "RATE_LIMIT" ? "Muitas tentativas de mesclagem; aguarde um minuto" : "Já existe uma mesclagem em processamento",
      limite.motivo, limite.motivo === "RATE_LIMIT" ? 429 : 409,
    );
    liberarLimite = limite.liberar;
    const formData = await request.formData();
    const parametros = extrairParametrosMultipartMesclagem(formData, true);
    const resultado = await processarMesclagem(parametros);
    const buffer = await gerarXlsxMesclagem({ linhas: resultado.resultado.linhas, mapeamento: resultado.mapeamento });
    const nome = nomeResultado();
    const historico = await registrarHistoricoMesclagem({
      userId,
      principal: parametros.principal,
      complementar: parametros.complementar,
      resultado: buffer,
      resumo: resultado.resultado.resumo,
      resultadoNome: nome,
    });
    await registrarAuditoriaMesclagemBestEffort(userId, "MESCLAGEM_EXPORTAR", `Exportação persistida; historicoId=${historico.id}; totalLinhas=${resultado.resultado.resumo.totalLinhas}; sucesso=true`);
    return respostaXlsx(buffer, historico.id, nome);
  } catch (error) {
    if (error instanceof ErroMesclagem) return jsonError(error.message, error.status, error.code);
    if (userId !== null) await registrarAuditoriaMesclagemBestEffort(userId, "MESCLAGEM_EXPORTAR_FALHA", "Falha técnica na exportação stateless; sucesso=false");
    return jsonError("Não foi possível exportar a planilha", 500, "EXPORT_FAILED");
  } finally {
    liberarLimite?.();
  }
}
