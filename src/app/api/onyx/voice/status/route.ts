import { NextResponse } from "next/server";
import { getVoiceStatus, OnyxError } from "@/lib/onyx/client";
import { auth } from "../../../../../../auth";
import { mapearIndisponibilidadeAuth } from "@/lib/auth/indisponibilidade";
import { getUserOnyxToken } from "@/lib/onyx/user-token";
import { respostaIndisponibilidadeIA } from "@/lib/ai-unavailability";

export const dynamic = "force-dynamic";

// GET /api/onyx/voice/status — diz se TTS/STT estão habilitados no Onyx.
// Uses the caller's individual token, like the remaining user operations.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const token = await getUserOnyxToken(session.user.id);
    const status = await getVoiceStatus(token);
    return NextResponse.json(status, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    const authUnavailable = mapearIndisponibilidadeAuth(err);
    if (authUnavailable) return authUnavailable;
    return respostaIndisponibilidadeIA(err instanceof OnyxError ? err.code : "AI_METADATA_UNAVAILABLE",
      err instanceof OnyxError && [401, 403, 429, 503, 504].includes(err.status) ? err.status : err instanceof OnyxError ? 502 : 503,
      { stt_enabled: false, tts_enabled: false });
  }
}
