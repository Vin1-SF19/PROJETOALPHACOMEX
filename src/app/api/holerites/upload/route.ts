import { acessoEstaIndisponivel, mapearIndisponibilidadeAuth } from "@/lib/auth/indisponibilidade";
import { auth } from "../../../../../auth";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

// Rate limiting simples em memória (5 uploads/min por usuário)
// Em produção multi-instância, substituir por Redis/Upstash
const uploadTimestamps = new Map<string, number[]>();

function verificarRateLimit(userId: string): boolean {
  const agora = Date.now();
  const janela = 60 * 1000; // 1 minuto
  const limite = 5;

  const registros = (uploadTimestamps.get(userId) || []).filter((t) => agora - t < janela);
  if (registros.length >= limite) return false;

  registros.push(agora);
  uploadTimestamps.set(userId, registros);
  return true;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
  // Auth obrigatória
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Rate limiting
  if (!verificarRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Limite de uploads atingido. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  if (!filename) {
    console.log("Nome do arquivo ausente: ", NextResponse);
    return NextResponse.json({ error: "Nome do arquivo ausente" }, { status: 400 });
  }

  // Verificação de tamanho via Content-Length (estimativa rápida)
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Arquivo excede o limite de 10MB" }, { status: 413 });
  }

  // Ler o body para validar magic bytes
  const buffer = await request.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Verificação de tamanho real (após ler)
  if (bytes.length > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Arquivo excede o limite de 10MB" }, { status: 413 });
  }

  // Validação de magic bytes: PDF começa com %PDF (0x25 0x50 0x44 0x46)
  if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    return NextResponse.json(
      { error: "Arquivo inválido. Apenas PDFs são aceitos." },
      { status: 422 },
    );
  }

  try {
    const blob = await put(
      `holerites/${user.id}/${filename}`,
      new Blob([buffer], { type: "application/pdf" }),
      {
        access: "public",
        addRandomSuffix: true,
        token: process.env.HOLERITES_READ_WRITE_TOKEN,
      },
    );

    return NextResponse.json({ url: blob.url, size: bytes.length });
  } catch (e) {
    if (acessoEstaIndisponivel(e)) throw e;
    const err = e as Error;
    // Log sem PII
    console.error("[holerites/upload] userId=" + user.id, err.message);
    return NextResponse.json({ error: "Erro ao salvar arquivo" }, { status: 500 });
  }

  } catch (authError) {
    const unavailable = mapearIndisponibilidadeAuth(authError);
    if (unavailable) return unavailable;
    throw authError;
  }
}
