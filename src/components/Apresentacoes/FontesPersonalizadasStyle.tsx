import { cssDasFontesPersonalizadas, type FontePersonalizada } from "@/lib/apresentacoes/fontes-personalizadas";

export function FontesPersonalizadasStyle({ fontes }: { fontes: FontePersonalizada[] }) {
  if (fontes.length === 0) return null;
  return <style data-alpha-motion-fontes-personalizadas>{cssDasFontesPersonalizadas(fontes)}</style>;
}
