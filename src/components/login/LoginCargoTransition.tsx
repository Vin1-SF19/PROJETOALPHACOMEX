"use client";

import Image from "next/image";
import { Check, LockKeyhole } from "lucide-react";
import { motion, useTransform, type MotionProps, type MotionValue } from "framer-motion";
import type { ReactNode } from "react";

interface LoginCargoTransitionProps {
  reducedMotion: boolean;
  routeReady: boolean;
  onContainerLoad: () => void;
  loading: MotionValue<number>;
  cargoY: number;
  cargoScale: number;
}

interface ContainerLayerProps {
  className: string;
  children: ReactNode;
  loading: MotionValue<number>;
  cargoY: number;
  cargoScale: number;
}

const CONTAINER_ASSET = "/containernavio.png";

const containerTravel: Pick<MotionProps, "initial" | "animate" | "transition"> = {
  initial: {
    x: "48vw",
    y: "18vh",
    scale: 0.76,
    rotateX: 2,
    rotateY: -7,
    rotateZ: 1.5,
    opacity: 0,
  },
  animate: {
    x: ["48vw", "0vw"],
    y: ["18vh", "0vh"],
    scale: [0.76, 1],
    rotateX: [2, 0],
    rotateY: [-7, 0],
    rotateZ: [1.5, 0],
    opacity: [0, 1],
  },
  transition: {
    delay: 0.22,
    duration: 0.37,
    ease: [0.22, 1, 0.36, 1],
  },
};

function ContainerLayer({ className, children, loading, cargoY, cargoScale }: ContainerLayerProps) {
  const y = useTransform(loading, [0, 0.28, 0.8, 1], [0, -24, cargoY - 12, cargoY]);
  const scale = useTransform(loading, [0, 0.55, 1], [1, 0.5, cargoScale]);
  const opacity = useTransform(loading, [0, 0.82, 1], [1, 1, 0]);
  const clipPath = useTransform(loading, [0, 0.8, 1], ["inset(0%)", "inset(0% 0% 8%)", "inset(0% 0% 80%)"]);
  return (
    <div
      className={`pointer-events-none fixed left-1/2 top-[56%] w-[clamp(19rem,42vw,39rem)] -translate-x-1/2 -translate-y-1/2 [perspective:1400px] ${className}`}
      aria-hidden="true"
    >
      <motion.div style={{ y, scale, opacity, clipPath }} data-login-container-load>
      <motion.div
        className="relative aspect-[1448/1086] w-full [transform-style:preserve-3d]"
        {...containerTravel}
      >
        {children}
      </motion.div>
      </motion.div>
    </div>
  );
}

