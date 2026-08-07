import type { ReactNode } from "react";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { SlideAnimationConfig } from "@/lib/apresentacoes/animacao/tipos";

export interface AjusteVisualEfeitoGlobal {
  opacityAjustada?: number;
  blurAjustado?: boolean;
  escalaAjustada?: number;
}

interface EfeitosGlobaisSlideProps {
  componentes: ComponenteSlide[];
  animacaoConfig: SlideAnimationConfig | undefined;
  children: (componente: ComponenteSlide, ajuste: AjusteVisualEfeitoGlobal) => ReactNode;
}

/**
 * Fase 07 (Alpha Motion) — wrapper de NÍVEL DE SLIDE para Dim Others/Focus Element/Card
 * Expand (Seções 7/8 do prompt original), que precisam "ver" e afetar os IRMÃOS de um
 * elemento — algo que `RenderComponente.tsx` nunca faz (é documentado como "PURA — sem
 * seleção/side-effects"). Mesmo princípio arquitetural de `FilhosContainer` (`nucleo.tsx`):
 * o pai orquestra o efeito sobre múltiplos filhos, cada filho permanece passivo — só recebe
 * o ajuste já calculado via render prop, nunca decide sozinho se deve escurecer/destacar.
 *
 * SIMPLIFICAÇÃO DOCUMENTADA: "quando uma animação está ativa" ainda não é resolvido pelo
 * motor de execução real (trigger/tempo, Fase 03/08) — aqui, qualquer `ElementAnimation` do
 * tipo `dim-others`/`focus-element`/`card-expand` presente na timeline do slide é tratada
 * como sempre ativa (preview estático no Editor). Disparo real por gatilho/tempo fica para
 * quando o motor imperativo (Fase 01) for conectado de fato ao playback (mesma limitação já
 * documentada em `PlayerControlsTimeline.tsx`, Fase 04).
 */
export function EfeitosGlobaisSlide({ componentes, animacaoConfig, children }: EfeitosGlobaisSlideProps) {
  const animacoes = animacaoConfig?.timeline?.animations ?? [];
  const efeitoAtivo = animacoes.find(
    (a) => a.type === "dim-others" || a.type === "focus-element" || a.type === "card-expand",
  );

  if (!efeitoAtivo) {
    return <>{componentes.map((c) => children(c, {}))}</>;
  }

  const props = (efeitoAtivo.customProperties ?? {}) as Record<string, unknown>;
  const nivelEscurecimento = typeof props.nivelEscurecimento === "number" ? props.nivelEscurecimento : 0.6;
  const aplicarBlur = props.aplicarBlur === true;
  const escala = typeof props.escala === "number" ? props.escala : 1.08;

  return (
    <>
      {componentes.map((c) => {
        if (c.id === efeitoAtivo.elementId) {
          return children(c, { escalaAjustada: escala });
        }
        return children(c, { opacityAjustada: 1 - nivelEscurecimento, blurAjustado: aplicarBlur });
      })}
    </>
  );
}
