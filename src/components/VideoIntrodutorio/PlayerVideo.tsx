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
 */
export function PlayerVideo({ url, className }: PlayerVideoProps) {
  return (
    <div className={`rounded-2xl overflow-hidden bg-black ${className ?? ""}`} style={{ border: "1px solid rgba(99,102,241,0.15)" }}>
      <video
        key={url}
        src={url}
        controls
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full bg-black"
      />
    </div>
  );
}
