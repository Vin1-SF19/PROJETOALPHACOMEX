"use client";

import { type ReactNode } from "react";
import { motion, type Transition, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

interface NotasCard3DProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

const springTransition: Transition = {
  type: "spring",
  damping: 22,
  stiffness: 220,
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14, rotateX: -5, scale: 0.98 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    scale: 1,
    transition: { ...springTransition, delay },
  }),
};

/**
 * Card com profundidade "quase 3D" — mesma técnica do CS&NPS (CsNpsMotion.tsx):
 * perspective + preserve-3d no wrapper, leve rotateX/rotateY + elevação no hover. Usado nas 4
 * colunas da Central de Notas (filtros, lista, editor, propriedades) para reagirem
 * individualmente ao passar o mouse, em vez de um único card grande como no CS&NPS.
 */
export function NotasCard3D({ children, className, delay = 0 }: NotasCard3DProps) {
  return (
    <div className={cn("[perspective:1400px]", className)}>
      <motion.div
        custom={delay}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ y: -3, rotateX: 2, rotateY: -1.4, scale: 1.004 }}
        transition={springTransition}
        className="group relative h-full transform-gpu [transform-style:preserve-3d]"
      >
        <div className="pointer-events-none absolute inset-x-6 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        {children}
      </motion.div>
    </div>
  );
}
