import { auth } from "../../../../../../auth";
import { podeGerenciarMetas } from "@/lib/metas-permissoes";
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
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
  }

  if (!podeGerenciarMetas(user.role ?? "")) {
    return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
  }

  if (!verificarRateLimit(user.id)) {
    return NextResponse.json(
      { success: false, error: "Limite de uploads atingido. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  const mes = Number(searchParams.get("mes"));
  const ano = Number(searchParams.get("ano"));
  if (!filename) {
    return NextResponse.json({ success: false, error: "Nome do arquivo ausente" }, { status: 400 });
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(ano) || ano < 2020 || ano > 2100) {
    return NextResponse.json({ success: false, error: "Mês/ano de referência inválidos" }, { status: 400 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 15 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: "Arquivo excede o limite de 15MB" }, { status: 413 });
  }

  const buffer = await request.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length > 15 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: "Arquivo excede o limite de 15MB" }, { status: 413 });
  }

  // Validação de magic bytes: PDF começa com %PDF (0x25 0x50 0x44 0x46)
  const ehPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (!ehPdf) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Apenas arquivos PDF são aceitos. Se seu arquivo é um Word (.docx), converta para PDF antes de enviar.",
      },
      { status: 422 },
    );
  }

  const token = process.env.METAS_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ success: false, error: "Armazenamento não configurado" }, { status: 503 });
  }

  try {
    const blob = await put(
      `justificativas-meta/${ano}-${String(mes).padStart(2, "0")}/${filename}`,
      new Blob([buffer], { type: "application/pdf" }),
      {
        access: "public",
        addRandomSuffix: true,
        token,
      },
    );

    return NextResponse.json({ success: true, url: blob.url, size: bytes.length });
  } catch (e) {
    const err = e as Error;
    console.error("[metas/justificativas/upload] userId=" + user.id, err.message);
    return NextResponse.json({ success: false, error: "Erro ao salvar arquivo" }, { status: 500 });
  }
}
