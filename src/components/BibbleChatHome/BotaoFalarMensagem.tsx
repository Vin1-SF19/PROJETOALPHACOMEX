"use client";

import { useState, useRef } from "react";
import { Volume2, Loader2, Square } from "lucide-react";
import { useVoiceStatus } from "./useVoiceStatus";

/** Remove markdown/imagens do texto antes de falar. */
function limparParaFala(texto: string): string {
  return texto
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/```[\s\S]*?```/g, " (bloco de código) ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[#*_>~]/g, "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function BotaoFalarMensagem({ texto, accent = "99, 102, 241" }: { texto: string; accent?: string }) {
  const { tts_enabled, loaded, nativeMode } = useVoiceStatus();
  const [estado, setEstado] = useState<"idle" | "carregando" | "tocando">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  if (!loaded || !tts_enabled) return null;

  const parar = () => {
    if (nativeMode) {
      window.speechSynthesis?.cancel();
    } else {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
    }
    setEstado("idle");
  };

  const falarNativo = (fala: string) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(fala.slice(0, 5000));
    utter.lang = "pt-BR";
    utter.rate = 1.05;
    utteranceRef.current = utter;
    utter.onstart = () => setEstado("tocando");
    utter.onend = () => setEstado("idle");
    utter.onerror = () => setEstado("idle");
    window.speechSynthesis.speak(utter);
    setEstado("tocando");
  };

  const falarOnyx = async (fala: string) => {
    setEstado("carregando");
    try {
      const res = await fetch("/api/onyx/voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fala.slice(0, 5000) }),
      });
      if (!res.ok) throw new Error(String(res.status));

      const ct = res.headers.get("content-type") ?? "";
      let url: string;
      if (ct.includes("application/json")) {
        const data = (await res.json()) as { url?: string };
        if (!data.url) throw new Error("sem áudio");
        url = data.url;
      } else {
        url = URL.createObjectURL(await res.blob());
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setEstado("idle"); if (url.startsWith("blob:")) URL.revokeObjectURL(url); };
      audio.onerror = () => setEstado("idle");
      await audio.play();
      setEstado("tocando");
    } catch {
      // Onyx falhou → fallback para modo nativo
      falarNativo(fala);
    }
  };

  const falar = async () => {
    if (estado === "tocando") { parar(); return; }
    const fala = limparParaFala(texto);
    if (!fala) return;

    if (nativeMode) {
      falarNativo(fala);
    } else {
      await falarOnyx(fala);
    }
  };

  return (
    <button
      onClick={falar}
      title={estado === "tocando" ? "Parar" : "Ouvir resposta"}
      aria-label={estado === "tocando" ? "Parar áudio" : "Ouvir resposta em voz"}
      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-all duration-150 hover:brightness-125"
      style={{ color: estado !== "idle" ? `rgba(${accent},1)` : "#64748b" }}
    >
      {estado === "carregando" ? <Loader2 size={11} className="animate-spin" />
        : estado === "tocando" ? <Square size={11} fill="currentColor" />
        : <Volume2 size={11} />}
      {estado === "tocando" ? "PARAR" : "OUVIR"}
    </button>
  );
}
