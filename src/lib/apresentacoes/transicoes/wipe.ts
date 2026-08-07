export const WIPE_TIPOS = [
  "wipe-left",
  "wipe-right",
  "wipe-up",
  "wipe-down",
  "wipe-center",
  "wipe-horizontal",
  "wipe-vertical",
  "radial-wipe",
] as const;
export type WipeTipo = (typeof WIPE_TIPOS)[number];

/**
 * Fase 05 — Seção 4 do prompt original: Wipe "deve usar máscaras ou `clip-path`, sem
 * deformar o conteúdo". `progresso` vai de 0 (totalmente fechado/oculto) a 1 (totalmente
 * revelado) — interpolável pelo Framer Motion como string animável de `clipPath`.
 */
export function clipPathParaWipe(tipo: WipeTipo, progresso: number): string {
  const p = Math.min(1, Math.max(0, progresso));
  const pct = p * 100;

  switch (tipo) {
    case "wipe-left":
      return `inset(0 ${100 - pct}% 0 0)`;
    case "wipe-right":
      return `inset(0 0 0 ${100 - pct}%)`;
    case "wipe-up":
      return `inset(${100 - pct}% 0 0 0)`;
    case "wipe-down":
      return `inset(0 0 ${100 - pct}% 0)`;
    case "wipe-center": {
      const metade = (100 - pct) / 2;
      return `inset(0 ${metade}% 0 ${metade}%)`;
    }
    case "wipe-horizontal": {
      const metade = (100 - pct) / 2;
      return `inset(${metade}% 0 ${metade}% 0)`;
    }
    case "wipe-vertical": {
      const metade = (100 - pct) / 2;
      return `inset(0 ${metade}% 0 ${metade}%)`;
    }
    case "radial-wipe":
      return `circle(${pct}% at 50% 50%)`;
    default:
      // Fallback seguro (Seção 29) — nunca deforma, apenas não revela nada até o fim.
      return `inset(0 ${100 - pct}% 0 0)`;
  }
}
