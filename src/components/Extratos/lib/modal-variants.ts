import type { Variants } from "framer-motion";

/**
 * Padrão "Aurora Financeira" — modais entram com profundidade 3D real
 * (perspective + rotateX) e assentam com spring físico, em vez do fade+scale
 * plano usado antes. O wrapper externo do modal precisa de
 * `style={{ perspective: 1200 }}` e o motion.div de conteúdo precisa de
 * `style={{ transformStyle: "preserve-3d" }}` além destas variants.
 */
export const modalVariants: Variants = {
  hidden: { opacity: 0, rotateX: -15, y: 40, scale: 0.92 },
  visible: { opacity: 1, rotateX: 0, y: 0, scale: 1, transition: { type: "spring", damping: 22, stiffness: 220 } },
  exit: { opacity: 0, rotateX: 12, y: -20, scale: 0.95, transition: { duration: 0.2 } },
};

export const MODAL_PERSPECTIVE = 1200;
