import { describe, expect, it } from "vitest";
import { COMPONENTES_REGISTRY } from "@/components/Apresentacoes/Editor/registry/componentes-registry";
import { componenteSchema, dadosSlideSchema } from "@/lib/validations/slide-componentes";
import { calcularEscalaApresentacao } from "@/lib/apresentacoes/viewport";
import {
  centralizarComponenteNoSlide,
  converterDimensoesEntrePalcos,
  criarClipInicialAbertura,
  criarClipInicialContainer,
  CONTAINER_CAPA_SCALE_X,
  DIMENSOES_CONTAINER_CAPA,
} from "@/lib/apresentacoes/container-intro";
import { MENSAGEM_SEM_PROXIMO_SLIDE, obterProximoSlide } from "@/lib/apresentacoes/proximo-slide";
import {
  ANIMACAO_CONTAINER_ALPHA_PADRAO,
  criarComponenteAnimacaoContainerAlpha,
  normalizarConfigAnimacaoContainerAlpha,
  obterAnimacaoContainerAlpha,
} from "@/lib/apresentacoes/animacao-container-alpha";
import { CANVAS_PADRAO } from "@/lib/apresentacoes/canvas";
import { configAnimacaoSchema } from "@/lib/validations/animacao";

describe("Container Alpha do Presentation Studio", () => {
  it("gera defaults válidos no registry 3D", () => {
    const componente = COMPONENTES_REGISTRY.containerCarga.criarComponentePadrao(120, 80);

    expect(componente.tipo).toBe("containerCarga");
    expect(componente).toMatchObject({ x: 120, y: 80, w: 640, h: 360 });
    expect(componente.w / componente.h).toBeCloseTo(16 / 9);
    expect(componente).toMatchObject({
      transicaoProximoSlide: true,
      duracaoZoom: 1.4,
      somHabilitado: false,
      somAbertura: "industrial",
      volumeSom: 0.65,
      estadoEditor: "aberto",
    });
    expect(componenteSchema.safeParse(componente).success).toBe(true);
    expect(dadosSlideSchema.safeParse({ componentes: [componente] }).success).toBe(true);
  });

  it("persiste o Container Alpha dentro do select de animação de entrada do componente", () => {
    const base = COMPONENTES_REGISTRY.containerCarga.criarComponentePadrao(0, 0);
    const resultado = dadosSlideSchema.parse({
      componentes: [{
        ...base,
        animacao: {
          entrada: {
            tipo: "container-alpha",
            duracao: 0.5,
            delay: 0,
            easing: "easeInOut",
            containerAlpha: ANIMACAO_CONTAINER_ALPHA_PADRAO,
          },
        },
      }],
      canvas: CANVAS_PADRAO,
    });

    expect(resultado.componentes[0].animacao?.entrada?.tipo).toBe("container-alpha");
    expect(obterAnimacaoContainerAlpha(resultado.componentes)).toMatchObject(ANIMACAO_CONTAINER_ALPHA_PADRAO);
  });

  it("converte a configuração da animação em uma transição fullscreen", () => {
    const componente = criarComponenteAnimacaoContainerAlpha(ANIMACAO_CONTAINER_ALPHA_PADRAO, CANVAS_PADRAO);

    expect(componente).toMatchObject({
      tipo: "containerCarga",
      x: 0,
      y: 0,
      w: CANVAS_PADRAO.width,
      h: CANVAS_PADRAO.height,
      transicaoProximoSlide: true,
      estadoEditor: "aberto",
    });
    expect(componenteSchema.safeParse(componente).success).toBe(true);
  });

  it("normaliza defaults e rejeita cores inválidas na animação Container Alpha", () => {
    expect(configAnimacaoSchema.parse({
      tipo: "container-alpha",
      duracao: 0.5,
      delay: 0,
      easing: "easeInOut",
      containerAlpha: {},
    }).containerAlpha).toMatchObject(ANIMACAO_CONTAINER_ALPHA_PADRAO);
    expect(normalizarConfigAnimacaoContainerAlpha({ corPrincipal: "azul" })).toEqual(ANIMACAO_CONTAINER_ALPHA_PADRAO);
  });

  it("resolve o próximo slide pela ordem e informa quando ele não existe", () => {
    const slides = [
      { id: "slide-3", ordem: 2, componentes: [] },
      { id: "slide-1", ordem: 0, componentes: [] },
      { id: "slide-2", ordem: 1, componentes: [] },
    ];

    expect(obterProximoSlide(slides, "slide-1")?.id).toBe("slide-2");
    expect(obterProximoSlide(slides, "slide-3")).toBeUndefined();
    expect(MENSAGEM_SEM_PROXIMO_SLIDE).toBe("Adicione um slide para ver a prévia");
  });

  it("preserva as propriedades editáveis do container", () => {
    const base = COMPONENTES_REGISTRY.containerCarga.criarComponentePadrao(0, 0);
    const resultado = componenteSchema.parse({
      ...base,
      corPrincipal: "#123456",
      corMetal: "#abcdef",
      corInterior: "#ffffff",
      anguloAbertura: 90,
      duracaoAbertura: 2.4,
      atrasoAbertura: 0.8,
      transicaoProximoSlide: false,
      duracaoZoom: 2.2,
      somHabilitado: true,
      somAbertura: "hidraulico",
      volumeSom: 0.4,
      mostrarLogo: false,
      estadoEditor: "aberto",
    });

    expect(resultado).toMatchObject({
      tipo: "containerCarga",
      corPrincipal: "#123456",
      anguloAbertura: 90,
      duracaoAbertura: 2.4,
      atrasoAbertura: 0.8,
      transicaoProximoSlide: false,
      duracaoZoom: 2.2,
      somHabilitado: true,
      somAbertura: "hidraulico",
      volumeSom: 0.4,
      mostrarLogo: false,
      estadoEditor: "aberto",
    });
  });

  it.each([
    ["ângulo abaixo do mínimo", { anguloAbertura: 44 }],
    ["ângulo acima do máximo", { anguloAbertura: 121 }],
    ["duração curta demais", { duracaoAbertura: 0.1 }],
    ["atraso negativo", { atrasoAbertura: -0.1 }],
    ["zoom curto demais", { duracaoZoom: 0.2 }],
    ["volume acima do máximo", { volumeSom: 1.1 }],
    ["som desconhecido", { somAbertura: "porto" }],
    ["cor fora do formato hexadecimal", { corPrincipal: "azul" }],
  ])("rejeita %s", (_cenario, patch) => {
    const base = COMPONENTES_REGISTRY.containerCarga.criarComponentePadrao(0, 0);
    expect(componenteSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });

  it("mantém o slide inteiro responsivo em viewports desktop e mobile", () => {
    expect(calcularEscalaApresentacao(1920, 1080)).toBe(1.5);
    expect(calcularEscalaApresentacao(360, 800)).toBeCloseTo(360 / 1280);
    expect(calcularEscalaApresentacao(800, 360)).toBe(0.5);
  });

  it("centraliza o componente sem alterar suas dimensões", () => {
    expect(centralizarComponenteNoSlide({ w: 420, h: 360 })).toEqual({ x: 430, y: 180 });
    expect(centralizarComponenteNoSlide({ w: 1280, h: 720 })).toEqual({ x: 0, y: 0 });
  });

  it("usa o palco inteiro para o container de capa durante a apresentação", () => {
    expect(DIMENSOES_CONTAINER_CAPA).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
    expect(CONTAINER_CAPA_SCALE_X).toBeGreaterThan(2);
  });

  it("cria um recorte inicial alinhado ao container e limitado ao palco", () => {
    const clip = criarClipInicialContainer({ x: 430, y: 180, w: 420, h: 360 });
    expect(clip).toMatch(/^inset\(.+ round 18px\)$/);
    expect(clip).not.toContain("-");
  });

  it("usa a abertura projetada sem aplicar uma segunda margem", () => {
    const clip = criarClipInicialAbertura({ x: 500, y: 200, w: 200, h: 300 });
    expect(clip).toContain("27.77777777777778%");
    expect(clip).toContain("39.0625%");
  });

  it("converte a abertura fullscreen para as coordenadas lógicas do slide", () => {
    expect(converterDimensoesEntrePalcos(
      { x: 480, y: 270, w: 960, h: 540 },
      { w: 1920, h: 1080 },
      { w: 1280, h: 720 },
    )).toEqual({ x: 320, y: 180, w: 640, h: 360 });
  });

  it("preenche os novos defaults ao ler um container salvo antes desta evolução", () => {
    const atual = COMPONENTES_REGISTRY.containerCarga.criarComponentePadrao(0, 0);
    const legado = { ...atual } as Record<string, unknown>;
    delete legado.transicaoProximoSlide;
    delete legado.duracaoZoom;
    delete legado.somHabilitado;
    delete legado.somAbertura;
    delete legado.volumeSom;

    expect(componenteSchema.parse(legado)).toMatchObject({
      transicaoProximoSlide: true,
      duracaoZoom: 1.4,
      somHabilitado: false,
      somAbertura: "industrial",
      volumeSom: 0.65,
    });
  });
});
