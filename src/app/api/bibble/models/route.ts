import { acessoEstaIndisponivel, mapearIndisponibilidadeAuth } from "@/lib/auth/indisponibilidade";
import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { getOllamaHeaders } from "@/lib/bibble/client";
import { getBibbleRuntimeConfig } from "@/lib/bibble/runtime-config";
import { codigoFalhaUpstream, respostaIndisponibilidadeIA } from "@/lib/ai-unavailability";
import { comPrazoHttp } from "@/lib/http-deadline";

export const dynamic = "force-dynamic";

interface OpenAICompatModel {
  id: string;
  meta?: { size?: number; n_params?: number; ftype?: string };
}

export async function GET(request: Request) {
  try {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let ollamaUrl: string;
  try {
    ollamaUrl = getBibbleRuntimeConfig().endpoint.toString().replace(/\/$/, "");
  } catch (authError) {
    if (acessoEstaIndisponivel(authError)) throw authError;
    return respostaIndisponibilidadeIA("AI_CONFIGURATION_UNAVAILABLE", 503, { models: [] });
  }

  try {
    // llama.cpp (substituiu o Ollama) não implementa `/api/tags` — usa o
    // endpoint OpenAI-compat `/v1/models`.
    return await comPrazoHttp(5_000, request.signal, async (signal) => {
    const res = await fetch(`${ollamaUrl}/v1/models`, {
      signal, cache: "no-store", redirect: "error",
      headers: getOllamaHeaders({ Accept: "application/json" }),
    });

    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      return respostaIndisponibilidadeIA(res.status === 429 ? "AI_RATE_LIMITED" : "AI_UPSTREAM_UNAVAILABLE", res.status === 429 || res.status === 503 ? res.status : 502, { models: [] });
    }

    const data = await res.json() as { data: OpenAICompatModel[] };

    const runtime = getBibbleRuntimeConfig();
    return NextResponse.json({
      models: (data.data ?? []).map(m => ({
        id: m.id,
        label: m.id,
        size: m.meta?.size ?? null,
        paramSize: m.meta?.n_params ?? null,
        family: m.meta?.ftype ?? null,
      })),
      configured: true,
      capabilities: { contextWindow: runtime.contextWindow, outputTokenLimit: runtime.outputTokenLimit },
    }, { headers: { "Cache-Control": "private, no-store" } });
    });
  } catch (authError) {
    if (acessoEstaIndisponivel(authError)) throw authError;
    const code = codigoFalhaUpstream(authError);
    return respostaIndisponibilidadeIA(code, code === "AI_UPSTREAM_TIMEOUT" ? 504 : 502, { models: [] });
  }

  } catch (authError) {
    const unavailable = mapearIndisponibilidadeAuth(authError);
    if (unavailable) return unavailable;
    throw authError;
  }
}
