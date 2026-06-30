import { NextResponse } from "next/server";
import { getVoiceStatus, OnyxError } from "@/lib/onyx/client";

export const dynamic = "force-dynamic";

// GET /api/onyx/voice/status — diz se TTS/STT estão habilitados no Onyx.
// Público: status de configuração do sistema (sem dados privados).
// synthesize e transcribe mantêm autenticação própria.
export async function GET() {
  try {
    const status = await getVoiceStatus();
    return NextResponse.json(status);
  } catch (err) {
    // Falha (voz indisponível) → reporta desabilitado, sem quebrar a UI.
    const code = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ stt_enabled: false, tts_enabled: false }, { status: code === 503 ? 200 : code });
  }
}