export function LoginCargoTransition({
  reducedMotion,
  routeReady,
  onContainerLoad,
  loading,
  cargoY,
  cargoScale,
}: LoginCargoTransitionProps) {
  return (
    <>
      <motion.div
        className="pointer-events-none fixed inset-0 z-[3000] bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: routeReady ? 0 : reducedMotion ? 0.18 : 0.42 }}
        transition={{ duration: routeReady ? 0.28 : 0.3, ease: "easeOut" }}
        aria-hidden="true"
      />

      <motion.div
        className="pointer-events-none fixed inset-0 z-[3001] bg-[radial-gradient(circle_at_50%_52%,rgba(239,68,68,0.18),transparent_34%),radial-gradient(circle_at_72%_72%,rgba(239,68,68,0.12),transparent_28%)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: routeReady ? 0 : reducedMotion ? 0 : 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        aria-hidden="true"
      />

      <motion.div
        className="pointer-events-none fixed left-1/2 top-[9%] z-[3070] flex -translate-x-1/2 items-center gap-3 rounded-full border border-emerald-400/30 bg-slate-950/75 px-5 py-3 shadow-[0_0_32px_rgba(16,185,129,0.22)] backdrop-blur-xl md:top-[10%]"
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, -6], scale: [0.97, 1, 1, 0.99] }}
        transition={{ duration: 0.42, times: [0, 0.12, 0.72, 1], ease: [0.22, 1, 0.36, 1] }}
        aria-hidden="true"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
          <Check size={16} strokeWidth={3} />
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.32em] text-emerald-200">
          Acesso autorizado
        </span>
      </motion.div>

      {!reducedMotion && (
        <>
          <ContainerLayer className="z-[3030]" loading={loading} cargoY={cargoY} cargoScale={cargoScale}>
            <div className="absolute inset-0 drop-shadow-[0_34px_38px_rgba(0,0,0,0.7)]">
              <Image
                src={CONTAINER_ASSET}
                alt=""
                fill
                priority
                sizes="(max-width: 768px) 86vw, 42vw"
                className="object-contain"
                onLoad={onContainerLoad}
              />
            </div>

            <div className="absolute inset-0 [clip-path:polygon(59%_7%,99%_15%,99%_93%,59%_99%)] bg-[radial-gradient(circle_at_54%_48%,rgba(85,15,20,0.32),transparent_32%),linear-gradient(105deg,#020308_8%,#090b12_52%,#020308_100%)] shadow-[inset_0_0_55px_rgba(0,0,0,0.96)]">
              <div className="absolute inset-[8%] bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.025)_0_1px,transparent_1px_12%)] opacity-70" />
              <motion.div
                className="absolute inset-x-[8%] bottom-[8%] h-px bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.9)]"
                animate={{ opacity: [0.35, 0.8, 0.35] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            <motion.div
              className="absolute inset-x-[12%] bottom-[4%] h-[12%] rounded-[50%] bg-red-500/25 blur-2xl"
              animate={{ opacity: [0.2, 0.55, 0.2], scaleX: [0.9, 1.04, 0.9] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            />
          </ContainerLayer>

          <ContainerLayer className="z-[3050]" loading={loading} cargoY={cargoY} cargoScale={cargoScale}>
            <motion.div
              className="absolute inset-0 [clip-path:polygon(0_0,60%_0,60%_100%,0_100%)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0, 1, 1] }}
              transition={{
                delay: 0.5,
                duration: 0.58,
                times: [0, 0.25, 0.8, 1],
                ease: [0.42, 0, 0.2, 1],
              }}
            >
              <Image src={CONTAINER_ASSET} alt="" fill priority sizes="(max-width: 768px) 86vw, 42vw" className="object-contain" />
            </motion.div>

            <motion.div
              className="absolute inset-0 [backface-visibility:hidden] [clip-path:polygon(59%_7%,79%_11%,79%_96%,59%_99%)]"
              style={{ transformOrigin: "59% 53%" }}
              animate={{ rotateY: [0, 0, -74, -74, 0, 0] }}
              transition={{ delay: 0.22, duration: 1.25, times: [0, 0.24, 0.38, 0.7, 0.86, 1], ease: [0.42, 0, 0.2, 1] }}
            >
              <Image src={CONTAINER_ASSET} alt="" fill priority sizes="(max-width: 768px) 86vw, 42vw" className="object-contain" />
            </motion.div>

            <motion.div
              className="absolute inset-0 [backface-visibility:hidden] [clip-path:polygon(79%_11%,99%_15%,99%_93%,79%_96%)]"
              style={{ transformOrigin: "99% 54%" }}
              animate={{ rotateY: [0, 0, 74, 74, 0, 0] }}
              transition={{ delay: 0.22, duration: 1.25, times: [0, 0.24, 0.38, 0.7, 0.86, 1], ease: [0.42, 0, 0.2, 1] }}
            >
              <Image src={CONTAINER_ASSET} alt="" fill priority sizes="(max-width: 768px) 86vw, 42vw" className="object-contain" />
            </motion.div>

            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polygon points="59,7 99,15 99,93 59,99" fill="none" stroke="rgba(180,190,205,0.38)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
            </svg>

            <motion.div
              className="absolute left-[76%] top-[50%] flex h-9 w-9 items-center justify-center rounded-full border border-red-400/50 bg-slate-950/85 text-red-300 shadow-[0_0_24px_rgba(239,68,68,0.75)]"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: [0, 0, 1, 0], scale: [0.7, 0.7, 1.12, 0.9] }}
              transition={{ delay: 1.16, duration: 0.34, times: [0, 0.2, 0.62, 1], ease: "easeOut" }}
            >
              <LockKeyhole size={15} />
            </motion.div>

            <motion.div
              className="absolute inset-[4%] rounded-[18%] border border-red-400/0 shadow-[0_0_0_rgba(239,68,68,0)]"
              animate={{ borderColor: ["rgba(248,113,113,0)", "rgba(248,113,113,0)", "rgba(248,113,113,0.8)", "rgba(248,113,113,0)"], boxShadow: ["0 0 0 rgba(239,68,68,0)", "0 0 0 rgba(239,68,68,0)", "0 0 38px rgba(239,68,68,0.7)", "0 0 0 rgba(239,68,68,0)"] }}
              transition={{ delay: 1.1, duration: 0.42, times: [0, 0.28, 0.58, 1], ease: "easeOut" }}
            />
          </ContainerLayer>
        </>
      )}
    </>
  );
}
