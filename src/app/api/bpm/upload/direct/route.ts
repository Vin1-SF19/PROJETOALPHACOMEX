import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/prisma";
import { auth } from "../../../../../../auth";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { criarReferenciaAnexoBpm, obterTokenBlobPrivadoAnexoBpm, pathnameUploadDiretoAnexoBpmValido, recibosAnexoBpmConfigurados } from "@/lib/bpm/anexos-storage";
import { ACAO_UPLOAD_ANEXO_SEM_REGISTRO } from "@/lib/bpm/anexos-lifecycle";
import { BPM_ANEXO_ALLOWED_MIME, BPM_ANEXO_MAX_BYTES, obterTipoUploadAnexo } from "@/lib/validations/bpm";

export const dynamic = "force-dynamic";

const eventoSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("blob.generate-client-token"), payload: z.object({
    pathname: z.string().min(1).max(1024), multipart: z.boolean(), clientPayload: z.string().nullable(),
  }) }),
  z.object({ type: z.literal("blob.upload-completed"), payload: z.object({
    blob: z.object({ pathname: z.string().min(1).max(1024) }), tokenPayload: z.string().nullable().optional(),
  }) }),
]);
const payloadSchema = z.object({ cardId: z.string().cuid() });

function caminhoDoCard(pathname: string, cardId: string): boolean {
  return pathnameUploadDiretoAnexoBpmValido(pathname, cardId)
    && Boolean(obterTipoUploadAnexo({ name: pathname.split("/").at(-1) ?? "", type: "" }));
}

/** Autoriza um upload direto ao store privado; nenhum binário passa pela Function. */
export async function POST(request: NextRequest) {
  const token = obterTokenBlobPrivadoAnexoBpm();
  if (!token || !recibosAnexoBpmConfigurados()) {
    return NextResponse.json({ success: false, error: "Armazenamento privado indisponível" }, { status: 503 });
  }
  let body: HandleUploadBody;
  try {
    const recebido: unknown = await request.json();
    const parsed = eventoSchema.safeParse(recebido);
    if (!parsed.success) return NextResponse.json({ success: false, error: "Solicitação de upload inválida" }, { status: 400 });
    // O SDK assina/verifica JSON.stringify(body) no callback. Usar parsed.data
    // removeria propriedades do blob pelo Zod e invalidaria a assinatura real.
    body = recebido as HandleUploadBody;
  } catch {
    return NextResponse.json({ success: false, error: "Solicitação de upload inválida" }, { status: 400 });
  }

  // O webhook de conclusão é autenticado pelo SDK do Blob; a solicitação de
  // token, originada no navegador, exige a sessão normal do CRM.
  let tokenPayload: string | undefined;
  if (body.type === "blob.generate-client-token") {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    let payload: unknown;
    try { payload = JSON.parse(body.payload.clientPayload || "null"); } catch { payload = null; }
    const parsed = payloadSchema.safeParse(payload);
    if (!parsed.success || !caminhoDoCard(body.payload.pathname, parsed.data.cardId)) {
      return NextResponse.json({ success: false, error: "Caminho de anexo inválido" }, { status: 400 });
    }
    const userId = Number(session.user.id);
    try { await exigirAcessoBpmCard(parsed.data.cardId, userId, session.user.role ?? null, "enviarArquivo"); }
    catch { return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 403 }); }
    tokenPayload = JSON.stringify({ cardId: parsed.data.cardId, userId, pathname: body.payload.pathname });
  }

  try {
    const response = await handleUpload({
      body, request, token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload: unknown;
        try { payload = JSON.parse(clientPayload || "null"); } catch { payload = null; }
        const parsed = payloadSchema.safeParse(payload);
        if (!parsed.success || !caminhoDoCard(pathname, parsed.data.cardId)) throw new Error("Caminho de anexo inválido");
        return {
          allowedContentTypes: [...BPM_ANEXO_ALLOWED_MIME],
          maximumSizeInBytes: BPM_ANEXO_MAX_BYTES,
          validUntil: Date.now() + 15 * 60 * 1000,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload: completedPayload }) => {
        let payload: unknown;
        try { payload = JSON.parse(completedPayload || "null"); } catch { payload = null; }
        const parsed = payloadSchema.extend({ userId: z.number().int().positive(), pathname: z.string() }).safeParse(payload);
        if (!parsed.success || parsed.data.pathname !== blob.pathname
          || !caminhoDoCard(blob.pathname, parsed.data.cardId)) {
          throw new Error("Callback de upload privado inválido");
        }
        const referencia = criarReferenciaAnexoBpm(blob.pathname);
        const existente = await db.bpmCardHistorico.findFirst({
          where: { cardId: parsed.data.cardId, usuarioId: parsed.data.userId,
            acao: ACAO_UPLOAD_ANEXO_SEM_REGISTRO, valorAnteriorJson: referencia },
          select: { id: true },
        });
        if (!existente) await db.bpmCardHistorico.create({ data: {
          cardId: parsed.data.cardId, usuarioId: parsed.data.userId,
          acao: ACAO_UPLOAD_ANEXO_SEM_REGISTRO, valorAnteriorJson: referencia,
        } });
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("[POST /api/bpm/upload/direct]", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ success: false, error: "Não foi possível autorizar ou concluir o upload privado" }, { status: 400 });
  }
}
