import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "../../../../../auth";
import { podeEditarNota } from "@/lib/notas/permissoes";
import { NOTAS_ANEXO_ALLOWED_MIME_TYPES, NOTAS_ANEXO_MAX_SIZE } from "@/lib/validations/notas";

export const dynamic = "force-dynamic";

const MAGIC_BYTES: Record<string, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
};

function bytesBatem(bytes: Uint8Array, assinatura: number[]): boolean {
  return assinatura.every((byte, index) => bytes[index] === byte);
}

function magicBytesValidos(mimeType: string, bytes: Uint8Array): boolean {
  const assinaturas = MAGIC_BYTES[mimeType];
  if (!assinaturas) return true; // tipos sem assinatura conhecida (docx/xlsx/txt/csv/webp) confiam no MIME declarado
  return assinaturas.some((assinatura) => bytesBatem(bytes, assinatura));
}

// Rate limiting em memória (5 uploads/min por usuário) — mesmo padrão de metas/justificativas/upload.
const uploadTimestamps = new Map<string, number[]>();

function verificarRateLimit(userId: string): boolean {
  const agora = Date.now();
  const janela = 60 * 1000;
  const limite = 5;

  const registros = (uploadTimestamps.get(userId) ?? []).filter((t) => agora - t < janela);
  if (registros.length >= limite) return false;

  registros.push(agora);
  uploadTimestamps.set(userId, registros);
  return true;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
  }
  const userId = Number(session.user.id);
  const role = session.user.role ?? "";

  if (!verificarRateLimit(String(userId))) {
    return NextResponse.json(
      { success: false, error: "Limite de uploads atingido. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const noteId = formData.get("noteId") as string | null;

  if (!file || !noteId) {
    return NextResponse.json({ success: false, error: "Arquivo ou nota ausente" }, { status: 400 });
  }

  if (!(await podeEditarNota({ id: userId, role }, noteId))) {
    return NextResponse.json({ success: false, error: "Sem permissão para anexar nesta nota" }, { status: 403 });
  }

  if (file.size > NOTAS_ANEXO_MAX_SIZE) {
    return NextResponse.json(
      { success: false, error: `Arquivo muito grande. Máximo: ${NOTAS_ANEXO_MAX_SIZE / 1024 / 1024}MB` },
      { status: 413 },
    );
  }

  if (!(NOTAS_ANEXO_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ success: false, error: `Tipo de arquivo não permitido: ${file.type}` }, { status: 422 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (!magicBytesValidos(file.type, bytes)) {
    return NextResponse.json({ success: false, error: "Conteúdo do arquivo não corresponde ao tipo declarado" }, { status: 422 });
  }

  const token = process.env.NOTAS_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ success: false, error: "Armazenamento de anexos não configurado" }, { status: 503 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uploadPath = `notas/${noteId}/${safeName}`;

  try {
    const blob = await put(uploadPath, new Blob([arrayBuffer], { type: file.type }), {
      access: "public",
      addRandomSuffix: true,
      token,
    });

    return NextResponse.json({
      success: true,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      storageKey: blob.url,
    });
  } catch (error) {
    console.error("[notas/upload] userId=" + userId, error);
    return NextResponse.json({ success: false, error: "Erro ao salvar arquivo" }, { status: 500 });
  }
}
