"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, Volume2, VolumeX } from "lucide-react";

import { cleanBibbleSpeechText, releaseBibbleSpeech, requestBibbleSpeech } from "@/lib/bibble/voice-client";
import { bibbleAudioManager, type BibbleAudioState } from "./bibble-audio-manager";
import { useVoiceStatus } from "./useVoiceStatus";

interface BotaoFalarMensagemProps {
  messageId: string;
  texto: string;
  autoPlay?: boolean;
  visible?: boolean;
  accent?: string;
}

export function BotaoFalarMensagem({
  messageId,
  texto,
  autoPlay = false,
  visible = true,
  accent = "99, 102, 241",
}: BotaoFalarMensagemProps) {
  const { tts_enabled, loaded, modelLoaded } = useVoiceStatus();
  const [state, setState] = useState<BibbleAudioState>("idle");
  const blobRef = useRef<Blob | null>(null);
  const autoPlayAttemptedRef = useRef(false);

  const play = useCallback(async (automatic = false) => {
    if (state === "playing") {
      bibbleAudioManager.pause(messageId);
      return;
    }
    if (state === "paused" && await bibbleAudioManager.resume(messageId)) return;

    const speechText = cleanBibbleSpeechText(texto);
    if (!speechText) return;
    try {
      if (!blobRef.current) {
        setState("loading");
        blobRef.current = await requestBibbleSpeech(messageId, speechText);
      }
      setState("ready");
      const played = await bibbleAudioManager.play(messageId, blobRef.current, setState);
      // Bloqueio de autoplay é comportamento normal do navegador, não erro técnico.
      if (!played && !automatic) setState("ready");
    } catch {
      setState("error");
    }
  }, [messageId, state, texto]);

  useEffect(() => () => {
    bibbleAudioManager.stop(messageId);
    releaseBibbleSpeech(messageId);
  }, [messageId]);

  useEffect(() => {
    if (!autoPlay || !loaded || !tts_enabled || autoPlayAttemptedRef.current) return;
    autoPlayAttemptedRef.current = true;
    void play(true);
  }, [autoPlay, loaded, play, tts_enabled]);

  if (!visible || !loaded) return null;

  const unavailable = !tts_enabled;
  const label = unavailable
    ? "Tentar voz do Bibble"
    : state === "loading"
      ? modelLoaded ? "Gerando áudio..." : "Preparando voz do Bibble..."
      : state === "playing"
        ? "Pausar voz"
        : state === "paused"
          ? "Continuar voz"
          : state === "error"
            ? "Tentar gerar voz novamente"
            : "Ouvir resposta";

  return (
    <button
      type="button"
      onClick={() => void play(false)}
      disabled={state === "loading"}
      title={label}
      aria-label={label}
      aria-pressed={state === "playing"}
      className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-all duration-150 hover:brightness-125 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-45"
      style={{ color: !unavailable && state !== "idle" ? `rgba(${accent},1)` : undefined }}
    >
      {state === "loading" ? <Loader2 size={11} className="animate-spin" aria-hidden />
        : unavailable ? <VolumeX size={11} aria-hidden />
        : state === "playing" ? <Pause size={11} aria-hidden />
        : state === "paused" || state === "ready" ? <Play size={11} aria-hidden />
        : <Volume2 size={11} aria-hidden />}
      {state === "loading" ? (modelLoaded ? "GERANDO" : "PREPARANDO")
        : state === "playing" ? "PAUSAR"
        : state === "paused" ? "CONTINUAR"
        : state === "error" ? "TENTAR"
        : "OUVIR"}
    </button>
  );
}
