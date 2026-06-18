import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "../../../../../auth";

async function extractPdfText(buf: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buf, verbosity: 0 });
  const parsed = await parser.getText();
  await parser.destroy();
  return parsed.text.trim();
}

async function extractTextContent(buffer: ArrayBuffer, type: string, name: string): Promise<string | undefined> {
  const isPdf = type === "application/pdf" || name.toLowerCase().endsWith(".pdf");
  const isText =
    type.startsWith("text/") ||
    type === "application/json" ||
    name.match(/\.(txt|csv|json|md|log|xml|yaml|yml|ts|tsx|js|jsx|py)$/i) !== null;

  try {
    if (isPdf) {
      const text = await extractPdfText(Buffer.from(buffer));
      console.log(`[BIBBLE UPLOAD] PDF extraído: ${text.length} chars`);
      if (!text) return undefined;
      return text.length > 50000 ? text.slice(0, 50000) + "\n\n...[truncado]" : text;
    }

    if (isText) {
      const text = new TextDecoder("utf-8").decode(buffer);
      return text.length > 50000 ? text.slice(0, 50000) + "\n\n...[truncado]" : text;
    }
  } catch (err) {
    console.error("[BIBBLE UPLOAD] Falha ao extrair conteúdo:", err);
  }
  return undefined;
}

export const dynamic = "force-dynamic";

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "video/mp4", "video/webm", "video/quicktime",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv", "application/json",
  "application/zip", "application/x-zip-compressed",
];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);

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

  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Tipo não permitido: ${file.type}` },
      { status: 400 }
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
  const uploadPath = `bibble-chat/${uniqueName}`;

  const arrayBuffer = await file.arrayBuffer();

  const [blob, extractedContent] = await Promise.all([
    put(uploadPath, new Blob([arrayBuffer], { type: file.type }), {
      access: "public",
      token: process.env.IACHAT_READ_WRITE_TOKEN,
    }),
    extractTextContent(arrayBuffer, file.type, file.name),
  ]);

  return NextResponse.json({
    success: true,
    file: {
      id: uniqueName,
      name: file.name,
      type: file.type,
      size: file.size,
      url: blob.url,
      uploadPath,
      extractedContent, // texto extraído para PDFs e arquivos de texto
    },
  });
}
