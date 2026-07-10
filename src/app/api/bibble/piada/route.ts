import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

// Remove tags de markup que o modelo às vezes vaza na resposta (ex.: "/blockquote>"
// sem o "<" de abertura, cortado pelo próprio streaming/token do LLM).
const HTML_TAG_LEAK_RE = /<?\/?(?:blockquote|quote|p|br|div|span|b|i|em|strong|ul|li|ol|code|pre|h[1-6])\s*>/gi;

// ── Cache ────────────────────────────────────────────────────────────────────

const CACHE_PATH = path.join(process.cwd(), ".bibble", "piadas-cache.json");
const MAX_SHOWN  = 4; // repete cada piada até N vezes antes de buscar nova

interface CacheEntry { text: string; shown: number; }
interface Cache { entries: CacheEntry[] }

async function readCache(): Promise<Cache> {
  try {
    const raw = await readFile(CACHE_PATH, "utf-8");
    return JSON.parse(raw) as Cache;
  } catch {
    return { entries: [] };
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
  // ── Verifica cache ────────────────────────────────────────────────────────
  const cache = await readCache();
  const available = cache.entries.filter((e) => e.shown < MAX_SHOWN);

  if (available.length > 0) {
    const entry = available[Math.floor(Math.random() * available.length)];
    entry.shown++;
    void writeCache(cache); // non-blocking
    return NextResponse.json({ piada: entry.text, cached: true });
  }

  // ── Busca nova via Ollama ─────────────────────────────────────────────────
  const ollamaUrl = process.env.BIBBLE_OLLAMA_URL ?? "http://localhost:11434";
  const model     = process.env.BIBBLE_CURIOSIDADE_MODEL ?? "gemma4:e4b";

  let r: Response;
  try {
    r = await fetch(`${ollamaUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Você é um gerador de piadas curtas e propositalmente bestas/ruins (aquelas tão sem graça que acabam sendo engraçadas — tipo piada de pai, trocadilho bobo). Responda APENAS com a piada, sem saudação, sem explicação, sem markdown, sem bullet. Máximo 2 frases curtas em português brasileiro.",
          },
          {
            role: "user",
            content: "Conta uma piada curta e besta, dessas ruins de propósito.",
          },
        ],
        stream: false,
        temperature: 1.0,
        max_tokens: 90,
      }),
      signal: AbortSignal.timeout(28_000),
    });
  } catch (err) {
    console.error("[BIBBLE/PIADA] Ollama unreachable:", err);
    return NextResponse.json({ error: "Ollama indisponível" }, { status: 502 });
  }

  if (!r.ok) {
    const body = await r.text().catch(() => "");
    console.error("[BIBBLE/PIADA] Ollama error:", r.status, body);
    return NextResponse.json({ error: "Falha no Ollama" }, { status: 502 });
  }

  const data = (await r.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
  const piada = raw
    .replace(/^[-*•]\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(HTML_TAG_LEAK_RE, "")
    .replace(/\n+/g, " ")
    .trim();

  if (!piada) {
    return NextResponse.json({ error: "Resposta vazia" }, { status: 500 });
  }

  // ── Salva no cache com shown = 1 ──────────────────────────────────────────
  cache.entries.push({ text: piada, shown: 1 });
  void writeCache(cache);

  return NextResponse.json({ piada });
}
