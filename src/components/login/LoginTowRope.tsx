"use client";

import Image from "next/image";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { ROPE_ASSET } from "./login-voyage";

interface LoginTowRopeProps {
  shipX: MotionValue<number>;
  shipY: MotionValue<number>;
  ropeLength: number;
  sternOffset: number;
  ropeY: number;
  departing: boolean;
}

export function LoginTowRope({ shipX, shipY, ropeLength, sternOffset, ropeY, departing }: LoginTowRopeProps) {
  // Loop centres are at ~6% and 94% of the supplied PNG, not its edges.
  const width = ropeLength / 0.88;
  const height = Math.min(24, Math.max(8, ropeLength * 0.055));
  const x = useTransform(shipX, (value) => value + sternOffset - ropeLength - width * 0.06);
  const y = useTransform(shipY, (value) => ropeY + value - height / 2);

  return (
    <motion.div
      data-login-tow-rope
      className="pointer-events-none fixed left-0 top-0 z-[3025] origin-right"
      style={{ x, y, width, height }}
      initial={{ opacity: 0 }}
      animate={{ opacity: departing ? 0.9 : 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      aria-hidden="true"
    >
      <span className="absolute left-[6%] top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-300/70 bg-slate-800 shadow-sm" />
      <span className="absolute right-[6%] top-1/2 size-1.5 translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-300/70 bg-slate-800 shadow-sm" />
      <div className="absolute inset-0 overflow-hidden drop-shadow-[0_3px_3px_rgba(0,0,0,0.65)]">
        {/* Crop transparent padding in the DOM; preserve the original asset. */}
        <div className="absolute inset-x-0 top-[-139%] h-[402%]">
        <Image
          src={ROPE_ASSET}
          alt=""
          fill
          priority
          unoptimized
          sizes="35vw"
          className="object-fill"
        />
        </div>
      </div>
    </motion.div>
  );
}
