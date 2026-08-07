import { motion } from "framer-motion";
import { useEditorStore } from "../store/useEditorStore";
import { RenderComponente } from "../RenderEngine/RenderComponente";
import { ScrollRevealWrapper } from "../RenderEngine/ScrollRevealWrapper";
import { staggerContainerVariants, staggerItemVariants } from "../RenderEngine/nucleo";
import { useCanvasDragResize } from "./useCanvasDragResize";
import { resolverAnimacoesDoElemento } from "@/lib/apresentacoes/animacao/resolver";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { AjusteVisualEfeitoGlobal } from "../RenderEngine/EfeitosGlobaisSlide";
import type { ReactNode } from "react";

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
export function ComponenteNoCanvas({
  componente,
  dentroDeContainer = false,
  portalProximoSlide,
  ajusteVisual,
}: {
  componente: ComponenteSlide;
  dentroDeContainer?: boolean;
  portalProximoSlide?: ReactNode;
  /** Fase 07 — ajuste calculado por `EfeitosGlobaisSlide` (Dim Others/Focus Element). Opcional, retrocompatível. */
  ajusteVisual?: AjusteVisualEfeitoGlobal;
}) {
  const selecionado = useEditorStore((s) => s.componenteSelecionadoId === componente.id);
  const selecionarComponente = useEditorStore((s) => s.selecionarComponente);
  const { onMouseDownMover, onMouseDownRedimensionar } = useCanvasDragResize(
    componente.id,
    componente.x,
    componente.y,
    componente.w,
    componente.h,
  );

  const ehContainer = componente.tipo === "card" || componente.tipo === "grid" || componente.tipo === "container";
  // Fase 08 — Scroll Reveal no preview do Editor. `animacaoConfig` é do SLIDE ATIVO (mesma
  // fonte de `useStaggerDelayAtivo` acima); o lookup elementId→animação é sempre feito via
  // `resolverAnimacoesDoElemento`, nunca duplicado.
  const animacaoConfigSlide = useEditorStore((s) => s.animacaoConfig);
  const animacoesDoComponente = resolverAnimacoesDoElemento(componente, animacaoConfigSlide).map((r) => r.animacao);

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
        transform: [
          componente.rotacao ? `rotate(${componente.rotacao}deg)` : "",
          componente.flipH || componente.flipV ? `scale(${componente.flipH ? -1 : 1}, ${componente.flipV ? -1 : 1})` : "",
          ajusteVisual?.escalaAjustada ? `scale(${ajusteVisual.escalaAjustada})` : "",
        ].filter(Boolean).join(" ") || undefined,
        outline: selecionado ? "2px solid rgb(99,102,241)" : "none",
        outlineOffset: 2,
        cursor: dentroDeContainer ? "pointer" : "grab",
        opacity: (ajusteVisual?.opacityAjustada ?? 1) * (componente.opacidade ?? 1),
        filter: ajusteVisual?.blurAjustado ? "blur(3px)" : undefined,
        transition: ajusteVisual ? "opacity 0.3s ease, filter 0.3s ease, transform 0.3s ease" : undefined,
      }}
    >
      {ehContainer ? (
        // Card/Grid: renderiza os filhos como ComponenteNoCanvas (não RenderComponente puro),
        // para que cada filho seja individualmente selecionável/arrastável dentro do container.
        <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
          <RenderComponenteContainer componente={componente} portalProximoSlide={portalProximoSlide} />
        </div>
      ) : (
        <ScrollRevealWrapper animacoes={animacoesDoComponente}>
          <RenderComponente componente={componente} modo="editor" portalProximoSlide={portalProximoSlide} />
        </ScrollRevealWrapper>
      )}

      {selecionado && !dentroDeContainer && (
        <>
          {HANDLES.map((h) => (
            <div
              key={h.pos}
              data-editor-only="true"
              onMouseDown={onMouseDownRedimensionar(h.pos)}
              className={`absolute h-3 w-3 rounded-sm border border-white bg-indigo-500 ${h.className}`}
            />
          ))}
        </>
      )}
    </div>
  );
}

/**
 * Detecta se o container tem stagger ativo, em QUALQUER uma das duas fontes possíveis
 * (Fase 03 — fecha a dívida técnica registrada desde a Onda 3):
 * (a) formato antigo — `componente.animacao.entrada.tipo === "stagger"`, delay em `staggerDelay`;
 * (b) formato novo — `ElementAnimation` do tipo "stagger" em `Slide.animacaoConfig.timeline`,
 *     filtrado por `elementId === componente.id` (StaggerConfig vive no nível SLIDE, não no
 *     componente — decisão registrada em `.bibble/memory/decisions.md`, 2026-08-06).
 * Retorna o delay entre filhos, ou `null` se nenhuma fonte tiver stagger configurado.
 */
