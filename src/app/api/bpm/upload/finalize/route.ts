import { get, head } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/prisma";
import { auth } from "../../../../../../auth";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { conteudoUploadDiretoCompativel } from "@/lib/bpm/upload-conteudo";
import { criarReciboUploadAnexoBpm, criarReferenciaAnexoBpm, obterTokenBlobPrivadoAnexoBpm, pathnameUploadDiretoAnexoBpmValido, recibosAnexoBpmConfigurados } from "@/lib/bpm/anexos-storage";
import { ACAO_UPLOAD_ANEXO_SEM_REGISTRO } from "@/lib/bpm/anexos-lifecycle";
import { nomeSeguroUploadAnexo, obterTipoUploadAnexo, validarUploadAnexo } from "@/lib/validations/bpm";

export const dynamic = "force-dynamic";

const finalizarSchema = z.object({
  cardId: z.string().cuid(),
  pathname: z.string().min(1).max(1024),
  originalName: z.string().trim().min(1).max(255),
  mimeType: z.string().max(150),
  size: z.number().int().positive(),
});

/** Confere o arquivo já gravado no store privado antes de assinar o recibo. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  const token = obterTokenBlobPrivadoAnexoBpm();
  if (!token || !recibosAnexoBpmConfigurados()) {
    return NextResponse.json({ success: false, error: "Armazenamento privado indisponível" }, { status: 503 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: "Dados inválidos" }, { status: 400 });
  }
  const parsed = finalizarSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: "Dados inválidos" }, { status: 400 });
  const { cardId, pathname, originalName, mimeType, size } = parsed.data;
  const tipo = obterTipoUploadAnexo({ name: originalName, type: mimeType });
  const erroValidacao = validarUploadAnexo({ name: originalName, type: mimeType, size });
  if (!pathnameUploadDiretoAnexoBpmValido(pathname, cardId) || !tipo || erroValidacao
    || !pathname.endsWith(`-${nomeSeguroUploadAnexo(originalName)}`)) {
    return NextResponse.json({ success: false, error: erroValidacao ?? "Arquivo ou caminho inválido" }, { status: 400 });
  }
  const userId = Number(session.user.id);
  try { await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "enviarArquivo"); }
  catch { return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 403 }); }
  const referencia = criarReferenciaAnexoBpm(pathname);
  // O callback assinado do Blob pode chegar pouco depois da resposta do
  // upload ao navegador. Aguardar brevemente evita uma falha espúria.
  let autorizado = null;
  for (let tentativa = 0; tentativa < 49; tentativa += 1) {
    autorizado = await db.bpmCardHistorico.findFirst({
      where: { cardId, usuarioId: userId, acao: ACAO_UPLOAD_ANEXO_SEM_REGISTRO, valorAnteriorJson: referencia },
      select: { id: true },
    });
    if (autorizado) break;
    if (tentativa < 48) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!autorizado) return NextResponse.json({ success: false, error: "O upload ainda está sendo confirmado. Tente salvar novamente." }, { status: 409 });

  try {
    const metadata = await head(pathname, { token });
    if (metadata.pathname !== pathname || metadata.size !== size || metadata.contentType !== tipo) {
      return NextResponse.json({ success: false, error: "Arquivo recebido não confere com o envio" }, { status: 400 });
    }
    const arquivo = await get(pathname, { access: "private", token, useCache: false });
    if (!arquivo?.stream || arquivo.blob.size !== size || arquivo.blob.contentType !== tipo
      || !await conteudoUploadDiretoCompativel(arquivo.stream, tipo, size)) {
      return NextResponse.json({ success: false, error: "Conteúdo incompatível com o tipo do arquivo" }, { status: 400 });
    }
    const recibo = criarReciboUploadAnexoBpm({ cardId, pathname, nome: originalName, tipo, tamanho: size });
    return NextResponse.json({ success: true, file: { originalName, mimeType: tipo, size, recibo } });
  } catch (error) {
    console.error("[POST /api/bpm/upload/finalize]", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ success: false, error: "Não foi possível conferir o arquivo enviado. Tente novamente." }, { status: 502 });
  }
}
