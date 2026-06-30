"use client";

import { useState, useRef } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { useVoiceStatus } from "./useVoiceStatus";

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionAlternative = {
  transcript: string;
};

function criarSpeechRecognition(): SpeechRecognitionInstance | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const SR = w["SpeechRecognition"] || w["webkitSpeechRecognition"];
  if (!SR) return null;
  return new (SR as new () => SpeechRecognitionInstance)();
}

/**
 * Botão de microfone: grava voz e transcreve.
 * Usa Web Speech API (nativeMode) ou Onyx STT conforme disponibilidade.
 */
export function BotaoMicrofone({ onTranscrito, accent = "99, 102, 241", disabled }: {
  onTranscrito: (texto: string) => void;
  accent?: string;
  disabled?: boolean;
}) {
  const { stt_enabled, loaded, nativeMode } = useVoiceStatus();
  const [estado, setEstado] = useState<"idle" | "gravando" | "transcrevendo">("idle");

  // Para modo Onyx (MediaRecorder)
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Para modo nativo (SpeechRecognition)
  const srRef = useRef<SpeechRecognitionInstance | null>(null);

  if (!loaded || !stt_enabled) return null;

  /* ── Modo nativo: Web Speech API ── */
  const iniciarNativo = () => {
    const sr = criarSpeechRecognition();
    if (!sr) return;
    srRef.current = sr;
    sr.lang = "pt-BR";
    sr.interimResults = false;
    sr.maxAlternatives = 1;

    sr.onresult = (e: SpeechRecognitionEvent) => {
      const texto = e.results[0]?.[0]?.transcript?.trim();
      if (texto) onTranscrito(texto);
    };
    sr.onerror = () => setEstado("idle");
    sr.onend = () => setEstado("idle");

    sr.start();
    setEstado("gravando");
  };

  const pararNativo = () => {
    srRef.current?.stop();
    setEstado("idle");
  };

  /* ── Modo Onyx: MediaRecorder + STT endpoint ── */
  const pararStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const iniciarOnyx = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        pararStream();
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size === 0) { setEstado("idle"); return; }

        setEstado("transcrevendo");
        try {
          const form = new FormData();
          form.append("audio", blob, "fala.webm");
          const res = await fetch("/api/onyx/voice/transcribe", { method: "POST", body: form });
          if (res.ok) {
            const { text } = (await res.json()) as { text?: string };
            if (text?.trim()) onTranscrito(text.trim());
            else iniciarNativo(); // fallback: Onyx retornou vazio → tenta nativo
          } else {
            // Onyx falhou → tenta nativo
            iniciarNativo();
          }
        } catch {
          iniciarNativo();
        } finally {
          setEstado("idle");
        }
      };

      rec.start();
      setEstado("gravando");
    } catch {
      // Sem microfone ou permissão negada
      setEstado("idle");
    }
  };

  const pararOnyx = () => {
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
  };

  /* ── Handlers unificados ── */
  const onClick = () => {
    if (estado === "gravando") {
      if (nativeMode) pararNativo();
      else pararOnyx();
    } else if (estado === "idle") {
      if (nativeMode) iniciarNativo();
      else void iniciarOnyx();
    }
  };

  const gravando = estado === "gravando";
  const transcrevendo = estado === "transcrevendo";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || transcrevendo}
      title={gravando ? "Parar gravação" : "Falar com o agente"}
      aria-label={gravando ? "Parar gravação" : "Gravar voz"}
      className="p-2 rounded-lg transition-all duration-150 shrink-0 disabled:opacity-40"
      style={{
        color: gravando ? "#f87171" : transcrevendo ? `rgba(${accent},1)` : "#64748b",
        background: gravando ? "rgba(239,68,68,0.12)" : "transparent",
      }}
    >
      {transcrevendo ? <Loader2 size={15} className="animate-spin" />
        : gravando ? <Square size={13} fill="currentColor" className="animate-pulse" />
        : <Mic size={15} />}
    </button>
  );
}
