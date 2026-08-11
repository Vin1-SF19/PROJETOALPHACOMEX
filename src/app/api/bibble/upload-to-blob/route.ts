import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "../../../../../auth";
import { extractTextFromBuffer } from "@/lib/bibble/tika";
import { selectTextForTokenBudget } from "@/lib/bibble/context-budget";
import {
  BIBBLE_ATTACHMENT_MAX_BYTES,
  BIBBLE_UPLOAD_TEXT_TOKEN_BUDGET,
  hasPdfMagicBytes,
  isAllowedBibbleAttachmentType,
} from "@/lib/bibble/attachment-security";

export const dynamic = "force-dynamic";
// O fallback de OCR pode aguardar o job do PDF24 por até 8 minutos.
export const maxDuration = 600;

const MAX_SIZE = BIBBLE_ATTACHMENT_MAX_BYTES;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Máximo: ${MAX_SIZE / 1024 / 1024}MB` },
      { status: 400 }
    );
  }

  if (!file.type || !isAllowedBibbleAttachmentType(file.type)) {
    return NextResponse.json(
      { error: file.type ? `Tipo não permitido: ${file.type}` : "Tipo do arquivo ausente" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const declaresPdf = file.type === "application/pdf";
  const namedAsPdf = file.name.toLowerCase().endsWith(".pdf");
  if (declaresPdf !== namedAsPdf || (declaresPdf && !hasPdfMagicBytes(buffer))) {
    return NextResponse.json(
      { error: "Conteúdo do arquivo não corresponde a um PDF válido" },
      { status: 422 },
    );
  }

  const uniqueName = crypto.randomUUID();
  const uploadPath = `bibble-chat/${uniqueName}`;

  const [blob, extraction] = await Promise.all([
    put(uploadPath, new Blob([arrayBuffer], { type: file.type }), {
      access: "public",
      token: process.env.IACHAT_READ_WRITE_TOKEN,
    }),
    extractTextFromBuffer(buffer, file.type, file.name),
  ]);

  const selectedExtraction = selectTextForTokenBudget(
    extraction.text,
    BIBBLE_UPLOAD_TEXT_TOKEN_BUDGET,
    "texto extraído no upload",
  );
  const extractedContent = selectedExtraction.text || undefined;

  console.info("[BIBBLE PDF] extraction", {
    stage: "upload",
    source: extraction.source,
    extractedChars: extraction.text.length,
    includedChars: selectedExtraction.includedChars,
    strategy: extraction.text ? selectedExtraction.strategy : "no-useful-text",
  });

  return NextResponse.json({
    success: true,
    file: {
      id: uniqueName,
      name: file.name,
      type: file.type,
      size: file.size,
      url: blob.url,
      uploadPath,
      extractedContent,
      extractionSource: extraction.source,
      extractionReduced: selectedExtraction.reduced,
      extractionNotice: selectedExtraction.reduced
        ? "O texto retornado foi reduzido com trechos do início, meio e fim; a redução está marcada no conteúdo."
        : undefined,
    },
  });
}
