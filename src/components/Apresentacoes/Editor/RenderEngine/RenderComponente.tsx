import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { ContainerIntroEvent } from "@/lib/apresentacoes/container-intro";
import type { ReactNode } from "react";
import type { SlideAnimationConfig } from "@/lib/apresentacoes/animacao/tipos";
import { resolverAnimacoesDoElemento } from "@/lib/apresentacoes/animacao/resolver";
import { AnimacaoWrapper, FilhosContainer } from "./nucleo";
import { AnimacaoElementoWrapper } from "./AnimacaoElementoWrapper";
import { ScrollRevealWrapper } from "./ScrollRevealWrapper";
import { GloboRender } from "./GloboRender";
import { ParticulasRender } from "./ParticulasRender";
import { ObjetoGlbRender } from "./ObjetoGlbRender";
import { ContainerCargaRender } from "./ContainerCargaRender";
import { TextoAnimado, RenderImagem, RenderVideo, RenderAudio, RenderBotao, RenderIcone, RenderDivisor } from "./render/RenderBasicos";
import {
  RenderGrafico,
  RenderTabela,
  RenderKpi,
  RenderProgresso,
  RenderRoadmap,
  RenderComparacao,
  RenderFaq,
  RenderChecklist,
} from "./render/RenderDados";
import { RenderGrafo, RenderDiagrama } from "./render/RenderBusiness";
import { RenderChatIlustrativo } from "./render/RenderIA";
import { RenderFundoAnimado } from "./render/RenderFundos";

/**
 * Única função que traduz 1 nó do JSON (ComponenteSlide) em JSX.
 * Recursiva para containers (card/grid/container). Genérica de propósito: reutilizada
 * pelo Editor (via ComponenteNoCanvas, que a envolve com seleção/drag), Modo Apresentação
 * e Export — nunca duplicar esta lógica em outro lugar.
 *
 * Dispatcher fino: cada categoria de componente tem seu próprio arquivo de render em
 * ./render/ — este arquivo só faz o switch e aplica a animação declarativa comum.
 */
export type ModoRenderComponente = "editor" | "apresentacao";

interface RenderComponenteProps {
  componente: ComponenteSlide;
  modo?: ModoRenderComponente;
  onContainerIntroStart?: (evento: ContainerIntroEvent) => void;
  onContainerIntroComplete?: () => void;
  portalProximoSlide?: ReactNode;
  pausado?: boolean;
  portalContainerCapa?: Element | null;
  animacaoConfig?: SlideAnimationConfig;
}

/**
 * Fronteira única do modelo novo. Quando existe timeline para o elemento, ela substitui a
 * animação legada daquele nó; sem timeline, o comportamento antigo permanece intacto.
 */
export function RenderComponenteAnimado(props: RenderComponenteProps) {
  const resolvidas = resolverAnimacoesDoElemento(props.componente, props.animacaoConfig);
  const animacoesNovas = resolvidas.filter((item) => item.origem === "novo-modelo").map((item) => item.animacao);
  if (animacoesNovas.length === 0) return <RenderComponente {...props} />;

  const componenteSemAnimacaoLegada = { ...props.componente, animacao: undefined } as ComponenteSlide;
  return (
    <ScrollRevealWrapper animacoes={animacoesNovas}>
      <AnimacaoElementoWrapper animacoes={animacoesNovas}>
        <RenderComponente {...props} componente={componenteSemAnimacaoLegada} />
      </AnimacaoElementoWrapper>
    </ScrollRevealWrapper>
  );
}

