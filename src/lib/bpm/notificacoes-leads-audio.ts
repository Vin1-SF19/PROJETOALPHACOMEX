import type { AlertaLeadBpm } from "@/lib/bpm/notificacoes-leads";

export function arquivoAudioLeadBpm(origem: AlertaLeadBpm["origem"]): string | null {
  if (origem === "INSTAGRAM") return "/sounds/notificacao-lead-insta.mp3";
  if (origem === "SITE") return "/sounds/notificacao-lead-site.mp3";
  return null;
}

/** Uma reprodução por lifecycle, sem fila ou tentativa posterior ao bloqueio de autoplay. */
export function criarAudioNotificacoesLeadsBpm() {
  let atual: HTMLAudioElement | null = null;
  let liberarAtual: (() => void) | undefined;
  let encerrado = false;
  const parar = () => { liberarAtual?.(); };

  function tocar(origem: AlertaLeadBpm["origem"]) {
    const arquivo = arquivoAudioLeadBpm(origem);
    if (encerrado || !arquivo) return;
    parar();
    if (typeof Audio !== "function") return;
    try {
      const audio = new Audio(arquivo);
      const liberar = () => {
        if (atual !== audio) return;
        atual = null;
        liberarAtual = undefined;
        audio.removeEventListener("ended", liberar);
        audio.removeEventListener("error", liberar);
        try { audio.pause(); audio.currentTime = 0; } catch { /* Mídia já indisponível. */ }
        try { audio.removeAttribute("src"); audio.load(); } catch { /* Liberação sem API de mídia. */ }
      };
      atual = audio;
      liberarAtual = liberar;
      audio.addEventListener("ended", liberar);
      audio.addEventListener("error", liberar);
      audio.volume = 0.6;
      void audio.play().catch(liberar);
    } catch { parar(); }
  }

  return { tocar, parar, limpar: () => { encerrado = true; parar(); } };
}
