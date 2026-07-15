import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { PIADAS_BANK } from "@/lib/bibble/piadas-bank";

export const runtime = "nodejs";

// ── Cache de rotação ─────────────────────────────────────────────────────────
// Guarda os índices do banco já exibidos no ciclo atual. Uma piada só volta a
// aparecer depois que TODAS as outras do banco já foram mostradas.

const CACHE_PATH = path.join(process.cwd(), ".bibble", "piadas-cache.json");

interface Cache { vistos: number[] }

async function readCache(): Promise<Cache> {
  try {
    const raw = await readFile(CACHE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Cache>;
    if (Array.isArray(parsed.vistos)) {
      // Descarta índices inválidos (banco pode ter mudado de tamanho)
      const vistos = parsed.vistos.filter(
        (i): i is number => Number.isInteger(i) && i >= 0 && i < PIADAS_BANK.length,
      );
      return { vistos };
    }
  } catch { /* primeiro uso ou formato antigo (era { entries: [...] }) */ }
  return { vistos: [] };
}

async function writeCache(cache: Cache): Promise<void> {
  try {
    await mkdir(path.dirname(CACHE_PATH), { recursive: true });
    await writeFile(CACHE_PATH, JSON.stringify(cache), "utf-8");
  } catch { /* best-effort */ }
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const cache = await readCache();

  // Ciclo completo: reinicia mantendo só a última exibida, para não repetir
  // a mesma piada duas vezes seguidas na virada do ciclo.
  if (cache.vistos.length >= PIADAS_BANK.length) {
    const ultima = cache.vistos[cache.vistos.length - 1];
    cache.vistos = ultima !== undefined ? [ultima] : [];
  }

  const vistosSet = new Set(cache.vistos);
  const disponiveis: number[] = [];
  for (let i = 0; i < PIADAS_BANK.length; i++) {
    if (!vistosSet.has(i)) disponiveis.push(i);
  }

  const idx = disponiveis[Math.floor(Math.random() * disponiveis.length)];
  cache.vistos.push(idx);
  void writeCache(cache); // non-blocking

  return NextResponse.json({ piada: PIADAS_BANK[idx] });
}
