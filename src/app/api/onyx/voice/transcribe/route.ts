import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { transcribeAudio, OnyxError } from "@/lib/onyx/client";
import { getUserOnyxToken } from "@/lib/onyx/user-token";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED = ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/mp3"];

// POST /api/onyx/voice/transcribe — STT: áudio do microfone → texto.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Áudio ausente" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Áudio muito grande (máx. 15MB)" }, { status: 400 });
  }
  // type pode vir vazio do MediaRecorder; valida só quando informado.
  if (file.type && !ALLOWED.some((t) => file.type.startsWith(t))) {
    return NextResponse.json({ error: `Formato de áudio não suportado: ${file.type}` }, { status: 400 });
  }

  try {
    const userToken = await getUserOnyxToken(session.user.id);
    const res = await transcribeAudio(file, file.name || "audio.webm", userToken);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json({ error: body || "Falha ao transcrever" }, { status: res.status });
    }

    // Onyx devolve { ...: string } — normaliza para { text }.
    const data = (await res.json().catch(() => ({}))) as Record<string, string>;
    const text = data.text ?? data.transcription ?? data.transcript ?? Object.values(data)[0] ?? "";
    return NextResponse.json({ text });
  } catch (err) {
    const code = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status: code });
  }
}
