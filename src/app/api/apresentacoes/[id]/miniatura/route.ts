import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { excluirBlobMotion, obterTokenMotion } from "@/lib/apresentacoes/blob";

export const dynamic = "force-dynamic";

const MAX_MINIATURA_BYTES = 4 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isAdmin(role?: string) {
  return isAdminRole(role);
}

async function podeEditar(apresentacaoId: string, userId: number, role?: string): Promise<boolean> {
  if (isAdmin(role)) return true;
  const apresentacao = await db.apresentacao.findUnique({
    where: { id: apresentacaoId },
    select: { autorId: true, colaboradores: { where: { userId, papel: { in: ["EDITOR"] } }, select: { id: true } } },
  });
  return Boolean(apresentacao && (apresentacao.autorId === userId || apresentacao.colaboradores.length > 0));
}

function assinaturaPngValida(bytes: Uint8Array): boolean {
  return bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((valor, indice) => bytes[indice] === valor);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });

  const { id: apresentacaoId } = await params;
  if (!apresentacaoId) return NextResponse.json({ success: false, error: "Apresentação inválida" }, { status: 400 });

  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "image/png") {
    return NextResponse.json({ success: false, error: "Formato inválido — envie um PNG." }, { status: 415 });
  }

  const autorizado = await podeEditar(apresentacaoId, Number(session.user.id), session.user.role);
  if (!autorizado) return NextResponse.json({ success: false, error: "Sem permissão para editar esta apresentação" }, { status: 403 });

  const corpo = await request.blob();
  if (corpo.size === 0 || corpo.size > MAX_MINIATURA_BYTES) {
    return NextResponse.json({ success: false, error: "Imagem vazia ou grande demais." }, { status: 413 });
  }

  const assinatura = new Uint8Array(await corpo.slice(0, 8).arrayBuffer());
  if (!assinaturaPngValida(assinatura)) {
    return NextResponse.json({ success: false, error: "O conteúdo enviado não é um PNG válido." }, { status: 400 });
  }

  let urlEnviada: string | null = null;
  try {
    const caminho = `apresentacoes/${apresentacaoId}/miniatura-${Date.now()}.png`;
    const blob = await put(caminho, corpo, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/png",
      token: obterTokenMotion(),
    });
    urlEnviada = blob.url;

    const anterior = await db.apresentacao.findUnique({ where: { id: apresentacaoId }, select: { thumbnailUrl: true } });
    await db.apresentacao.update({ where: { id: apresentacaoId }, data: { thumbnailUrl: blob.url } });

    if (anterior?.thumbnailUrl && anterior.thumbnailUrl !== blob.url) {
      excluirBlobMotion(anterior.thumbnailUrl).catch(() => undefined);
    }

    return NextResponse.json({ success: true, thumbnailUrl: blob.url });
  } catch (error) {
    if (urlEnviada) excluirBlobMotion(urlEnviada).catch(() => undefined);
    console.error("[POST /api/apresentacoes/[id]/miniatura]", error);
    return NextResponse.json({ success: false, error: "Não foi possível salvar a miniatura" }, { status: 500 });
  }
}
