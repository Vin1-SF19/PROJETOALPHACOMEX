import { useTimelineDragV2 } from "./useTimelineDragV2";
import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";

/** Cores por categoria — mesma lógica visual de distinção usada em outros pontos do editor (ex: badges de status). */
const COR_POR_CATEGORIA: Record<ElementAnimation["category"], string> = {
  entrance: "bg-emerald-500/60",
  emphasis: "bg-amber-500/60",
  exit: "bg-rose-500/60",
  interaction: "bg-sky-500/60",
};
const COR_SELECIONADA_POR_CATEGORIA: Record<ElementAnimation["category"], string> = {
  entrance: "bg-emerald-500",
  emphasis: "bg-amber-500",
  exit: "bg-rose-500",
  interaction: "bg-sky-500",
};

interface BarraAnimacaoV2Props {
  animacao: ElementAnimation;
  delayEfetivo: number;
  pixelsPorSegundo: number;
  maxTempo: number;
  selecionada: boolean;
  onSelecionar: (event: React.MouseEvent) => void;
}

/** Uma barra de tempo (entrada/ênfase/saída) do novo modelo — arrastável/redimensionável via `useTimelineDragV2`. */
export function BarraAnimacaoV2({ animacao, delayEfetivo, pixelsPorSegundo, maxTempo, selecionada, onSelecionar }: BarraAnimacaoV2Props) {
  const { onMouseDownMover, onMouseDownRedimensionar } = useTimelineDragV2(animacao, pixelsPorSegundo, maxTempo);
  const left = delayEfetivo * pixelsPorSegundo;
  const width = Math.max(animacao.duration * pixelsPorSegundo, 12);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selecionada}
      aria-label={`Animação ${animacao.type}, categoria ${animacao.category}`}
      onClick={onSelecionar}
      onMouseDown={onMouseDownMover}
      className={`absolute top-0 flex h-6 cursor-grab items-center rounded px-1 text-[9px] font-bold text-white active:cursor-grabbing ${
        selecionada ? COR_SELECIONADA_POR_CATEGORIA[animacao.category] : COR_POR_CATEGORIA[animacao.category]
      }`}
      style={{ left, width }}
    >
      <span className="truncate">{animacao.type}</span>
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          onMouseDownRedimensionar(e);
        }}
        className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-white/30"
      />
    </div>
  );
}
