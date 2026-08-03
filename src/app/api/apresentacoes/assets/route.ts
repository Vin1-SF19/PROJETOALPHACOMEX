import { del, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import db from "@/lib/prisma";
import { detectarTipoAsset, nomeArquivoSeguro, validarArquivoAsset } from "@/lib/apresentacoes/assets";

export const dynamic = "force-dynamic";

function isAdmin(role?: string) {
  return role === "Admin" || role === "CEO";
}

async function podeEditar(apresentacaoId: string, userId: number, role?: string): Promise<boolean> {
  if (isAdmin(role)) return true;
  const apresentacao = await db.apresentacao.findUnique({
    where: { id: apresentacaoId },
    select: { autorId: true, colaboradores: { where: { userId, papel: { in: ["EDITOR"] } }, select: { id: true } } },
  });
  return Boolean(apresentacao && (apresentacao.autorId === userId || apresentacao.colaboradores.length > 0));
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });

  const formData = await request.formData();
  const arquivo = formData.get("file");
  const apresentacaoId = formData.get("apresentacaoId");
  if (!(arquivo instanceof File) || typeof apresentacaoId !== "string" || !apresentacaoId) {
    return NextResponse.json({ success: false, error: "Arquivo ou apresentação ausente" }, { status: 400 });
  }

  const autorizado = await podeEditar(apresentacaoId, Number(session.user.id), session.user.role);
  if (!autorizado) return NextResponse.json({ success: false, error: "Sem permissão para editar esta apresentação" }, { status: 403 });

  const erroValidacao = validarArquivoAsset(arquivo);
  if (erroValidacao) return NextResponse.json({ success: false, error: erroValidacao }, { status: 400 });

  const tipo = detectarTipoAsset(arquivo);
  if (!tipo) return NextResponse.json({ success: false, error: "Formato não permitido" }, { status: 400 });

  const nomeSeguro = nomeArquivoSeguro(arquivo.name) || `asset-${Date.now()}`;
  const caminho = `apresentacoes/${apresentacaoId}/${Date.now()}-${crypto.randomUUID()}-${nomeSeguro}`;
  let urlEnviada: string | null = null;

  try {
    const blob = await put(caminho, arquivo, {
      access: "public",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    urlEnviada = blob.url;

    const asset = await db.apresentacaoAsset.create({
      data: {
        apresentacaoId,
        tipo,
        url: blob.url,
        nomeOriginal: arquivo.name.slice(0, 255),
        tamanhoBytes: arquivo.size,
      },
      select: { id: true, tipo: true, url: true, nomeOriginal: true, tamanhoBytes: true, createdAt: true },
    });

    return NextResponse.json({ success: true, asset: { ...asset, createdAt: asset.createdAt.toISOString() } });
  } catch (error) {
    if (urlEnviada) {
      await del(urlEnviada, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => undefined);
    }
    console.error("[POST /api/apresentacoes/assets]", error);
    return NextResponse.json({ success: false, error: "Não foi possível enviar o arquivo" }, { status: 500 });
  }
}
