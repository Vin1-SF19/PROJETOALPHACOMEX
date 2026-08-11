"use client";

import {
  motion,
  MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
  type SpringOptions,
  AnimatePresence,
} from "framer-motion";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const DEFAULT_MAGNIFICATION = 44;
const DEFAULT_DISTANCE = 90;
const DEFAULT_PANEL_SIZE = 32;

type DockOrientation = "horizontal" | "vertical";

type DockProps = {
  children: React.ReactNode;
  className?: string;
  distance?: number;
  panelSize?: number;
  magnification?: number;
  spring?: SpringOptions;
  /** "horizontal" = barra de ícones lado a lado (padrão macOS). "vertical" = coluna de ações
   *  (ex: painel de propriedades da nota) — a magnificação passa a reagir ao eixo Y do mouse. */
  orientation?: DockOrientation;
};
type DockItemProps = {
  className?: string;
  children: React.ReactNode;
};
type DockLabelProps = {
  className?: string;
  children: React.ReactNode;
};
type DockIconProps = {
  className?: string;
  children: React.ReactNode;
};

type DocContextType = {
  mouseAxis: MotionValue;
  spring: SpringOptions;
  magnification: number;
  distance: number;
  orientation: DockOrientation;
};

const DockContext = createContext<DocContextType | undefined>(undefined);

function useDock() {
  const context = useContext(DockContext);
  if (!context) {
    throw new Error("useDock must be used within a Dock");
  }
  return context;
}

// Escopo por-item: DockIcon/DockLabel leem o tamanho/hover do item mais próximo, não dos
// filhos diretos do Dock — permite que qualquer markup fique entre DockItem e DockIcon/DockLabel
// (ex: o <button> real de um Dialog com `trigger`), sem depender de cloneElement.
type DockItemContextType = {
  size: MotionValue<number>;
  isHovered: MotionValue<number>;
};
const DockItemContext = createContext<DockItemContextType | undefined>(undefined);

function useDockItem() {
  const context = useContext(DockItemContext);
  if (!context) {
    throw new Error("DockIcon/DockLabel must be used within a DockItem");
  }
  return context;
}

function Dock({
  children,
  className,
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  panelSize = DEFAULT_PANEL_SIZE,
  orientation = "horizontal",
}: DockProps) {
  const mouseAxis = useMotionValue(Infinity);
  const vertical = orientation === "vertical";

  const contextValue = useMemo(
    () => ({ mouseAxis, spring, distance, magnification, orientation }),
    [mouseAxis, spring, distance, magnification, orientation],
  );

  // O painel do Dock tem tamanho FIXO (panelSize) sempre — só os itens individuais crescem no
  // hover (via DockItem/DockIcon). O Dock original faz o painel INTEIRO crescer junto, o que
  // funciona isolado no rodapé da tela, mas aqui empurraria o conteúdo abaixo da barra
  // (input de título, editor) a cada hover, criando um loop de mouseenter/mouseleave sem fim.
  return (
    <motion.div
      style={{ scrollbarWidth: "none" }}
      className={cn(
        "flex max-w-full items-center overflow-x-auto overflow-y-visible",
        vertical && "h-full max-h-full w-fit flex-col items-stretch overflow-x-visible overflow-y-auto",
      )}
    >
      <motion.div
        onMouseMove={(event) => {
          mouseAxis.set(vertical ? event.pageY : event.pageX);
        }}
        onMouseLeave={() => {
          mouseAxis.set(Infinity);
        }}
        className={cn(
          "mx-auto flex w-fit gap-2 rounded-2xl px-2",
          vertical && "mx-0 h-fit w-full flex-col gap-1 px-0 py-1",
          className,
        )}
        style={{ [vertical ? "minWidth" : "minHeight"]: panelSize }}
        role="toolbar"
        aria-label="Barra de ações"
      >
        <DockContext.Provider value={contextValue}>{children}</DockContext.Provider>
      </motion.div>
    </motion.div>
  );
}

function DockItem({ children, className }: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { distance, magnification, mouseAxis, spring, orientation } = useDock();
  const vertical = orientation === "vertical";

  const isHovered = useMotionValue(0);

  const mouseDistance = useTransform(mouseAxis, (val) => {
    const domRect = ref.current?.getBoundingClientRect() ?? { x: 0, y: 0, width: 0, height: 0 };
    return vertical
      ? val - domRect.y - domRect.height / 2
      : val - domRect.x - domRect.width / 2;
  });

  const sizeTransform = useTransform(mouseDistance, [-distance, 0, distance], [32, magnification, 32]);

  const size = useSpring(sizeTransform, spring);

  const itemContextValue = useMemo(() => ({ size, isHovered }), [size, isHovered]);

  return (
    <motion.div
      ref={ref}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onMouseEnter={() => isHovered.set(1)}
      onMouseLeave={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      className={cn("relative inline-flex items-center justify-center", vertical && "w-full justify-start", className)}
    >
      <DockItemContext.Provider value={itemContextValue}>{children}</DockItemContext.Provider>
    </motion.div>
  );
}

function DockLabel({ children, className }: DockLabelProps) {
  const { isHovered } = useDockItem();
  const { orientation } = useDock();
  const vertical = orientation === "vertical";
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = isHovered.on("change", (latest) => {
      setIsVisible(latest === 1);
    });

    return () => unsubscribe();
  }, [isHovered]);

  // No modo vertical o label vive inline ao lado do ícone (não como tooltip flutuante) —
  // o painel de propriedades já tem texto ao lado do ícone por padrão, então aqui só
  // controlamos opacidade/deslocamento sutil, sem AnimatePresence tirando o layout do fluxo.
  if (vertical) {
    return (
      <motion.span
        animate={{ opacity: isVisible ? 1 : 0.82, x: isVisible ? 2 : 0 }}
        transition={{ duration: 0.15 }}
        className={cn("truncate text-left text-xs font-medium", className)}
      >
        {children}
      </motion.span>
    );
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -10 }}
          exit={{ opacity: 0, y: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "absolute -top-6 left-1/2 w-fit whitespace-pre rounded-md border border-white/10 bg-[#0b1120] px-2 py-0.5 text-xs text-slate-200",
            className,
          )}
          role="tooltip"
          style={{ x: "-50%" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DockIcon({ children, className }: DockIconProps) {
  const { size } = useDockItem();
  const sizeTransform = useTransform(size, (val) => val / 2);

  return (
    <motion.div style={{ width: sizeTransform, height: sizeTransform }} className={cn("flex shrink-0 items-center justify-center", className)}>
      {children}
    </motion.div>
  );
}

export { Dock, DockIcon, DockItem, DockLabel };
