import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "../../../../../auth";
import { extractTextFromBuffer } from "@/lib/bibble/tika";

export const dynamic = "force-dynamic";

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "video/mp4", "video/webm", "video/quicktime",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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
  const buffer = Buffer.from(arrayBuffer);

  const [blob, extraction] = await Promise.all([
    put(uploadPath, new Blob([arrayBuffer], { type: file.type }), {
      access: "public",
      token: process.env.IACHAT_READ_WRITE_TOKEN,
    }),
    extractTextFromBuffer(buffer, file.type, file.name),
  ]);

  const extractedContent = extraction.text
    ? (extraction.text.length > 50000
        ? extraction.text.slice(0, 50000) + "\n\n...[truncado]"
        : extraction.text)
    : undefined;

  console.log(`[BIBBLE UPLOAD] ${file.name} — fonte: ${extraction.source}, chars: ${extraction.text.length}`);

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
    },
  });
}
