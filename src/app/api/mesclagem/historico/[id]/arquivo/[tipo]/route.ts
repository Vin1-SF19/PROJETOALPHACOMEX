import { NextResponse } from "next/server";

import { MESCLAGEM_NO_STORE_HEADERS, verificarAcessoMesclagem } from "@/lib/mesclagem/autorizacao";
import {
  obterArquivoHistoricoMesclagem,
  type TipoArquivoHistoricoMesclagem,
} from "@/lib/mesclagem/historico";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const TIPOS = new Set<TipoArquivoHistoricoMesclagem>(["principal", "complementar", "resultado"]);

function nomeAscii(nome: string): string {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 180) || "planilha.xlsx";
}

function streamWeb(source: AsyncIterable<Uint8Array>): ReadableStream<Uint8Array> {
  const iterator = source[Symbol.asyncIterator]();
  return new ReadableStream({
    async pull(controller) {
      const proximo = await iterator.next();
      if (proximo.done) controller.close(); else controller.enqueue(proximo.value);
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; tipo: string }> },
) {
  const acesso = await verificarAcessoMesclagem();
  if (!acesso.autorizado) {
    return NextResponse.json(
      { success: false, error: acesso.status === 401 ? "Não autenticado" : "Sem permissão", code: acesso.code },
      { status: acesso.status, headers: MESCLAGEM_NO_STORE_HEADERS },
    );
  }
  const { id, tipo: tipoBruto } = await params;
  if (!TIPOS.has(tipoBruto as TipoArquivoHistoricoMesclagem)) {
    return NextResponse.json({ success: false, error: "Tipo de arquivo inválido", code: "INVALID_FILE_KIND" }, { status: 400, headers: MESCLAGEM_NO_STORE_HEADERS });
  }
  const arquivo = await obterArquivoHistoricoMesclagem(acesso.userId, id, tipoBruto as TipoArquivoHistoricoMesclagem);
  if (!arquivo) {
    return NextResponse.json({ success: false, error: "Mesclagem não encontrada", code: "NOT_FOUND" }, { status: 404, headers: MESCLAGEM_NO_STORE_HEADERS });
  }
  const ascii = nomeAscii(arquivo.nome);
  return new Response(streamWeb(arquivo.conteudo), {
    headers: {
      ...MESCLAGEM_NO_STORE_HEADERS,
      "Content-Type": "application/octet-stream",
      "Content-Length": String(arquivo.tamanho),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
