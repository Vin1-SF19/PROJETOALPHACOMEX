import { useEditorStore } from "../store/useEditorStore";
import { RenderComponente } from "../RenderEngine/RenderComponente";
import { useCanvasDragResize } from "./useCanvasDragResize";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

const HANDLES = [
  { pos: "nw" as const, className: "-left-1.5 -top-1.5 cursor-nwse-resize" },
  { pos: "ne" as const, className: "-right-1.5 -top-1.5 cursor-nesw-resize" },
  { pos: "sw" as const, className: "-left-1.5 -bottom-1.5 cursor-nesw-resize" },
  { pos: "se" as const, className: "-right-1.5 -bottom-1.5 cursor-nwse-resize" },
];

/**
 * Envolve o RenderComponente com seleção e drag/resize — a seleção é
 * responsabilidade DESTE componente, nunca do RenderComponente (que precisa
 * ficar genérico o bastante pra ser reaproveitado no Modo Apresentação/Export).
 *
 * Decisão de UX confirmada com o usuário: clique simples seleciona diretamente
 * o filho mais profundo sob o cursor (estilo Figma/Framer), não o container pai
 * primeiro. Isso é resolvido com stopPropagation: cada filho renderizado dentro
 * de um card/grid é ele mesmo um ComponenteNoCanvas com seu próprio onClick que
 * para a propagação — então o clique nunca "borbulha" até o pai selecionar o
 * container por engano.
 */
export function ComponenteNoCanvas({ componente, dentroDeContainer = false }: { componente: ComponenteSlide; dentroDeContainer?: boolean }) {
  const selecionado = useEditorStore((s) => s.componenteSelecionadoId === componente.id);
  const selecionarComponente = useEditorStore((s) => s.selecionarComponente);
  const { onMouseDownMover, onMouseDownRedimensionar } = useCanvasDragResize(
    componente.id,
    componente.x,
    componente.y,
    componente.w,
    componente.h,
  );

  const ehContainer = componente.tipo === "card" || componente.tipo === "grid";

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    selecionarComponente(componente.id);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Componente ${componente.tipo}`}
      onClick={handleClick}
      onMouseDown={!dentroDeContainer ? onMouseDownMover : undefined}
      style={{
        position: dentroDeContainer ? "relative" : "absolute",
        left: dentroDeContainer ? undefined : componente.x,
        top: dentroDeContainer ? undefined : componente.y,
        width: componente.w,
        height: componente.h,
        zIndex: componente.zIndex,
        transform: componente.rotacao ? `rotate(${componente.rotacao}deg)` : undefined,
        outline: selecionado ? "2px solid rgb(99,102,241)" : "none",
        outlineOffset: 2,
        cursor: dentroDeContainer ? "pointer" : "grab",
      }}
    >
      {ehContainer ? (
        // Card/Grid: renderiza os filhos como ComponenteNoCanvas (não RenderComponente puro),
        // para que cada filho seja individualmente selecionável/arrastável dentro do container.
        <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
          <RenderComponenteContainer componente={componente} />
        </div>
      ) : (
        <RenderComponente componente={componente} />
      )}

      {selecionado && !dentroDeContainer && (
        <>
          {HANDLES.map((h) => (
            <div
              key={h.pos}
              onMouseDown={onMouseDownRedimensionar(h.pos)}
              className={`absolute h-3 w-3 rounded-sm border border-white bg-indigo-500 ${h.className}`}
            />
          ))}
        </>
      )}
    </div>
  );
}

/** Card/Grid com filhos navegáveis individualmente (não usa RenderComponente.card/grid puro, que é só leitura). */
function RenderComponenteContainer({ componente }: { componente: Extract<ComponenteSlide, { tipo: "card" | "grid" }> }) {
  if (componente.tipo === "card") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: componente.corFundo ?? "transparent",
          borderRadius: componente.borderRadius ?? 0,
          padding: componente.padding ?? 0,
          position: "relative",
        }}
      >
        {componente.filhos.map((filho) => (
          <div key={filho.id} style={{ position: "absolute", left: filho.x, top: filho.y, width: filho.w, height: filho.h }}>
            <ComponenteNoCanvas componente={filho} dentroDeContainer />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        gridTemplateColumns: `repeat(${componente.colunas}, 1fr)`,
        gap: componente.gap ?? 0,
      }}
    >
      {componente.filhos.map((filho) => (
        <div key={filho.id} style={{ position: "relative" }}>
          <ComponenteNoCanvas componente={filho} dentroDeContainer />
        </div>
      ))}
    </div>
  );
}
