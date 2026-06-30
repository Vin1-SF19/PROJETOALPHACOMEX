import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { askOnyxOneShot } from "@/lib/onyx/client";

export const runtime = "nodejs";

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

  // ── Busca nova via Onyx (mesmo modelo do dropdown) ───────────────────────
  let curiosidade: string;
  try {
    const prompt = `Diga uma curiosidade surpreendente e pouco conhecida sobre: ${topic}. Responda APENAS com a curiosidade, sem saudação, sem "Sabia que", sem markdown, sem bullet. Máximo 2 frases curtas em português brasileiro.`;
    const raw = await askOnyxOneShot(prompt, 0, 25_000);
    curiosidade = raw
      .replace(/^[-*•]\s*/gm, "")
      .replace(/\*\*/g, "")
      .replace(/<\/?think>/g, "")
      .replace(/\n+/g, " ")
      .trim();
  } catch (err) {
    console.error("[BIBBLE/CURIOSIDADE] Onyx unreachable:", err);
    return NextResponse.json({ error: "Onyx indisponível" }, { status: 502 });
  }

  if (!curiosidade) {
    return NextResponse.json({ error: "Resposta vazia" }, { status: 500 });
  }

  // ── Salva no cache com shown = 1 ──────────────────────────────────────────
  if (!cache[topic]) cache[topic] = { entries: [] };
  cache[topic].entries.push({ text: curiosidade, shown: 1 });
  void writeCache(cache);

  return NextResponse.json({ curiosidade, topic });
}
