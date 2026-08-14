import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "../../../../../auth";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { BPM_ANEXO_ALLOWED_MIME, BPM_ANEXO_MAX_BYTES, validarUploadAnexo } from "@/lib/validations/bpm";
import { criarReciboUploadAnexoBpm, recibosAnexoBpmConfigurados } from "@/lib/bpm/anexos-storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!recibosAnexoBpmConfigurados()) {
    return NextResponse.json({ success: false, error: "Recibos de anexos não configurados" }, { status: 503 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }
  const userId = Number(session.user.id);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const cardId = formData.get("cardId") as string | null;

  if (!file || !cardId) {
    return NextResponse.json({ success: false, error: "Arquivo ou card ausente" }, { status: 400 });
  }

  try {
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "enviarArquivo");
  } catch {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 403 });
  }

  const erroValidacao = validarUploadAnexo({ size: file.size, type: file.type });
  if (erroValidacao) {
    return NextResponse.json({ success: false, error: erroValidacao }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${cardId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
  const uploadPath = `bpm/${cardId}/${uniqueName}`;

  const arrayBuffer = await file.arrayBuffer();

  try {
    const blob = await put(uploadPath, new Blob([arrayBuffer], { type: file.type }), {
      access: "private",
      token: process.env.CRM_READ_WRITE_TOKEN,
    });

    const recibo = criarReciboUploadAnexoBpm({
      cardId,
      pathname: blob.pathname,
      nome: file.name,
      tipo: file.type || "application/octet-stream",
      tamanho: file.size,
    });

    return NextResponse.json({
      success: true,
      file: {
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        recibo,
      },
    });
  } catch (error) {
    console.error("[POST /api/bpm/upload]", error);
    return NextResponse.json({ success: false, error: "Erro ao enviar arquivo" }, { status: 500 });
  }
}

export { BPM_ANEXO_ALLOWED_MIME, BPM_ANEXO_MAX_BYTES };
