import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { auth } from "../../../../../auth";
import { acquireBibbleLease } from "@/lib/bibble/admission-control";
import { getBibbleRuntimeConfig } from "@/lib/bibble/runtime-config";
import { getOllamaHeaders } from "@/lib/bibble/client";

export const runtime = "nodejs";

// Remove tags de markup que o modelo às vezes vaza na resposta (ex.: "/blockquote>"
// sem o "<" de abertura, cortado pelo próprio streaming/token do LLM).
const HTML_TAG_LEAK_RE = /<?\/?(?:blockquote|quote|p|br|div|span|b|i|em|strong|ul|li|ol|code|pre|h[1-6])\s*>/gi;

// ── Cache ────────────────────────────────────────────────────────────────────

const CACHE_PATH = path.join(process.cwd(), ".bibble", "curiosidades-cache.json");
const MAX_SHOWN  = 4; // repete cada curiosidade até N vezes antes de buscar nova

interface CacheEntry { text: string; shown: number; }
interface Cache { [topic: string]: { entries: CacheEntry[] } }

async function readCache(): Promise<Cache> {
  try {
    const raw = await readFile(CACHE_PATH, "utf-8");
    return JSON.parse(raw) as Cache;
  } catch {
    return {};
  }
}

async function writeCache(cache: Cache): Promise<void> {
  try {
    await mkdir(path.dirname(CACHE_PATH), { recursive: true });
    await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
  } catch { /* best-effort */ }
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ── Lê tópicos (aceita "- " e "* ") ─────────────────────────────────────
  let content: string;
  try {
    content = await readFile(path.join(process.cwd(), "bibble-topicos.md"), "utf-8");
  } catch {
    return NextResponse.json({ error: "bibble-topicos.md não encontrado" }, { status: 404 });
  }

  const topics = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- ") || l.startsWith("* "))
    .map((l) => l.slice(2).trim())
    .filter(Boolean);

  if (topics.length === 0) {
    return NextResponse.json({ error: "Nenhum tópico configurado" }, { status: 404 });
  }

  const topic = topics[Math.floor(Math.random() * topics.length)];

  // ── Verifica cache ────────────────────────────────────────────────────────
  const cache = await readCache();
  const topicData = cache[topic] ?? { entries: [] };
  const available = topicData.entries.filter((e) => e.shown < MAX_SHOWN);

  if (available.length > 0) {
    const entry = available[Math.floor(Math.random() * available.length)];
    entry.shown++;
    cache[topic] = topicData;
    void writeCache(cache); // non-blocking
    return NextResponse.json({ curiosidade: entry.text, topic, cached: true });
  }

  // ── Busca nova via Ollama ─────────────────────────────────────────────────
  const lease = acquireBibbleLease(`curiosidade:${session.user.id}`);
  if (!lease) return NextResponse.json({ error: "Muitas solicitações. Tente novamente em instantes.", retryable: true }, { status: 429, headers: { "Retry-After": "10" } });
  const runtime = getBibbleRuntimeConfig();
  const ollamaUrl = runtime.endpoint.toString().replace(/\/$/, '');
  const model = process.env.BIBBLE_CURIOSIDADE_MODEL ?? runtime.model;

  let r: Response;
  try {
    r = await fetch(`${ollamaUrl}/v1/chat/completions`, {
      method: "POST",
      headers: getOllamaHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Você é um gerador de curiosidades concisas. Responda APENAS com a curiosidade, sem saudação, sem 'Sabia que', sem markdown, sem bullet. Máximo 2 frases curtas em português brasileiro.",
          },
          {
            role: "user",
            content: `Diga uma curiosidade surpreendente e pouco conhecida sobre: ${topic}`,
          },
        ],
        stream: false,
        temperature: 0.7,
        max_tokens: 110,
      }),
      signal: AbortSignal.timeout(28_000),
    });
  } catch {
    console.error("[BIBBLE/CURIOSIDADE] provider-unavailable");
    lease.release();
    return NextResponse.json({ error: "Ollama indisponível" }, { status: 502 });
  }

  lease.release();

  if (!r.ok) {
    await r.body?.cancel().catch(() => undefined);
    console.error("[BIBBLE/CURIOSIDADE] provider-error", { status: r.status });
    return NextResponse.json({ error: "Falha no Ollama" }, { status: 502 });
  }

  const data = (await r.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
  const curiosidade = raw
    .replace(/^[-*•]\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(HTML_TAG_LEAK_RE, "")
    .replace(/\n+/g, " ")
    .trim();

  if (!curiosidade) {
    return NextResponse.json({ error: "Resposta vazia" }, { status: 500 });
  }

  // ── Salva no cache com shown = 1 ──────────────────────────────────────────
  if (!cache[topic]) cache[topic] = { entries: [] };
  cache[topic].entries.push({ text: curiosidade, shown: 1 });
  void writeCache(cache);

  return NextResponse.json({ curiosidade, topic });
}
