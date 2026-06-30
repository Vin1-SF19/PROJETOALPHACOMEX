"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Fala { mood: string; fala: string; }
type TimeSlot = "madrugada" | "manha" | "tarde" | "noite_cedo" | "noite";
interface Ctx { temp: number | null; hour: number; timeSlot: TimeSlot; isWeekend: boolean; }

// ── Sprites ────────────────────────────────────────────────────────────────────

const SPRITE_MAP: Record<string, string> = {
  // base — sprites neutros/normais (o arquivo de falas usa pt e en)
  happy:             "/assets/bibble/sprites/happy.png",
  pensando:          "/assets/bibble/sprites/pensando.png",
  thinking:          "/assets/bibble/sprites/pensando.png",
  relaxando:         "/assets/bibble/sprites/relaxando.png",
  relaxing:          "/assets/bibble/sprites/relaxando.png",
  sad:               "/assets/bibble/sprites/sad.png",
  frio:              "/assets/bibble/sprites/frio.png",
  cold:              "/assets/bibble/sprites/frio.png",
  escondido:         "/assets/bibble/sprites/escondido.png",
  hidden:            "/assets/bibble/sprites/escondido.png",
  walking:           "/assets/bibble/sprites/relaxando.png",
  "serious-walking": "/assets/bibble/sprites/relaxando.png",
  "walking-serius":  "/assets/bibble/sprites/relaxando.png",

  // EXCLUSIVO do setor "Anti-Guaxinim" — moods bravo-* só existem nessas falas
  "bravo-puto":      "/assets/bibble/sprites/bravo/putodavida.png",
  "bravo-chateado":  "/assets/bibble/sprites/bravo/chateado.png",
  "bravo-magoado":   "/assets/bibble/sprites/bravo/magoei.png",
  "bravo-chega":     "/assets/bibble/sprites/bravo/chega.png",
  "bravo-naomais":   "/assets/bibble/sprites/bravo/naoqueromais.png",
  "bravo-affs":      "/assets/bibble/sprites/bravo/affs.png",

  // EXCLUSIVO do tema "Copa 2026" — moods copa-* (pasta copa)
  "copa-tranquilo":  "/assets/bibble/sprites/copa/tranquilo.png",
  "copa-serio":      "/assets/bibble/sprites/copa/serio.png",
};

function spriteFor(mood: string): string {
  return SPRITE_MAP[mood] ?? SPRITE_MAP.relaxando;
}

// ── Falas de contexto ──────────────────────────────────────────────────────────

function buildContextFalas(ctx: Ctx): Fala[] {
  const { temp, hour, timeSlot, isWeekend } = ctx;
  const result: Fala[] = [];

  if (temp !== null) {
    const t = Math.round(temp);
    if (temp < 14) {
      result.push(
        { mood: "frio", fala: `Faz ${t}°C lá fora. Eu sou digital mas travei um pouco.` },
        { mood: "frio", fala: `${t}°C. Isso não é frio, isso é conspiração.` },
        { mood: "frio", fala: `Já puxei minha coberta virtual. ${t}°C não é brincadeira.` },
      );
    } else if (temp < 18) {
      result.push(
        { mood: "frio", fala: `${t}°C. Fresco assim apaga a vontade de trabalhar, não?` },
        { mood: "frio", fala: `Com ${t}°C eu esperava um chocolate quente no sistema.` },
      );
    } else if (temp > 33) {
      result.push(
        { mood: "sad", fala: `${t}°C. Isso é temperatura de assar servidor.` },
        { mood: "sad", fala: `${t}°C e ninguém liga o ar. Parceria suspeita.` },
      );
    } else if (temp > 28) {
      result.push(
        { mood: "sad",       fala: `${t}°C. Meu processador mandou um email de reclamação.` },
        { mood: "relaxando", fala: `${t}°C. Quente mas suportável. Igual esse sistema.` },
      );
    }
  }

  if (timeSlot === "madrugada") {
    result.push(
      { mood: "escondido", fala: `São ${hour}h da manhã. Isso precisava mesmo ser agora?` },
      { mood: "escondido", fala: "A essa hora até eu quero dormir. E eu nem durmo." },
      { mood: "sad",       fala: `Você tá bem? Pergunto sem julgamento. São ${hour}h.` },
    );
  }
  if (timeSlot === "manha" && hour < 8) {
    result.push(
      { mood: "happy", fala: "Cedo assim? Respeito. Tô aqui desde antes." },
      { mood: "happy", fala: "Bom dia! Ou quase isso, pelo menos." },
    );
  }
  if (timeSlot === "noite_cedo") {
    result.push(
      { mood: "sad",       fala: `Já passou das ${hour}h. A empresa fecha, eu não. Infelizmente.` },
      { mood: "relaxando", fala: "Horário de expediente encerrado. Eu fico de plantão. Sem escolha." },
      { mood: "sad",       fala: "Não vai parar de trabalhar não? Eu também quero descansar." },
    );
  }
  if (timeSlot === "noite") {
    result.push(
      { mood: "escondido", fala: `${hour}h da noite. Isso vai no relatório de horas extras.` },
      { mood: "sad",       fala: "Eu não canso. Mas você deveria ter ido embora há horas." },
    );
  }
  if (isWeekend) {
    result.push(
      { mood: "pensando",  fala: "É fim de semana. Por que nós dois ainda estamos aqui?" },
      { mood: "sad",       fala: "Sábado ou domingo trabalhando? Isso vai pro meu diário." },
      { mood: "relaxando", fala: "Fim de semana é sagrado. Disse quem, mas é." },
    );
  }

  return result;
}

