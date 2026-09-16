import { NextResponse } from "next/server";

import { auth } from "../../../../../auth";
import { readRequestTextWithLimit } from "@/lib/bibble/attachment-security";
import { acquireBibbleVoiceLease } from "@/lib/bibble/voice-admission";
import {
  BIBBLE_VOICE_REQUEST_MAX_BYTES,
  BIBBLE_VOICE_TIMEOUT_MS,
  BibbleVoiceProxyError,
  assertBibbleVoiceSameOrigin,
  bibbleVoiceHeaders,
  bibbleVoiceSpeechSchema,
  readBibbleVoiceAudio,
  resolveBibbleVoiceConfig,
  resolveBibbleVoiceEndpoint,
} from "@/lib/bibble/voice-service";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

function publicError(error: unknown): NextResponse {
  if (error instanceof BibbleVoiceProxyError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (error instanceof Error && error.name === "BibblePayloadTooLargeError") {
    return NextResponse.json(
      { success: false, error: "Solicitação de voz acima do limite", code: "PAYLOAD_TOO_LARGE" },
      { status: 413 },
    );
  }
  return NextResponse.json(
    { success: false, error: "Voz do Bibble temporariamente indisponível", code: "VOICE_UNAVAILABLE" },
    { status: 503 },
  );
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const result = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(result).set(bytes);
  return result;
}

async function requireUser(): Promise<{ userId: string } | { response: NextResponse }> {
  const session = await auth();
  return session?.user?.id
    ? { userId: String(session.user.id) }
    : { response: NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 }) };
}

export async function GET(request: Request) {
  const identity = await requireUser();
  if ("response" in identity) return identity.response;

  try {
    const { baseUrl, token } = resolveBibbleVoiceConfig();
    const detail = new URL(request.url).searchParams.get("detail");
    const endpoint = detail === "model" ? "/v1/model/status" : "/health";
    const upstream = await fetch(resolveBibbleVoiceEndpoint(baseUrl, endpoint), {
      headers: bibbleVoiceHeaders(token, "application/json"),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!upstream.ok) throw new Error("voice health failed");
    const status = await upstream.json() as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      data: detail === "model"
        ? {
            loaded: status.loaded === true,
            device: status.device === "cuda" || status.device === "cpu" ? status.device : "unavailable",
            idleSeconds: typeof status.idleSeconds === "number" ? status.idleSeconds : null,
            idleTimeout: typeof status.idleTimeout === "number" ? status.idleTimeout : null,
            queueSize: typeof status.queueSize === "number" ? status.queueSize : null,
            cache: { enabled: (status.cache as { enabled?: unknown } | undefined)?.enabled === true },
          }
        : {
            status: status.status === "ok" ? "ok" : "degraded",
            service: "bibble-voice",
            cuda: status.cuda === true,
            device: status.device === "cuda" || status.device === "cpu" ? status.device : "unavailable",
            modelLoaded: status.modelLoaded === true,
            referenceConfigured: status.referenceConfigured === true,
          },
    });
  } catch (error) {
    return publicError(error);
  }
}

export async function POST(request: Request) {
  const identity = await requireUser();
  if ("response" in identity) return identity.response;

  try {
    assertBibbleVoiceSameOrigin(request);
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
      throw new BibbleVoiceProxyError(415, "INVALID_CONTENT_TYPE", "Content-Type inválido");
    }
    const raw = await readRequestTextWithLimit(request, BIBBLE_VOICE_REQUEST_MAX_BYTES);
    const parsedJson: unknown = (() => { try { return JSON.parse(raw); } catch { return null; } })();
    const parsed = bibbleVoiceSpeechSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new BibbleVoiceProxyError(400, "INVALID_VOICE_REQUEST", "Solicitação de voz inválida");
    }

    const { baseUrl, token } = resolveBibbleVoiceConfig();
    const lease = acquireBibbleVoiceLease(identity.userId);
    if (!lease) {
      throw new BibbleVoiceProxyError(429, "VOICE_BUSY", "Voz do Bibble ocupada. Tente novamente em instantes");
    }
    try {
      const upstream = await fetch(resolveBibbleVoiceEndpoint(baseUrl, "/v1/speech"), {
        method: "POST",
        headers: {
          ...bibbleVoiceHeaders(token, "audio/wav"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed.data),
        redirect: "error",
        signal: AbortSignal.timeout(BIBBLE_VOICE_TIMEOUT_MS),
      });
      if (!upstream.ok) {
        const status = upstream.status === 400 || upstream.status === 404 || upstream.status === 413
          ? upstream.status
          : 503;
        throw new BibbleVoiceProxyError(status, "VOICE_GENERATION_FAILED", "Não foi possível gerar a voz");
      }
      const audio = await readBibbleVoiceAudio(upstream);
      return new NextResponse(exactArrayBuffer(audio), {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Content-Length": String(audio.byteLength),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } finally {
      lease.release();
    }
  } catch (error) {
    return publicError(error);
  }
}