function useStaggerDelayAtivo(componenteId: string, animacaoAntiga: ComponenteSlide["animacao"]): number | null {
  const animacoesNovoModelo = useEditorStore((s) => s.animacaoConfig?.timeline?.animations);

  if (animacaoAntiga?.entrada?.tipo === "stagger") {
    return animacaoAntiga.entrada.staggerDelay ?? 0.1;
  }

  const staggerNovo = animacoesNovoModelo?.find((a) => a.elementId === componenteId && a.type === "stagger");
  if (staggerNovo?.stagger) {
    return staggerNovo.stagger.intervalo;
  }

  return null;
}

/** Card/Grid/Container com filhos navegáveis individualmente (não usa RenderComponente.* puro, que é só leitura). */
function RenderComponenteContainer({
  componente,
  portalProximoSlide,
}: {
  componente: Extract<ComponenteSlide, { tipo: "card" | "grid" | "container" }>;
  portalProximoSlide?: ReactNode;
}) {
  const staggerDelay = useStaggerDelayAtivo(componente.id, componente.animacao);
  const staggerAtivo = staggerDelay !== null;

  // Sem componentes-wrapper aninhados (proibido pelo React Compiler — "Cannot create
  // components during render"): a escolha motion.div vs div é feita inline, reaproveitando
  // as MESMAS variants de `nucleo.tsx`/`FilhosContainer` sem duplicar lógica de animação.
  function renderFilhos(filhos: ComponenteSlide[], estiloFilho: (filho: ComponenteSlide) => React.CSSProperties) {
    return filhos.map((filho) =>
      staggerAtivo ? (
        <motion.div key={filho.id} style={estiloFilho(filho)} variants={staggerItemVariants}>
          <ComponenteNoCanvas componente={filho} dentroDeContainer portalProximoSlide={portalProximoSlide} />
        </motion.div>
      ) : (
        <div key={filho.id} style={estiloFilho(filho)}>
          <ComponenteNoCanvas componente={filho} dentroDeContainer portalProximoSlide={portalProximoSlide} />
        </div>
      ),
    );
  }

  if (componente.tipo === "card") {
    const style: React.CSSProperties = {
      width: "100%",
      height: "100%",
      background: componente.corFundo ?? "transparent",
      borderRadius: componente.borderRadius ?? 0,
      padding: componente.padding ?? 0,
      position: "relative",
      boxSizing: "border-box",
      border: componente.larguraBorda
        ? `${componente.larguraBorda}px ${componente.estiloBorda ?? "solid"} ${componente.corBorda ?? "transparent"}`
        : undefined,
      boxShadow: componente.sombra
        ? `${componente.sombra.inset ? "inset " : ""}${componente.sombra.x}px ${componente.sombra.y}px ${componente.sombra.blur}px ${componente.sombra.spread}px ${componente.sombra.color}`
        : undefined,
    };
    const filhos = renderFilhos(componente.filhos, (filho) => ({
      position: "absolute",
      left: filho.x,
      top: filho.y,
      width: filho.w,
      height: filho.h,
    }));
    return staggerAtivo ? (
      <motion.div style={style} initial="hidden" animate="show" variants={staggerContainerVariants(staggerDelay)}>
        {filhos}
      </motion.div>
    ) : (
      <div style={style}>{filhos}</div>
    );
  }

  if (componente.tipo === "container") {
    const styleLayout: React.CSSProperties =
      componente.layout === "grid"
        ? { display: "grid", gridTemplateColumns: `repeat(${componente.colunas ?? 2}, 1fr)`, gap: componente.gap ?? 0 }
        : componente.layout === "flex-row"
          ? { display: "flex", flexDirection: "row", gap: componente.gap ?? 0 }
          : componente.layout === "stack"
            ? { position: "relative" }
            : { display: "flex", flexDirection: "column", gap: componente.gap ?? 0 };
    const style: React.CSSProperties = { width: "100%", height: "100%", background: componente.corFundo ?? "transparent", ...styleLayout };
    const filhos = renderFilhos(componente.filhos, (filho) =>
      componente.layout === "stack"
        ? { position: "absolute", left: filho.x, top: filho.y, width: filho.w, height: filho.h }
        : { position: "relative", width: filho.w, height: filho.h },
    );
    return staggerAtivo ? (
      <motion.div style={style} initial="hidden" animate="show" variants={staggerContainerVariants(staggerDelay)}>
        {filhos}
      </motion.div>
    ) : (
      <div style={style}>{filhos}</div>
    );
  }

  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "grid",
    gridTemplateColumns: `repeat(${componente.colunas}, 1fr)`,
    gap: componente.gap ?? 0,
  };
  const filhos = renderFilhos(componente.filhos, () => ({ position: "relative" }));
  return staggerAtivo ? (
    <motion.div style={style} initial="hidden" animate="show" variants={staggerContainerVariants(staggerDelay)}>
      {filhos}
    </motion.div>
  ) : (
    <div style={style}>{filhos}</div>
  );
}
