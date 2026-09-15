import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { getOllamaHeaders } from "@/lib/bibble/client";
import { getBibbleRuntimeConfig } from "@/lib/bibble/runtime-config";

export const dynamic = "force-dynamic";

interface OpenAICompatModel {
  id: string;
  meta?: { size?: number; n_params?: number; ftype?: string };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let ollamaUrl: string;
  try {
    ollamaUrl = getBibbleRuntimeConfig().endpoint.toString().replace(/\/$/, "");
  } catch {
    return NextResponse.json({ models: [], error: "Configuração do servidor local inválida" }, { status: 503 });
  }

  try {
    // llama.cpp (substituiu o Ollama) não implementa `/api/tags` — usa o
    // endpoint OpenAI-compat `/v1/models`.
    const res = await fetch(`${ollamaUrl}/v1/models`, {
      signal: AbortSignal.timeout(5000),
      headers: getOllamaHeaders({ Accept: "application/json" }),
    });

    if (!res.ok) {
      return NextResponse.json({ models: [], error: `Servidor local retornou ${res.status}` });
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
    });
  } catch {
    return NextResponse.json({ models: [], error: "Servidor local indisponível" });
  }
}
