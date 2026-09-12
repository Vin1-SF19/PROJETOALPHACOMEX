"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

import { LoginForm } from "../loginForm";
import { AmbientParticles } from "./AmbientParticles";
import { GlobalRoutes } from "./GlobalRoutes";
import { LedNetwork } from "./LedNetwork";
import { LoginCard } from "./LoginCard";
import { useLoginTransition } from "./LoginTransitionProvider";
import { useReducedMotion } from "./useReducedMotion";

export function LoginScene() {
  const reducedMotion = useReducedMotion();
  const { phase, visualReady } = useLoginTransition();
  const active = phase !== "idle" && phase !== "auth_error";
  const error = phase === "auth_error";
  const packing = visualReady && !["idle", "validating", "auth_error"].includes(phase);
  const frameRef = useRef<number>(0);
  const animationRunningRef = useRef(false);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (reducedMotion) {
      currentRef.current = { x: 0, y: 0 };
      targetRef.current = { x: 0, y: 0 };
      return;
    }

    const renderParallax = () => {
      currentRef.current.x += (targetRef.current.x - currentRef.current.x) * 0.08;
      currentRef.current.y += (targetRef.current.y - currentRef.current.y) * 0.08;
      document.documentElement.style.setProperty("--px", `${(currentRef.current.x * 6).toFixed(2)}px`);
      document.documentElement.style.setProperty("--py", `${(currentRef.current.y * 6).toFixed(2)}px`);

      const converged =
        Math.abs(targetRef.current.x - currentRef.current.x) < 0.001 &&
        Math.abs(targetRef.current.y - currentRef.current.y) < 0.001;
      if (converged) {
        animationRunningRef.current = false;
        frameRef.current = 0;
        return;
      }
      frameRef.current = window.requestAnimationFrame(renderParallax);
    };

    const startParallax = () => {
      if (animationRunningRef.current || document.hidden) return;
      animationRunningRef.current = true;
      frameRef.current = window.requestAnimationFrame(renderParallax);
    };

    const handlePointerMove = (event: PointerEvent) => {
      targetRef.current = {
        x: event.clientX / window.innerWidth - 0.5,
        y: event.clientY / window.innerHeight - 0.5,
      };
      startParallax();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frameRef.current);
        animationRunningRef.current = false;
        return;
      }
      startParallax();
    };

    window.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.cancelAnimationFrame(frameRef.current);
      animationRunningRef.current = false;
    };
  }, [reducedMotion]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050505]">
      <div className="absolute inset-0 z-0">
        <Image
          src="/BackgroundAtualizado.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/70 via-transparent to-[#050505]/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/80 via-transparent to-[#050505]/30" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
      </div>

      <div className="absolute inset-0 z-[1] translate-x-[var(--px,0)] translate-y-[var(--py,0)]">
        <GlobalRoutes reducedMotion={reducedMotion} active={active} />
        <LedNetwork reducedMotion={reducedMotion} active={active} />
        <AmbientParticles reducedMotion={reducedMotion} />
      </div>

      <main className="relative flex min-h-screen w-full items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="relative z-10 mb-8 text-center">
            <Image
              alt="Alpha Comex"
              src="/Logotipo-1.png"
              width={1318}
              height={431}
              sizes="(max-width: 768px) 240px, 300px"
              className="mx-auto h-16 w-auto object-contain drop-shadow-[0_0_18px_rgba(255,255,255,0.12)] md:h-20"
            />
            <div className="mt-7">
              <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white md:text-3xl">
                Entre com sua <span className="text-red-500">conta</span>
              </h1>
              <p className="mx-auto mt-2 max-w-[300px] text-[10px] font-bold uppercase leading-relaxed tracking-[0.2em] text-slate-500 md:text-xs">
                Acesso restrito a usuários autorizados pela administração Alpha.
              </p>
            </div>
          </div>

          <LoginCard
            reducedMotion={reducedMotion}
            active={active}
            error={error}
            packing={packing}
          >
            <LoginForm />
          </LoginCard>

          <footer className="relative z-10 mt-8 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-700">
              PAINEL ALPHA &copy; 2026
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
