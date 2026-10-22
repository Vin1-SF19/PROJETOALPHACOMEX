import {
  obterAtorChecklist,
  exigirEmpresaChecklist,
} from "@/lib/checklist/acesso";
import db from "@/lib/prisma";
import { abrirDocumento } from "@/lib/checklist/documentos";
import { resultado, fail } from "@/lib/checklist/result";
import { resultHttp } from "@/lib/checklist/http";
import { nomeArquivoSeguro } from "@/lib/checklist/storage";
export const runtime = "nodejs";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ documentoId: string }> },
) {
  const result = await resultado(async () => {
    const ator = await obterAtorChecklist();
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(10000)]);
    const d = await abrirDocumento(ator, (await params).documentoId, signal);
    let bytes = 0,
      lastCheck = 0;
    const body = d.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        async transform(chunk, controller) {
          if (signal.aborted) throw new Error("ABORTED");
          bytes += chunk.length;
          if (bytes > 25 * 1024 * 1024)
            fail("LIMIT_EXCEEDED", "Arquivo excede o limite.");
          if (Date.now() - lastCheck > 5000) {
            await exigirEmpresaChecklist(db, ator, d.empresaId);
            lastCheck = Date.now();
          }
          controller.enqueue(chunk);
        },
      }),
      { signal },
    );
    return { body, nome: d.nome, mime: d.mime };
  });
  if (!result.ok) return resultHttp(result);
  return new Response(result.data.body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": result.data.mime,
      "Content-Disposition":
        "attachment; filename*=UTF-8''" +
        encodeURIComponent(nomeArquivoSeguro(result.data.nome)),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
