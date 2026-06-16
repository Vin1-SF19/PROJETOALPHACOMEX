import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";

export const dynamic = "force-dynamic";

interface OllamaModel {
  name: string;
  size: number;
  details?: { parameter_size?: string; family?: string };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ollamaUrl = (searchParams.get("url") || process.env.BIBBLE_OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");

  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json({ models: [], error: `Ollama retornou ${res.status}`, baseUrl: ollamaUrl });
    }

    const data = await res.json() as { models: OllamaModel[] };

    return NextResponse.json({
      models: (data.models ?? []).map(m => ({
        id: m.name,
        label: m.name,
        size: m.size,
        paramSize: m.details?.parameter_size ?? null,
        family: m.details?.family ?? null,
      })),
      baseUrl: ollamaUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "timeout";
    return NextResponse.json({ models: [], error: msg, baseUrl: ollamaUrl });
  }
}
