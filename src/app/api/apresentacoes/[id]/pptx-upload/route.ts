import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { excluirBlobMotion, obterMotionStoreId, obterTokenMotion } from "@/lib/apresentacoes/blob";
import {
  caminhoPertenceAoPptx,
  extrairCaminhoBlobPublico,
  PPTX_ALLOWED_CONTENT_TYPES,
  PPTX_MAX_BYTES,
  prefixoOriginaisPptx,
} from "@/lib/apresentacoes/pptx/upload";

export const dynamic = "force-dynamic";

async function podeEditar(apresentacaoId: string, userId: number, role?: string): Promise<boolean> {
  if (isAdminRole(role)) return true;
  const apresentacao = await db.apresentacao.findUnique({
    where: { id: apresentacaoId },
    select: { autorId: true, colaboradores: { where: { userId, papel: "EDITOR" }, select: { id: true } } },
  });
  return Boolean(apresentacao && (apresentacao.autorId === userId || apresentacao.colaboradores.length > 0));
}

async function contextoAutorizado(apresentacaoId: string) {
  const session = await auth();
  if (!session?.user?.id) return { erro: NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 }) };
  const autorizado = await podeEditar(apresentacaoId, Number(session.user.id), session.user.role);
  if (!autorizado) return { erro: NextResponse.json({ success: false, error: "Sem permissão para editar esta apresentação" }, { status: 403 }) };
  return { session };
}

/** Gera somente o token curto; o navegador envia o binário direto ao store MOTION. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: apresentacaoId } = await params;
    const contexto = await contextoAutorizado(apresentacaoId);
    if ("erro" in contexto) return contexto.erro;

    const body = await request.json() as HandleUploadBody;
    const jsonResponse = await handleUpload({
      body,
      request,
      token: obterTokenMotion(),
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(prefixoOriginaisPptx(apresentacaoId)) || !pathname.toLowerCase().endsWith(".pptx")) {
          throw new Error("Caminho de upload PPTX inválido");
        }
        return {
          allowedContentTypes: [...PPTX_ALLOWED_CONTENT_TYPES],
          maximumSizeInBytes: PPTX_MAX_BYTES,
          addRandomSuffix: false,
          validUntil: Date.now() + 15 * 60 * 1000,
          tokenPayload: JSON.stringify({ apresentacaoId, storeId: obterMotionStoreId() }),
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[POST pptx-upload]", error);
    return NextResponse.json({ success: false, error: "Não foi possível autorizar o upload do PowerPoint." }, { status: 400 });
  }
}

/** Limpa originais cancelados e imagens temporárias da prévia, sem apagar assets preservados. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: apresentacaoId } = await params;
    const contexto = await contextoAutorizado(apresentacaoId);
    if ("erro" in contexto) return contexto.erro;

    const body = await request.json() as { urls?: unknown };
    if (!Array.isArray(body.urls)) return NextResponse.json({ success: false, error: "URLs ausentes" }, { status: 400 });
    const urls = Array.from(new Set(body.urls.filter((url): url is string => typeof url === "string"))).slice(0, 500);
    const candidatas = urls.filter((url) => {
      const caminho = extrairCaminhoBlobPublico(url);
      return Boolean(caminho && caminhoPertenceAoPptx(caminho, apresentacaoId));
    });
    if (candidatas.length === 0) return NextResponse.json({ success: true, removidos: 0 });

    const preservados = await db.apresentacaoAsset.findMany({
      where: { apresentacaoId, url: { in: candidatas } },
      select: { url: true },
    });
    const urlsPreservadas = new Set(preservados.map((asset) => asset.url));
    const temporarias = candidatas.filter((url) => !urlsPreservadas.has(url));
    if (temporarias.length > 0) await excluirBlobMotion(temporarias);
    return NextResponse.json({ success: true, removidos: temporarias.length });
  } catch (error) {
    console.error("[DELETE pptx-upload]", error);
    return NextResponse.json({ success: false, error: "Não foi possível limpar os arquivos temporários." }, { status: 500 });
  }
}
