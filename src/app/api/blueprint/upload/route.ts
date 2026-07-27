import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "../../../../../auth";
import { exigirAcessoBlueprint } from "@/lib/blueprint/ownership";
import { BLUEPRINT_ALLOWED_MIME_TYPES, BLUEPRINT_MAX_FILE_SIZE } from "@/lib/validations/blueprint";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number(session.user.id);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string | null;

  if (!file || !projectId) {
    return NextResponse.json({ error: "Arquivo ou projeto ausente" }, { status: 400 });
  }

  try {
    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "enviarArquivo");
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  if (file.size > BLUEPRINT_MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Máximo: ${BLUEPRINT_MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 400 },
    );
  }

  if (file.type && !(BLUEPRINT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: `Tipo não permitido: ${file.type}` }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${projectId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
  const uploadPath = `blueprint/${projectId}/${uniqueName}`;

  const arrayBuffer = await file.arrayBuffer();

  const blob = await put(uploadPath, new Blob([arrayBuffer], { type: file.type }), {
    access: "public",
    token: process.env.BLUEPRINT_READ_WRITE_TOKEN,
  });

  return NextResponse.json({
    success: true,
    file: {
      name: uniqueName,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      url: blob.url,
    },
  });
}
