import { z } from "zod";
import { conteudoUploadCompativel } from "@/lib/bpm/upload-conteudo";
import { NextRequest, NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import db from "@/lib/prisma";
import { auth } from "../../../../../auth";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { obterTipoUploadAnexo, validarUploadAnexo } from "@/lib/validations/bpm";
import { criarReciboUploadAnexoBpm, criarReferenciaAnexoBpm, obterTokenBlobPrivadoAnexoBpm, recibosAnexoBpmConfigurados } from "@/lib/bpm/anexos-storage";
import { ACAO_UPLOAD_ANEXO_SEM_REGISTRO } from "@/lib/bpm/anexos-lifecycle";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!recibosAnexoBpmConfigurados()) {
    console.error("[POST /api/bpm/upload] CRM_ANEXO_RECEIPT_SECRET ausente");
    return NextResponse.json({ success: false, error: "Envio de anexos indisponível. Avise o administrador para configurar a segurança dos anexos." }, { status: 503 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }
  const tokenPrivado = obterTokenBlobPrivadoAnexoBpm();
  if (!tokenPrivado) {
    console.error("[POST /api/bpm/upload] BLOBCRM_READ_WRITE_TOKEN ausente");
    return NextResponse.json({ success: false, error: "Armazenamento privado de anexos indisponível. Avise o administrador." }, { status: 503 });
  }
  const userId = Number(session.user.id);

  let formData: FormData;
  try { formData = await request.formData(); } catch {
    return NextResponse.json({ success: false, error: "Multipart inválido" }, { status: 400 });
  }
  const parsed = z.object({ file: z.instanceof(File), cardId: z.string().cuid() }).safeParse({
    file: formData.get("file"), cardId: formData.get("cardId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Arquivo ou card inválido" }, { status: 400 });
  }
  const { file, cardId } = parsed.data;

  try {
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "enviarArquivo");
  } catch {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 403 });
  }

  const erroValidacao = validarUploadAnexo({ size: file.size, type: file.type, name: file.name });
  if (erroValidacao) {
    return NextResponse.json({ success: false, error: erroValidacao }, { status: 400 });
  }
  const tipoEfetivo = obterTipoUploadAnexo({ name: file.name, type: file.type });
  if (!tipoEfetivo) {
    return NextResponse.json({ success: false, error: "Tipo de arquivo não permitido" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${cardId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
  const uploadPath = `bpm/${cardId}/${uniqueName}`;

  const arrayBuffer = await file.arrayBuffer();
  if (!await conteudoUploadCompativel(arrayBuffer, tipoEfetivo)) {
    return NextResponse.json({ success: false, error: "Conteúdo incompatível com o tipo do arquivo" }, { status: 400 });
  }

  let blob: Awaited<ReturnType<typeof put>>;
  try {
    blob = await put(uploadPath, new Blob([arrayBuffer], { type: tipoEfetivo }), {
      access: "private",
      token: tokenPrivado,
    });
  } catch (error) {
    console.error("[POST /api/bpm/upload] Falha no Blob privado", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ success: false, error: "Falha no armazenamento do anexo. Tente novamente." }, { status: 502 });
  }

  try {
    try {
      await db.bpmCardHistorico.create({ data: {
        cardId,
        acao: ACAO_UPLOAD_ANEXO_SEM_REGISTRO,
        usuarioId: userId,
        valorAnteriorJson: criarReferenciaAnexoBpm(blob.pathname),
      } });
    } catch (error) {
      await del(blob.pathname, { token: tokenPrivado }).catch((cleanupError) =>
        console.error("[POST /api/bpm/upload] Blob sem registro de limpeza", {
          pathname: blob.pathname,
          error: cleanupError instanceof Error ? cleanupError.name : "unknown",
        }));
      throw error;
    }

    const recibo = criarReciboUploadAnexoBpm({
      cardId,
      pathname: blob.pathname,
      nome: file.name,
      tipo: tipoEfetivo,
      tamanho: file.size,
    });

    return NextResponse.json({
      success: true,
      file: {
        originalName: file.name,
        mimeType: tipoEfetivo,
        size: file.size,
        recibo,
      },
    });
  } catch (error) {
    console.error("[POST /api/bpm/upload] Falha ao registrar anexo", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ success: false, error: "Não foi possível registrar o anexo. Tente novamente." }, { status: 500 });
  }
}
