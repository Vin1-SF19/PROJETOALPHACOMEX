"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { Eye, Play, RefreshCw, Repeat2, Waves } from "lucide-react";
import { motion, useMotionValue } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { LoginForm } from "../loginForm";
import { LoginCard } from "./LoginCard";
import { LoginSuccessTransition } from "./LoginSuccessTransition";
import { ShipWaterContact } from "./ShipWaterContact";
import { LoginPageTow } from "./LoginPageTow";

const Ocean = dynamic(() => import("./Ocean"), { ssr: false });

type PreviewMode = "ocean" | "transition";

const REPLAY_DELAY_MS = 700;

export function LoginTransitionPreview() {
  const [mode, setMode] = useState<PreviewMode>("ocean");
  const [cycle, setCycle] = useState(0);
  const [routeReady, setRouteReady] = useState(false);
  const [autoReplay, setAutoReplay] = useState(true);
  const voyage = useMotionValue(0);
  const replayTimerRef = useRef<number | null>(null);

  const clearReplayTimer = useCallback(() => {
    if (replayTimerRef.current === null) return;
    window.clearTimeout(replayTimerRef.current);
    replayTimerRef.current = null;
  }, []);

  const replay = useCallback(() => {
    clearReplayTimer();
    setRouteReady(false);
    voyage.set(0);
    setCycle((current) => current + 1);
  }, [clearReplayTimer, voyage]);

  const selectMode = useCallback((nextMode: PreviewMode) => {
    clearReplayTimer();
    setMode(nextMode);
    setRouteReady(false);
    voyage.set(0);
    setCycle((current) => current + 1);
  }, [clearReplayTimer, voyage]);

  const handleComplete = useCallback(() => {
    if (!autoReplay) return;
    replayTimerRef.current = window.setTimeout(replay, REPLAY_DELAY_MS);
  }, [autoReplay, replay]);

  const markRouteReady = useCallback(() => setRouteReady(true), []);
  const handleTransitionReady = useCallback(() => undefined, []);

  const toggleAutoReplay = useCallback(() => {
    setAutoReplay((current) => {
      const next = !current;
      if (!next) clearReplayTimer();
      return next;
    });
  }, [clearReplayTimer]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "r" && mode === "transition") replay();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, replay]);

  useEffect(() => () => clearReplayTimer(), [clearReplayTimer]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <Image
        src="/BackgroundAtualizado.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-black/35" aria-hidden="true" />

      {mode === "ocean" ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 z-10">
            <Ocean visible />
          </div>
          <motion.div
            className="absolute bottom-[9vh] left-1/2 z-20 w-[min(72vw,980px)] -translate-x-1/2"
            animate={{ y: [0, -3, 1, 0], rotateZ: [0, -0.12, 0.08, 0] }}
            transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Image
              src="/NavioLogin.png"
              alt=""
              width={1672}
              height={941}
              priority
              sizes="72vw"
              className="h-auto w-full drop-shadow-[0_26px_32px_rgba(0,0,0,0.62)]"
            />
            <ShipWaterContact />
          </motion.div>
        </div>
      ) : (
        <>
          {!routeReady && <main key={`login-${cycle}`} className="relative flex min-h-screen items-center justify-center px-6 py-12">
            <div className="w-full max-w-md">
              <div className="relative z-10 mb-8 text-center">
                <Image
                  src="/Logotipo-1.png"
                  alt="Alpha Comex"
                  width={1318}
                  height={431}
                  priority
                  sizes="300px"
                  className="mx-auto h-20 w-auto object-contain"
                />
                <h1 className="mt-7 text-3xl font-black uppercase italic text-white">
                  Entre com sua conta
                </h1>
              </div>
              <div className="pointer-events-none">
                <LoginCard reducedMotion={false} active error={false} packing>
                  <LoginForm />
                </LoginCard>
              </div>
            </div>
          </main>}

          <LoginPageTow active={routeReady} voyage={voyage}>
            {routeReady && (
              <section className="flex min-h-screen items-center justify-center bg-slate-950 p-10">
                <div className="max-w-lg rounded-2xl border border-white/10 bg-slate-900/40 p-8">
                  <p className="text-xs font-bold uppercase tracking-widest text-red-400">Destino da prévia</p>
                  <h2 className="mt-4 text-3xl font-bold">Página rebocada pelo navio</h2>
                  <p className="mt-3 text-sm text-slate-400">No login real, este movimento traz a própria página do Painel Alpha. Esta bancada não autentica nem carrega dados do painel.</p>
                </div>
              </section>
            )}
          </LoginPageTow>

          <LoginSuccessTransition
            key={cycle}
            voyage={voyage}
            reducedMotion={false}
            routeReady={routeReady}
            onReady={handleTransitionReady}
            onCovered={markRouteReady}
            onComplete={handleComplete}
          />
        </>
      )}

      <aside
        className="fixed left-4 top-4 z-[5000] w-[min(92vw,430px)] rounded-2xl border border-white/10 bg-slate-950/85 p-3 shadow-2xl backdrop-blur-xl sm:left-6 sm:top-6"
        aria-label="Controles da prévia de desenvolvimento"
      >
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-red-400">
              <Eye className="size-3.5" /> Preview local
            </p>
            <p className="mt-1 text-xs text-slate-400">Atualiza automaticamente com o hot reload.</p>
          </div>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
            Dev only
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Cena da prévia">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={mode === "ocean"}
            onClick={() => selectMode("ocean")}
            className={cn("justify-center border border-white/10", mode === "ocean" && "border-red-400/40 bg-red-500/15 text-red-100")}
          >
            <Waves /> Mar contínuo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={mode === "transition"}
            onClick={() => selectMode("transition")}
            className={cn("justify-center border border-white/10", mode === "transition" && "border-red-400/40 bg-red-500/15 text-red-100")}
          >
            <Play /> Transição completa
          </Button>
        </div>

        {mode === "transition" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant="outline" onClick={replay} className="border-white/10 bg-white/5">
              <RefreshCw /> Reiniciar <kbd className="ml-1 text-[9px] text-slate-500">R</kbd>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={autoReplay}
              onClick={toggleAutoReplay}
              className="border-white/10 bg-white/5"
            >
              <Repeat2 /> Loop {autoReplay ? "ativo" : "parado"}
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
