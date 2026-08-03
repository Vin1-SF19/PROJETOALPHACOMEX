import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { auth } from "../../../../../auth";
import {
  AVATAR_ALLOWED_TYPES,
  hasValidAvatarSignature,
  MAX_AVATAR_UPLOAD_BYTES,
  validateAvatarMetadata,
} from "@/lib/avatar-upload";

function filenameSeguro(value: string | null): string {
  return (value ?? "avatar.webp")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "avatar.webp";
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  const metadataError = validateAvatarMetadata(
    { type: contentType, size: contentLength || 1 },
    MAX_AVATAR_UPLOAD_BYTES,
  );
  if (metadataError) {
    const status = AVATAR_ALLOWED_TYPES.includes(contentType as (typeof AVATAR_ALLOWED_TYPES)[number]) ? 413 : 415;
    return NextResponse.json({ error: metadataError }, { status });
  }

  try {
    const body = await request.blob();
    const bodyError = validateAvatarMetadata(body, MAX_AVATAR_UPLOAD_BYTES);
    if (bodyError) {
      return NextResponse.json({ error: bodyError }, { status: body.size > MAX_AVATAR_UPLOAD_BYTES ? 413 : 400 });
    }
    const signature = new Uint8Array(await body.slice(0, 12).arrayBuffer());
    if (!hasValidAvatarSignature(body.type, signature)) {
      return NextResponse.json({ error: "O conteúdo do arquivo não corresponde a uma imagem válida." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const filename = filenameSeguro(searchParams.get("filename"));
    const blob = await put(`avatares/${session.user.id}/${filename}`, body, {
      access: "public",
      addRandomSuffix: true,
      contentType: body.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("[AVATAR_UPLOAD]", error);
    return NextResponse.json({ error: "Não foi possível enviar a foto." }, { status: 500 });
  }
}
