"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

import { useAgendaDesktop } from "./lib/useAgendaDesktop";

interface AgendaModalSurfaceProps {
  tema: TemaAlpha;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  mobile?: boolean;
  className?: string;
}

interface AgendaModal3DProps extends AgendaModalSurfaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: "sm" | "md" | "lg" | "xl";
}

const desktopVariants: Variants = {
  hidden: { opacity: 0, rotateX: -12, y: 28, scale: 0.96 },
  visible: {
    opacity: 1,
    rotateX: 0,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 24 },
  },
};

const reducedVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.12 } },
};

const sizeClasses = {
  sm: "lg:max-w-lg",
  md: "lg:max-w-2xl",
  lg: "lg:max-w-4xl",
  xl: "lg:max-w-6xl",
};

export function AgendaModalSurface({
  tema,
  title,
  description,
  children,
  footer,
  mobile = false,
  className,
}: AgendaModalSurfaceProps) {
  const reduceMotion = useReducedMotion();
  const Header = mobile ? SheetHeader : DialogHeader;
  const Title = mobile ? SheetTitle : DialogTitle;
  const Description = mobile ? SheetDescription : DialogDescription;

  return (
    <div className={cn(!mobile && "flex w-full justify-center [perspective:1200px]")}>
      <motion.div
        variants={reduceMotion ? reducedVariants : desktopVariants}
        initial="hidden"
        animate="visible"
        className={cn(
          "relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden border border-white/10 bg-slate-950/85 text-slate-100 shadow-2xl backdrop-blur-2xl",
          mobile ? "rounded-t-[2rem] border-b-0" : "rounded-[2rem] transform-gpu [transform-style:preserve-3d]",
          className,
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-x-10 top-0 z-10 h-px opacity-60",
            tema.bg,
          )}
          aria-hidden="true"
        />
        <Header className="border-b border-white/5 px-5 py-4 pr-12 sm:px-6">
          <Title className="text-left text-lg font-black tracking-tight text-white">{title}</Title>
          <Description className="text-left text-sm leading-relaxed text-slate-400">{description}</Description>
        </Header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          {children}
        </div>
        {footer && (
          <div className="border-t border-white/5 bg-slate-950/60 px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export function AgendaModal3D({
  open,
  onOpenChange,
  tema,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: AgendaModal3DProps) {
  const isDesktop = useAgendaDesktop();

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton
          className={cn(
            "border-0 bg-transparent p-0 shadow-none data-[state=open]:animate-none data-[state=closed]:animate-none",
            sizeClasses[size],
          )}
        >
          <AgendaModalSurface
            tema={tema}
            title={title}
            description={description}
            footer={footer}
            className={className}
          >
            {children}
          </AgendaModalSurface>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 border-0 bg-transparent p-0 shadow-none">
        <AgendaModalSurface
          tema={tema}
          title={title}
          description={description}
          footer={footer}
          mobile
          className={className}
        >
          {children}
        </AgendaModalSurface>
      </SheetContent>
    </Sheet>
  );
}
