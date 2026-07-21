"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface CardComScanProps {
  children: React.ReactNode;
  accentRgb: string;
  className?: string;
  style?: React.CSSProperties;
}

export function CardComScan({ children, accentRgb, className, style }: CardComScanProps) {
  const [hover, setHover] = useState(false);

  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
      <AnimatePresence>
        {hover && (
          <motion.div
            key="scan-line"
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 h-px z-20"
            style={{
              background: `linear-gradient(90deg, transparent, rgb(${accentRgb}), transparent)`,
              boxShadow: `0 0 8px rgba(${accentRgb},0.8)`,
            }}
            initial={{ top: "0%", opacity: 0 }}
            animate={{ top: "100%", opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
