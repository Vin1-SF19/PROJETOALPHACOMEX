"use client";

import { type ReactNode } from "react";
import { motion, type Transition, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";

interface MotionShellProps {
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
  hidden: { opacity: 0, y: 18, rotateX: -6, scale: 0.98 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    scale: 1,
    transition: { ...springTransition, delay },
  }),
};

const modalVariants: Variants = {
  hidden: { opacity: 0, rotateX: -14, y: 34, scale: 0.94 },
  visible: {
    opacity: 1,
    rotateX: 0,
    y: 0,
    scale: 1,
    transition: springTransition,
  },
};

export function CsNpsHero3DCard({ children, className, delay = 0 }: MotionShellProps) {
  return (
    <div className="[perspective:1400px]">
      <motion.header
        custom={delay}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ y: -5, rotateX: 3, rotateY: -2, scale: 1.006 }}
        transition={springTransition}
        className={cn("group transform-gpu [transform-style:preserve-3d]", className)}
      >
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/40 to-transparent" />
        <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-indigo-500/10 blur-3xl transition-opacity duration-500 group-hover:opacity-80" />
        {children}
      </motion.header>
    </div>
  );
}

export function CsNpsSurface3DCard({ children, className, delay = 0.08 }: MotionShellProps) {
  return (
    <div className="[perspective:1400px]">
      <motion.div
        custom={delay}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={springTransition}
        className={cn("transform-gpu [transform-style:preserve-3d]", className)}
      >
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        {children}
      </motion.div>
    </div>
  );
}

export function CsNpsModal3DShell({ children, className }: MotionShellProps) {
  return (
    <div className="flex w-full justify-center [perspective:1200px]">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        transition={springTransition}
        className={cn("transform-gpu [transform-style:preserve-3d]", className)}
      >
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/40 to-transparent" />
        <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-indigo-500/10 blur-3xl" />
        {children}
      </motion.div>
    </div>
  );
}
