import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "../../../../../../auth";
import { synthesizeVoice, OnyxError } from "@/lib/onyx/client";
import { getUserOnyxToken } from "@/lib/onyx/user-token";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Schema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.string().max(80).optional(),
  speed: z.number().min(0.5).max(2).optional(),
});

// POST /api/onyx/voice/synthesize — TTS: texto → áudio.
// Repassa o áudio do Onyx ao browser. Suporta resposta binária (audio/*) OU
// JSON com base64/url (depende de como o Omni Voice devolve).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Texto inválido" }, { status: 400 });
  }

  try {
    const userToken = await getUserOnyxToken(session.user.id);
    const res = await synthesizeVoice({ ...parsed.data, userToken });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json({ error: body || "Falha ao gerar áudio" }, { status: res.status });
    }

    const contentType = res.headers.get("content-type") ?? "";

    // Caso 1: Onyx devolve o áudio binário direto.
    if (contentType.startsWith("audio/") || contentType.includes("octet-stream")) {
      const buffer = await res.arrayBuffer();
      return new NextResponse(buffer, {
        headers: { "Content-Type": contentType.startsWith("audio/") ? contentType : "audio/mpeg", "Cache-Control": "no-store" },
      });
    }

    // Caso 2: Onyx devolve JSON com áudio (base64) ou uma URL.
    const data = (await res.json().catch(() => null)) as
      | { audio_base64?: string; audio?: string; url?: string; content_type?: string }
      | null;

    const b64 = data?.audio_base64 ?? data?.audio;
    if (b64) {
      const buffer = Buffer.from(b64, "base64");
      return new NextResponse(buffer, {
        headers: { "Content-Type": data?.content_type ?? "audio/mpeg", "Cache-Control": "no-store" },
      });
    }

    if (data?.url) {
      // Áudio hospedado — devolve a URL para o cliente tocar.
      return NextResponse.json({ url: data.url });
    }

    return NextResponse.json({ error: "Formato de áudio não reconhecido" }, { status: 502 });
  } catch (err) {
    const code = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status: code });
  }
}
