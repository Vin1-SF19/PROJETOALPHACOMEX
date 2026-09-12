"use client";

import Image from "next/image";
import { motion, useTransform, type MotionValue } from "framer-motion";
import type { ReactNode } from "react";
import { getPageTowFraction } from "./login-voyage";

interface LoginPageTowProps {
  active: boolean;
  voyage: MotionValue<number>;
  children: ReactNode;
}

// This wraps the actual route slot. No screenshot, cloned page or iframe.
export function LoginPageTow({ active, voyage, children }: LoginPageTowProps) {
  const x = useTransform(voyage, (value) => `${(getPageTowFraction(value) - 1) * 100}vw`);

  return (
    <>
      {active && (
        <div className="pointer-events-none fixed inset-0 z-[2999] overflow-hidden bg-slate-950" aria-hidden="true">
          <Image src="/BackgroundAtualizado.png" alt="" fill priority sizes="100vw" className="object-cover object-center" />
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}
      <motion.div
        data-login-page-tow={active ? "active" : "idle"}
        className={active ? "relative z-[3015] min-h-screen w-full overflow-hidden bg-slate-950 shadow-2xl" : undefined}
        style={{ x: active ? x : undefined, willChange: active ? "transform" : undefined }}
      >
        {children}
      </motion.div>
    </>
  );
}
