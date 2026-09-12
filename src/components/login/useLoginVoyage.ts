"use client";

import { useEffect, useRef, useState } from "react";
import { animate, type MotionValue } from "framer-motion";
import { DOCK_PROGRESS, ROUTE_HANDOFF_PROGRESS } from "./login-voyage";

interface LoginVoyageOptions {
  progress: MotionValue<number>;
  loading: MotionValue<number>;
  reducedMotion: boolean;
  shipReady: boolean;
  containerReady: boolean;
  routeReady: boolean;
  onCovered: () => void;
  onComplete: () => void;
}

export function useLoginVoyage({ progress, loading, reducedMotion, shipReady, containerReady, routeReady, onCovered, onComplete }: LoginVoyageOptions) {
  const startedAt = useRef(0);
  const callbacks = useRef({ onCovered, onComplete });
  const audio = useRef<HTMLAudioElement | null>(null);
  const [departing, setDeparting] = useState(false);

  useEffect(() => { callbacks.current = { onCovered, onComplete }; }, [onCovered, onComplete]);
  useEffect(() => { startedAt.current = performance.now(); }, []);

  useEffect(() => {
    if (reducedMotion) {
      const timer = window.setTimeout(() => callbacks.current.onCovered(), 360);
      return () => window.clearTimeout(timer);
    }
    if (!shipReady || !containerReady) return;

    let cancelled = false;
    let controls: { stop: () => void } | undefined;
    const arriveAndLoad = async () => {
      const approach = animate(progress, DOCK_PROGRESS, { duration: 0.6, ease: [0.22, 1, 0.36, 1] });
      controls = approach;
      await approach;
      if (cancelled) return;

      // The ship is stationary under the original container position.
      const boarding = animate(loading, 1, { duration: 0.48, ease: [0.42, 0, 0.2, 1] });
      controls = boarding;
      await boarding;
      if (cancelled) return;

      setDeparting(true);
      try {
        audio.current = new Audio("/sounds/buzina.mp3");
        audio.current.volume = 0.2;
        void audio.current.play().catch(() => undefined);
      } catch { /* Audio is optional and never blocks navigation. */ }

      const departure = animate(progress, ROUTE_HANDOFF_PROGRESS, { duration: 0.24, ease: [0.42, 0, 0.8, 1] });
      controls = departure;
      await departure;
      if (!cancelled) callbacks.current.onCovered();
    };
    const timer = window.setTimeout(() => { void arriveAndLoad(); }, Math.max(0, 1450 - (performance.now() - startedAt.current)));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controls?.stop();
      audio.current?.pause();
    };
  }, [containerReady, loading, progress, reducedMotion, shipReady]);

  useEffect(() => {
    if (!routeReady) return;
    if (reducedMotion) {
      const timer = window.setTimeout(() => callbacks.current.onComplete(), 160);
      return () => window.clearTimeout(timer);
    }
    // Route is now mounted offscreen. Its real DOM follows the same progress
    // as the ship and the two rope anchors until it reaches its final position.
    const controls = animate(progress, 1, {
      duration: 1.15,
      ease: [0.4, 0, 0.25, 1],
      onComplete: () => callbacks.current.onComplete(),
    });
    return () => controls.stop();
  }, [progress, reducedMotion, routeReady]);

  return departing;
}