function interleaveFalas(base: Fala[], ctx: Fala[], step = 2): Fala[] {
  if (ctx.length === 0) return base;
  const out: Fala[] = [];
  let ci = 0;
  for (let i = 0; i < base.length; i++) {
    out.push(base[i]);
    if ((i + 1) % step === 0) { out.push(ctx[ci % ctx.length]); ci++; }
  }
  return out;
}

// ── Weather ────────────────────────────────────────────────────────────────────

const WEATHER_CACHE_KEY = "bibble_sprite_weather_v1";
const WEATHER_TTL       = 10 * 60 * 1000;

async function fetchCtx(): Promise<Ctx> {
  const now = new Date();
  const hour = now.getHours();
  const day  = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const timeSlot: TimeSlot =
    hour < 6  ? "madrugada"  :
    hour < 12 ? "manha"      :
    hour < 18 ? "tarde"      :
    hour < 21 ? "noite_cedo" : "noite";

  let temp: number | null = null;
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (raw) {
      const { temperature, ts } = JSON.parse(raw) as { temperature: number; ts: number };
      if (Date.now() - ts < WEATHER_TTL) return { temp: temperature, hour, timeSlot, isWeekend };
    }
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: WEATHER_TTL }),
    );
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current=temperature_2m&timezone=auto`,
    );
    if (r.ok) {
      const data = await r.json() as { current?: { temperature_2m?: number } };
      temp = data.current?.temperature_2m ?? null;
      if (temp !== null)
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ temperature: temp, ts: Date.now() }));
    }
  } catch { /* sem clima */ }

  return { temp, hour, timeSlot, isWeekend };
}

// ── Fallback falas ─────────────────────────────────────────────────────────────

const FALLBACK_FALAS: Fala[] = [
  { mood: "happy",     fala: "Sim, tô aqui. Como sempre. Surpreso?" },
  { mood: "relaxando", fala: "Pode perguntar. Pior que vou saber é improvável." },
  { mood: "pensando",  fala: "CNPJ, cliente, chamado... escolhe o sofrimento." },
  { mood: "pensando",  fala: "Meta do mês? Posso calcular. Atingir? Aí é com vocês." },
  { mood: "frio",      fala: "Conectado. Monitorando. Levemente entediado." },
  { mood: "relaxando", fala: "Não sou Siri. Não sou Alexa. Sou mais bonito e trabalho mais." },
  { mood: "sad",       fala: "Pausa pro café? Eu não tomo, mas apoio." },
  { mood: "happy",     fala: "Tô de olho em tudo. Literalmente. São pixels, mas valem." },
];

// ── Constantes ─────────────────────────────────────────────────────────────────

const ROTATION_MS              = 9_000;
const CURIOSIDADE_INITIAL_MS   = 6_000;
const CURIOSIDADE_LOOP_MS      = 2 * 60_000;
const CURIOSIDADE_MIN_SHOW_MS  = 35_000;
const CURIOSIDADE_MOODS        = ["pensando", "happy", "relaxando"] as const;

// Falas exibidas enquanto a IA está gerando resposta
const STREAMING_FALAS: Fala[] = [
  { mood: "pensando",  fala: "Deixa eu ver isso com calma..." },
  { mood: "pensando",  fala: "Processando. Não fui treinado pra ser rápido, fui treinado pra ser preciso." },
  { mood: "happy",     fala: "Já chegando! Prometo que vai valer." },
  { mood: "relaxando", fala: "Você pediu, eu to calculando. Paciência é virtude." },
  { mood: "pensando",  fala: "Quase lá... ou quase aqui. Depende da perspectiva." },
  { mood: "happy",     fala: "Boa pergunta. Deixa eu elaborar direito." },
  { mood: "relaxando", fala: "Gerando. Meus neurônios virtuais estão a todo vapor." },
  { mood: "pensando",  fala: "Analisando todas as possibilidades..." },
];

// ── Componente ─────────────────────────────────────────────────────────────────

interface BibbleSpriteCompanionProps { isStreaming?: boolean; }

export default function BibbleSpriteCompanion({ isStreaming = false }: BibbleSpriteCompanionProps) {
  const [side] = useState<"left" | "right">(() => Math.random() > 0.5 ? "right" : "left");

  const [baseFalas, setBaseFalas] = useState<Fala[]>(FALLBACK_FALAS);
  const [copaFalas, setCopaFalas] = useState<Fala[]>([]);
  const [allFalas,  setAllFalas]  = useState<Fala[]>(FALLBACK_FALAS);
  const [index,     setIndex]     = useState(0);
  const [blink,     setBlink]     = useState(false);
  const isStreamingRef            = useRef(isStreaming);
  const [streamingFalaIndex, setStreamingFalaIndex] = useState(0);

  // Curiosidade — controle via ref para evitar stale closures
  const pendingCuriosidade        = useRef<Fala | null>(null);
  const [curiosidade, setCuriosidade] = useState<Fala | null>(null);
  const curiosidadeActive         = useRef(false);
  const curiosidadeShownAt        = useRef<number | null>(null);
  const blinkTimeout              = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Falas base (API) ──────────────────────────────────────────────────────

  useEffect(() => {
    let active = true;
    fetch("/api/bibble/falas")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: { falas?: Fala[] }) => {
        if (active && data.falas?.length) setBaseFalas(data.falas);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // ── Falas da Copa 2026 (API, com data do próximo jogo) ────────────────────
  // Busca algumas variações distintas para não repetir sempre a mesma.

  useEffect(() => {
    let active = true;
    const carregar = async () => {
      try {
        const respostas = await Promise.all(
          Array.from({ length: 4 }, () =>
            fetch("/api/bibble/copa").then(r => r.ok ? r.json() : null).catch(() => null),
          ),
        );
        if (!active) return;
        const falas = respostas
          .filter((d): d is { mood: string; fala: string } => !!d?.fala)
          .map(d => ({ mood: d.mood, fala: d.fala }));
        // dedup por texto
        const unicas = Array.from(new Map(falas.map(f => [f.fala, f])).values());
        if (unicas.length) setCopaFalas(unicas);
      } catch { /* sem copa */ }
    };
    void carregar();
    const id = setInterval(() => { void carregar(); }, 15 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, []);

  // ── Contexto clima + hora (+ Copa) ────────────────────────────────────────

  useEffect(() => {
    let active = true;
    const load = async () => {
      const ctx = await fetchCtx();
      if (!active) return;
      // Copa entra junto do contexto: 1 fala da Copa a cada ~3 falas base
      const contexto = [...buildContextFalas(ctx), ...copaFalas];
      setAllFalas(interleaveFalas(baseFalas, contexto, 2));
      setIndex(0);
    };
    void load();
    const id = setInterval(() => { void load(); }, 10 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [baseFalas, copaFalas]);

  // ── Fetch de curiosidades ─────────────────────────────────────────────────

  const fetchCuriosidade = useCallback(async () => {
    try {
      const r = await fetch("/api/bibble/curiosidade");
      if (!r.ok) return;
      const data = await r.json() as { curiosidade?: string; topic?: string };
      if (!data.curiosidade?.trim()) return;
      const mood = CURIOSIDADE_MOODS[Math.floor(Math.random() * CURIOSIDADE_MOODS.length)];
      pendingCuriosidade.current = { mood, fala: data.curiosidade.trim() };
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    let loopId: ReturnType<typeof setInterval>;
    const initId = setTimeout(() => {
      void fetchCuriosidade();
      loopId = setInterval(() => { void fetchCuriosidade(); }, CURIOSIDADE_LOOP_MS);
    }, CURIOSIDADE_INITIAL_MS);

    return () => { clearTimeout(initId); clearInterval(loopId); };
  }, [fetchCuriosidade]);

  // Mantém ref de isStreaming sincronizado para uso dentro do interval
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);

  // ── Rotação de falas + exibição de curiosidades ───────────────────────────
  // O interval roda SEMPRE — inclusive durante streaming — para manter o sprite ativo

  useEffect(() => {
    const id = setInterval(() => {
      // blink
      setBlink(true);
      if (blinkTimeout.current) clearTimeout(blinkTimeout.current);
      blinkTimeout.current = setTimeout(() => setBlink(false), 220);

      if (isStreamingRef.current) {
        // Durante streaming: cicla entre falas de "processando"
        setStreamingFalaIndex(p => (p + 1) % STREAMING_FALAS.length);
        // Avança o índice normal também para não repetir ao sair do streaming
        setIndex(p => (p + 1) % allFalas.length);
        return;
      }

      if (curiosidadeActive.current) {
        const elapsed = Date.now() - (curiosidadeShownAt.current ?? 0);
        if (elapsed >= CURIOSIDADE_MIN_SHOW_MS) {
          curiosidadeActive.current = false;
          curiosidadeShownAt.current = null;
          setCuriosidade(null);
          setIndex(p => (p + 1) % allFalas.length);
        }
      } else if (pendingCuriosidade.current) {
        curiosidadeActive.current = true;
        curiosidadeShownAt.current = Date.now();
        setCuriosidade(pendingCuriosidade.current);
        pendingCuriosidade.current = null;
      } else {
        setIndex(p => (p + 1) % allFalas.length);
      }
    }, ROTATION_MS);

    return () => {
      clearInterval(id);
      if (blinkTimeout.current) clearTimeout(blinkTimeout.current);
    };
  }, [allFalas.length]);

  // ── Render ────────────────────────────────────────────────────────────────

  const streamingFala = STREAMING_FALAS[streamingFalaIndex % STREAMING_FALAS.length];
  const isCuriosidade = !isStreaming && curiosidade !== null;
  const current       = isStreaming
    ? streamingFala
    : (isCuriosidade ? curiosidade : (allFalas[index] ?? FALLBACK_FALAS[0]));
  const sprite        = spriteFor(current.mood);
  const bubbleText    = current.fala;
  const bubbleKey     = isStreaming
    ? `s-${streamingFalaIndex}`
    : `${isCuriosidade ? "c" : "f"}-${current.fala.slice(0, 8)}-${index}`;
  const isRight       = side === "right";

  return (
    <div
      className={`absolute bottom-0 ${isRight ? "right-3" : "left-3"}`}
      style={{ zIndex: 10 }}
    >
      <div className={`flex items-end gap-2 ${isRight ? "flex-row-reverse" : ""}`}>

        {/* ── Sprite ───────────────────────────────────────────── */}
        <div style={{ width: 72, height: 72, flexShrink: 0 }}>
          <motion.div
            style={{ width: 72, height: 72 }}
            animate={blink ? { scale: [1, 0.85, 1] } : { y: [0, -5, 0] }}
            transition={
              blink
                ? { duration: 0.22, ease: "easeInOut" }
                : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }
            }
          >
            <Image
              key={sprite}
              src={sprite}
              alt="Bibble"
              width={72}
              height={72}
              className="object-contain"
              style={{
                width: 72,
                height: 72,
                filter: "drop-shadow(0 2px 12px rgba(99,102,241,0.45))",
              }}
              priority
              unoptimized
            />
          </motion.div>
        </div>

        {/* ── Bubble ───────────────────────────────────────────── */}
        <div className="relative mb-3 max-w-[200px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={bubbleKey}
              initial={{ opacity: 0, scale: 0.92, y: 4 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{    opacity: 0, scale: 0.92, y: 4 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="rounded-2xl px-3 py-2 relative"
              style={{
                background: isCuriosidade
                  ? "rgba(15,10,40,0.95)"
                  : "rgba(10,14,30,0.92)",
                border: isCuriosidade
                  ? "1px solid rgba(139,92,246,0.55)"
                  : "1px solid rgba(79,70,229,0.35)",
                boxShadow: isCuriosidade
                  ? "0 0 18px rgba(139,92,246,0.20), 0 2px 10px rgba(0,0,0,0.4)"
                  : "0 2px 12px rgba(0,0,0,0.35)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              {/* Label curiosidade */}
              {isCuriosidade && (
                <div className="flex items-center gap-1 mb-1">
                  <span style={{ fontSize: 10 }}>💡</span>
                  <span style={{ fontSize: 9, color: "#a78bfa", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    curiosidade
                  </span>
                </div>
              )}

              <span
                style={{
                  fontSize: 11,
                  lineHeight: 1.45,
                  color: isCuriosidade ? "#d8b4fe" : "#94a3b8",
                  display: "block",
                }}
              >
                {bubbleText}
              </span>

              {/* Indicador "IA gerando" — discreto, no rodapé do bubble */}
              {isStreaming && (
                <div className="flex items-center gap-1 mt-1.5 pt-1.5" style={{ borderTop: "1px solid rgba(99,102,241,0.12)" }}>
                  <span style={{ fontSize: 8, color: "#6366f1", opacity: 0.7, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    IA gerando
                  </span>
                  <span style={{ display: "inline-flex", gap: 2 }}>
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        style={{ width: 3, height: 3, borderRadius: "50%", background: "#6366f1", display: "inline-block" }}
                        animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                        transition={{ duration: 1.0, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                      />
                    ))}
                  </span>
                </div>
              )}

              {/* Seta aponta para o sprite */}
              {isRight ? (
                <>
                  <span aria-hidden style={{
                    position: "absolute", right: -7, bottom: 12,
                    borderTop: "7px solid transparent", borderBottom: "7px solid transparent",
                    borderLeft: `7px solid ${isCuriosidade ? "rgba(139,92,246,0.55)" : "rgba(79,70,229,0.35)"}`,
                  }} />
                  <span aria-hidden style={{
                    position: "absolute", right: -5, bottom: 13,
                    borderTop: "6px solid transparent", borderBottom: "6px solid transparent",
                    borderLeft: `6px solid ${isCuriosidade ? "rgba(15,10,40,0.95)" : "rgba(10,14,30,0.92)"}`,
                  }} />
                </>
              ) : (
                <>
                  <span aria-hidden style={{
                    position: "absolute", left: -7, bottom: 12,
                    borderTop: "7px solid transparent", borderBottom: "7px solid transparent",
                    borderRight: `7px solid ${isCuriosidade ? "rgba(139,92,246,0.55)" : "rgba(79,70,229,0.35)"}`,
                  }} />
                  <span aria-hidden style={{
                    position: "absolute", left: -5, bottom: 13,
                    borderTop: "6px solid transparent", borderBottom: "6px solid transparent",
                    borderRight: `6px solid ${isCuriosidade ? "rgba(15,10,40,0.95)" : "rgba(10,14,30,0.92)"}`,
                  }} />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
