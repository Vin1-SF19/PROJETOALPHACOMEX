import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { AnimacaoWrapper, FilhosContainer } from "./nucleo";
import { GloboRender } from "./GloboRender";
import { ParticulasRender } from "./ParticulasRender";
import { ObjetoGlbRender } from "./ObjetoGlbRender";
import { TextoAnimado, RenderImagem, RenderVideo, RenderBotao, RenderIcone, RenderDivisor } from "./render/RenderBasicos";
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

/**
 * Única função que traduz 1 nó do JSON (ComponenteSlide) em JSX.
 * Recursiva para containers (card/grid/container). Genérica de propósito: reutilizada
 * pelo Editor (via ComponenteNoCanvas, que a envolve com seleção/drag), Modo Apresentação
 * e Export — nunca duplicar esta lógica em outro lugar.
 *
 * Dispatcher fino: cada categoria de componente tem seu próprio arquivo de render em
 * ./render/ — este arquivo só faz o switch e aplica a animação declarativa comum.
 */
export function RenderComponente({ componente }: { componente: ComponenteSlide }) {
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
            style={{ background: componente.corFundo ?? "transparent", borderRadius: componente.borderRadius ?? 0, padding: componente.padding ?? 0, position: "relative", overflow: "hidden" }}
            filhos={componente.filhos}
            usaStagger={anim?.tipo === "stagger"}
            staggerDelay={anim?.staggerDelay ?? 0.1}
            renderFilho={(filho) => <RenderComponente componente={filho} />}
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
            renderFilho={(filho) => <RenderComponente componente={filho} />}
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
            renderFilho={(filho) => <RenderComponente componente={filho} />}
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

    default:
      return null;
  }
}