export function RenderComponente({
  componente,
  modo = "apresentacao",
  onContainerIntroStart,
  onContainerIntroComplete,
  portalProximoSlide,
  pausado = false,
  portalContainerCapa,
  animacaoConfig,
}: RenderComponenteProps) {
  const anim = componente.animacao?.entrada;

  switch (componente.tipo) {
    case "texto":
      return <TextoAnimado componente={componente} />;

    case "imagem":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderImagem componente={componente} />
        </AnimacaoWrapper>
      );

    case "video":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderVideo componente={componente} />
        </AnimacaoWrapper>
      );

    case "audio":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderAudio componente={componente} />
        </AnimacaoWrapper>
      );

    case "botao":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderBotao componente={componente} />
        </AnimacaoWrapper>
      );

    case "card":
      return (
        <AnimacaoWrapper animacao={anim}>
          <FilhosContainer
            style={{
              background: componente.corFundo ?? "transparent",
              borderRadius: componente.borderRadius ?? 0,
              padding: componente.padding ?? 0,
              position: "relative",
              overflow: "hidden",
              boxSizing: "border-box",
              border: componente.larguraBorda
                ? `${componente.larguraBorda}px ${componente.estiloBorda ?? "solid"} ${componente.corBorda ?? "transparent"}`
                : undefined,
              boxShadow: componente.sombra
                ? `${componente.sombra.inset ? "inset " : ""}${componente.sombra.x}px ${componente.sombra.y}px ${componente.sombra.blur}px ${componente.sombra.spread}px ${componente.sombra.color}`
                : undefined,
            }}
            filhos={componente.filhos}
            usaStagger={anim?.tipo === "stagger"}
            staggerDelay={anim?.staggerDelay ?? 0.1}
            renderFilho={(filho) => <RenderComponenteAnimado componente={filho} modo={modo} onContainerIntroStart={onContainerIntroStart} onContainerIntroComplete={onContainerIntroComplete} portalProximoSlide={portalProximoSlide} pausado={pausado} portalContainerCapa={portalContainerCapa} animacaoConfig={animacaoConfig} />}
          />
        </AnimacaoWrapper>
      );

    case "grid":
      return (
        <AnimacaoWrapper animacao={anim}>
          <FilhosContainer
            style={{ display: "grid", gridTemplateColumns: `repeat(${componente.colunas}, 1fr)`, gap: componente.gap ?? 0 }}
            filhos={componente.filhos}
            usaStagger={anim?.tipo === "stagger"}
            staggerDelay={anim?.staggerDelay ?? 0.1}
            renderFilho={(filho) => <RenderComponenteAnimado componente={filho} modo={modo} onContainerIntroStart={onContainerIntroStart} onContainerIntroComplete={onContainerIntroComplete} portalProximoSlide={portalProximoSlide} pausado={pausado} portalContainerCapa={portalContainerCapa} animacaoConfig={animacaoConfig} />}
          />
        </AnimacaoWrapper>
      );

    case "container": {
      const styleLayout: React.CSSProperties =
        componente.layout === "grid"
          ? { display: "grid", gridTemplateColumns: `repeat(${componente.colunas ?? 2}, 1fr)`, gap: componente.gap ?? 0 }
          : componente.layout === "flex-row"
            ? { display: "flex", flexDirection: "row", gap: componente.gap ?? 0 }
            : componente.layout === "stack"
              ? { position: "relative" }
              : { display: "flex", flexDirection: "column", gap: componente.gap ?? 0 };
      return (
        <AnimacaoWrapper animacao={anim}>
          <FilhosContainer
            style={{ ...styleLayout, background: componente.corFundo ?? "transparent" }}
            filhos={componente.filhos}
            usaStagger={anim?.tipo === "stagger"}
            staggerDelay={anim?.staggerDelay ?? 0.1}
            renderFilho={(filho) => <RenderComponenteAnimado componente={filho} modo={modo} onContainerIntroStart={onContainerIntroStart} onContainerIntroComplete={onContainerIntroComplete} portalProximoSlide={portalProximoSlide} pausado={pausado} portalContainerCapa={portalContainerCapa} animacaoConfig={animacaoConfig} />}
          />
        </AnimacaoWrapper>
      );
    }

    case "icone":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderIcone componente={componente} />
        </AnimacaoWrapper>
      );

    case "divisor":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderDivisor componente={componente} />
        </AnimacaoWrapper>
      );

    case "globo":
      return (
        <AnimacaoWrapper animacao={anim}>
          <GloboRender componente={componente} />
        </AnimacaoWrapper>
      );

    case "particulas":
      return (
        <AnimacaoWrapper animacao={anim}>
          <ParticulasRender componente={componente} />
        </AnimacaoWrapper>
      );

    case "objeto3d":
      return (
        <AnimacaoWrapper animacao={anim}>
          <ObjetoGlbRender componente={componente} />
        </AnimacaoWrapper>
      );

    case "containerCarga":
      return (
        <AnimacaoWrapper animacao={anim}>
          <ContainerCargaRender
            componente={componente}
            modo={modo}
            onIntroStart={onContainerIntroStart}
            onIntroComplete={onContainerIntroComplete}
            portalProximoSlide={portalProximoSlide}
            pausado={pausado}
            portalContainerCapa={portalContainerCapa}
          />
        </AnimacaoWrapper>
      );

    case "grafico":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderGrafico componente={componente} />
        </AnimacaoWrapper>
      );

    case "tabela":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderTabela componente={componente} />
        </AnimacaoWrapper>
      );

    case "kpi":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderKpi componente={componente} />
        </AnimacaoWrapper>
      );

    case "progresso":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderProgresso componente={componente} />
        </AnimacaoWrapper>
      );

    case "roadmap":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderRoadmap componente={componente} />
        </AnimacaoWrapper>
      );

    case "comparacao":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderComparacao componente={componente} />
        </AnimacaoWrapper>
      );

    case "faq":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderFaq componente={componente} />
        </AnimacaoWrapper>
      );

    case "checklist":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderChecklist componente={componente} />
        </AnimacaoWrapper>
      );

    case "grafo":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderGrafo componente={componente} />
        </AnimacaoWrapper>
      );

    case "diagrama":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderDiagrama componente={componente} />
        </AnimacaoWrapper>
      );

    case "chatIlustrativo":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderChatIlustrativo componente={componente} />
        </AnimacaoWrapper>
      );

    case "fundoAnimado":
      return (
        <AnimacaoWrapper animacao={anim}>
          <RenderFundoAnimado componente={componente} />
        </AnimacaoWrapper>
      );

    default:
      return null;
  }
}
