"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";

import { LoginCargoTransition } from "./LoginCargoTransition";
import { ShipWaterContact } from "./ShipWaterContact";
import { LoginTowRope } from "./LoginTowRope";
import { DOCK_PROGRESS, ROUTE_HANDOFF_PROGRESS, getVoyageLayout } from "./login-voyage";
import { useLoginVoyage } from "./useLoginVoyage";

const Ocean = dynamic(
  () => import("./Ocean"),
  {
    ssr: false,
    loading: () => (
      <div className="login-ocean-fallback pointer-events-none absolute inset-x-0 bottom-0 h-[46vh]" />
    ),
  },
);

interface LoginSuccessTransitionProps {
  voyage: MotionValue<number>;
  reducedMotion: boolean;
  routeReady: boolean;
  onReady: () => void;
  onCovered: () => void;
  onComplete: () => void;
}

const ASSET_SAFETY_TIMEOUT_MS = 1_600;

export function LoginSuccessTransition({
  voyage: progress,
  reducedMotion,
  routeReady,
  onReady,
  onCovered,
  onComplete,
}: LoginSuccessTransitionProps) {
  const loading = useMotionValue(0);
  const [shipReady, setShipReady] = useState(false);
  const [containerReady, setContainerReady] = useState(false);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const layout = getVoyageLayout(viewport.width, viewport.height);
  const shipX = useTransform(progress, [0, DOCK_PROGRESS, ROUTE_HANDOFF_PROGRESS, 1], [layout.startX, layout.dockX, layout.handoffX, layout.exitX]);
  const shipY = useTransform(progress, (value) => Math.sin(value * Math.PI * 2) * 2 + Math.sin(value * Math.PI * 4) * 1);
  const departing = useLoginVoyage({ progress, loading, reducedMotion, shipReady, containerReady, routeReady, onCovered, onComplete });
  const wakeOpacity = useTransform(progress, [0, 0.18, 0.82, 1], [0, 0.62, 0.72, 0]);
  const bowFoamOpacity = useTransform(wakeOpacity, (v) => v * 0.8);
  const sideFoamOpacity = useTransform(wakeOpacity, (v) => v * 0.6);
  const sternFoamOpacity = useTransform(wakeOpacity, (v) => v * 0.5);
  const midFoamOpacity = useTransform(wakeOpacity, (v) => v * 0.42);
  const oceanY = useTransform(progress, [0, 0.86, 1], ["0%", "12%", "110%"]);

  useEffect(() => { onReady(); }, [onReady]);

  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const timeout = window.setTimeout(() => {
      setShipReady(true);
      setContainerReady(true);
    }, ASSET_SAFETY_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [reducedMotion]);

  return (
    <>
      <div
        className="sr-only"
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label="Empacotando seu acesso e abrindo o Painel Alpha"
      />

      <LoginCargoTransition
        reducedMotion={reducedMotion}
        routeReady={routeReady}
        onContainerLoad={() => setContainerReady(true)}
        loading={loading}
        cargoY={layout.cargoY}
        cargoScale={layout.cargoScale}
      />

      {!reducedMotion && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[3010]"
          initial={{ opacity: 0, y: "18%" }}
          animate={{ opacity: 1, y: "0%" }}
          transition={{ delay: 1.4, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
        >
          <motion.div className="absolute inset-0" style={{ y: oceanY }}>
            <Ocean visible />
          </motion.div>
        </motion.div>
      )}

      {!reducedMotion && (
        <LoginTowRope shipX={shipX} shipY={shipY} ropeLength={layout.ropeLength} sternOffset={layout.sternOffset} ropeY={layout.ropeY} departing={departing} />
      )}

      {!reducedMotion && (
        <motion.div
          className="pointer-events-none fixed bottom-[5vh] left-0 z-[3020] w-[min(74vw,1000px)]"
          style={{
            x: shipX,
            y: shipY,
            opacity: shipReady ? 1 : 0,
            willChange: "transform",
          }}
          aria-hidden="true"
          data-login-ship
        >
          <motion.div
            className="absolute top-[74%] left-[-25%] h-[12%] w-[135%] bg-[radial-gradient(ellipse_at_40%_35%,rgba(96,128,150,0.18),transparent_68%)] blur-[4px]"
            style={{ opacity: wakeOpacity }}
          />
          <motion.div
            className="absolute top-[72%] right-0 h-[5%] w-[8%] rounded-full bg-[radial-gradient(ellipse,rgba(164,188,204,0.36),transparent_70%)] blur-[2px]"
            style={{ opacity: bowFoamOpacity }}
          />
          <motion.div
            className="absolute top-[74%] left-[16%] h-[4%] w-[18%] rounded-full bg-[radial-gradient(ellipse,rgba(139,167,186,0.22),transparent_70%)] blur-[2px]"
            style={{ opacity: sideFoamOpacity }}
          />
          <motion.div
            className="absolute top-[74%] left-[-4%] h-[5%] w-[15%] rounded-full bg-[radial-gradient(ellipse,rgba(139,167,186,0.2),transparent_70%)] blur-[3px]"
            style={{ opacity: sternFoamOpacity }}
          />
          <motion.div
            className="absolute top-[75%] left-[30%] h-[4%] w-[50%] rounded-full bg-[radial-gradient(ellipse,rgba(126,155,177,0.15),transparent_70%)] blur-[2px]"
            style={{ opacity: midFoamOpacity }}
          />
          <Image
            src="/NavioLogin.png"
            alt=""
            width={1672}
            height={941}
            priority
            onLoad={() => setShipReady(true)}
            draggable={false}
            sizes="74vw"
            className="block h-auto w-full drop-shadow-[0_36px_42px_rgba(0,0,0,0.78)] drop-shadow-[0_14px_22px_rgba(59,130,246,0.35)]"
          />
          <ShipWaterContact />
        </motion.div>
      )}
    </>
  );
}
