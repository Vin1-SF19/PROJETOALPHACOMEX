import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { uploadAgentImage, OnyxError } from "@/lib/onyx/client";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// POST /api/onyx/agents/upload-image — recebe a imagem do agente e devolve o id
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo de imagem ausente." }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Formato inválido. Use PNG, JPEG, WEBP ou GIF." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Imagem muito grande (máx. 5MB)." }, { status: 400 });
  }

  try {
    const uploadedImageId = await uploadAgentImage(file, file.name || "avatar.png");
    return NextResponse.json({ uploaded_image_id: uploadedImageId });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
