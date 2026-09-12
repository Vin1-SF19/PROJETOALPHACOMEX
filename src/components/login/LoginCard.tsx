"use client";

import {
  memo,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type Props = {
  reducedMotion: boolean;
  active: boolean;
  error: boolean;
  packing: boolean;
  children: ReactNode;
};

function LoginCardComponent({ reducedMotion, active, error, packing, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reducedMotion || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      ref.current.style.setProperty("--rx", `${(-py * 1.6).toFixed(3)}deg`);
      ref.current.style.setProperty("--ry", `${(px * 1.6).toFixed(3)}deg`);
      ref.current.style.setProperty("--mx", `${(px + 0.5) * 100}%`);
      ref.current.style.setProperty("--my", `${(py + 0.5) * 100}%`);
    },
    [reducedMotion]
  );

  const onLeave = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.setProperty("--rx", "0deg");
    ref.current.style.setProperty("--ry", "0deg");
    ref.current.style.setProperty("--mx", "50%");
    ref.current.style.setProperty("--my", "50%");
  }, []);

  return (
    <motion.div
      className={cn(
        "relative [perspective:1200px]",
        packing ? "z-[3040]" : "z-10",
      )}
      animate={packing
        ? reducedMotion
          ? { opacity: 0 }
          : {
              x: ["0vw", "0vw", "7vw", "11vw"],
              y: ["0vh", "-0.5vh", "0.8vh", "2vh"],
              scale: [1, 1.02, 0.64, 0.3],
              rotateX: [0, -1, 3, 6],
              rotateY: [0, 0, -3, -6],
              opacity: [1, 1, 0.92, 0],
              filter: [
                "brightness(1) blur(0px)",
                "brightness(1.08) blur(0px)",
                "brightness(0.76) blur(0.3px)",
                "brightness(0.42) blur(1px)",
              ],
              clipPath: [
                "inset(0% round 22px)",
                "inset(0% round 22px)",
                "inset(3% 5% round 18px)",
                "inset(13% 16% round 12px)",
              ],
            }
        : {
            x: "0vw",
            y: "0vh",
            scale: 1,
            rotateX: 0,
            rotateY: 0,
            opacity: 1,
            filter: "brightness(1) blur(0px)",
            clipPath: "inset(0% round 22px)",
          }}
      transition={packing
        ? reducedMotion
          ? { delay: 0.28, duration: 0.16, ease: "easeOut" }
          : {
              delay: 0.56,
              duration: 0.56,
              times: [0, 0.18, 0.65, 1],
              ease: [0.42, 0, 0.2, 1],
            }
        : { duration: 0.2, ease: "easeOut" }}
      style={{
        transformStyle: "preserve-3d",
        willChange: packing ? "transform, opacity, filter, clip-path" : "auto",
      }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      data-login-cargo={packing ? "packing" : "idle"}
    >
      <div
        ref={ref}
        className="login-card relative overflow-hidden"
        style={{
          transform: reducedMotion
            ? undefined
            : "rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
          transformStyle: "preserve-3d",
          transition: "transform 320ms cubic-bezier(.2,.8,.2,1), box-shadow 400ms ease, border-color 400ms ease",
          background: "rgba(7, 12, 23, 0.72)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "22px",
          boxShadow: active
            ? "0 25px 80px rgba(0,0,0,0.55), 0 0 40px rgba(239,68,68,0.18), inset 0 1px 0 rgba(255,255,255,0.10)"
            : "0 25px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
          borderColor: error
            ? "rgba(239,68,68,0.55)"
            : active
              ? "rgba(239,68,68,0.35)"
              : "rgba(255,255,255,0.12)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 55%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 40% at 15% 110%, rgba(239,68,68,0.14) 0%, rgba(239,68,68,0) 60%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 40% at 85% 110%, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0) 60%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(240px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 60%)`,
            mixBlendMode: "screen",
          }}
        />
        <div
          className="login-card-shimmer pointer-events-none absolute inset-0"
          aria-hidden
        />
        <div className="relative z-10 p-6 md:p-10">{children}</div>
      </div>
    </motion.div>
  );
}

export const LoginCard = memo(LoginCardComponent);
