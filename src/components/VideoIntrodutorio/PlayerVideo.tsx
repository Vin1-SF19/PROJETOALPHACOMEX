"use client";

interface PlayerVideoProps {
  url: string;
  className?: string;
}

/**
 * Wrapper simples de <video> nativo — replica o padrão já usado em
 * OnboardingModal.tsx (controls + controlsList="nodownload" + bloqueia
 * menu de contexto). Vídeos do Alpha Skills são sempre upload direto via
 * Vercel Blob, nunca embed externo (ver decisions.md, 2026-07-14).
 *
 * `aspect-video` é o padrão base (não apenas um extra do chamador): o
 * `<video>` interno usa `h-full` do container, e sem uma proporção própria
 * definida o container colapsa para altura 0 dentro de um `overflow-hidden`
 * — o vídeo carrega mas fica com área de renderização instável/nula,
 * aparentando estar "travado". Um `className` externo (ex: `max-h-[65vh]`)
 * só limita o teto, nunca deve remover a proporção base.
 */
export function PlayerVideo({ url, className }: PlayerVideoProps) {
  return (
    <video
      key={url}
      src={url}
      controls
      playsInline
      preload="metadata"
      controlsList="nodownload"
      onContextMenu={(e) => e.preventDefault()}
      className={`aspect-video w-full rounded-2xl bg-black ${className ?? ""}`}
      style={{ border: "1px solid rgba(99,102,241,0.15)" }}
    />
  );
}
