import { registrarAnimacao, type AnimationDefinition } from "./registry";
import { criarAnimationController } from "./motor";
import { CONFIG_BORDER_DRAW_PADRAO } from "./border-draw";

/**
 * Catálogo completo de animações de Entrada/Saída/Ênfase (Seções 5/6/7 do prompt
 * original). Efeitos "simples" foram registrados na Fase 02; a Fase 07 adiciona os
 * compostos (Card Expand, Color Fill, Border Draw completo, Counter, Bar Grow, Dim
 * Others, Focus Element) e estende a entrada `border-draw` já existente (nunca duplicada).
 *
 * Importar este módulo (side-effect only) preenche o registry — feito 1x na inicialização
 * do editor/player (ver `registry.ts`).
 */

type Def = Pick<AnimationDefinition, "id" | "name" | "category" | "description" | "supportedProperties"> & {
  defaultDuration?: number;
  defaultTrigger?: AnimationDefinition["defaultTrigger"];
  customProperties?: Record<string, unknown>;
};

function def({ id, name, category, description, supportedProperties, defaultDuration = 0.5, defaultTrigger, customProperties }: Def): void {
  registrarAnimacao({
    id,
    name,
    category,
    description,
    defaultDuration,
    defaultTrigger,
    defaultEasing: { curva: "easeOut" },
    supportedProperties,
    createAnimation: (_element, config) =>
      criarAnimationController(customProperties ? { ...config, customProperties: { ...customProperties, ...config.customProperties } } : config),
  });
}

// ===== Opacidade — Entrada =====
def({ id: "fade-in", name: "Fade In", category: "entrance", description: "Aparece via opacidade, sem movimento.", supportedProperties: ["opacity"] });
def({ id: "fade-up", name: "Fade Up", category: "entrance", description: "Aparece subindo levemente.", supportedProperties: ["opacity", "transform"] });
def({ id: "fade-down", name: "Fade Down", category: "entrance", description: "Aparece descendo levemente.", supportedProperties: ["opacity", "transform"] });
def({ id: "fade-left", name: "Fade Left", category: "entrance", description: "Aparece vindo da direita.", supportedProperties: ["opacity", "transform"] });
def({ id: "fade-right", name: "Fade Right", category: "entrance", description: "Aparece vindo da esquerda.", supportedProperties: ["opacity", "transform"] });
def({ id: "blur-in", name: "Blur In", category: "entrance", description: "Aparece desfocado, foca gradualmente.", supportedProperties: ["opacity", "filter"] });
def({ id: "dissolve-in", name: "Dissolve In", category: "entrance", description: "Dissolve suavemente até opaco.", supportedProperties: ["opacity"] });

// ===== Movimento — Entrada =====
def({ id: "slide-in-left", name: "Slide In Left", category: "entrance", description: "Desliza a partir da esquerda.", supportedProperties: ["transform", "opacity"] });
def({ id: "slide-in-right", name: "Slide In Right", category: "entrance", description: "Desliza a partir da direita.", supportedProperties: ["transform", "opacity"] });
def({ id: "slide-in-up", name: "Slide In Up", category: "entrance", description: "Desliza de baixo para cima.", supportedProperties: ["transform", "opacity"] });
def({ id: "slide-in-down", name: "Slide In Down", category: "entrance", description: "Desliza de cima para baixo.", supportedProperties: ["transform", "opacity"] });
def({ id: "fly-in-left", name: "Fly In Left", category: "entrance", description: "Voa a partir da esquerda, distância maior que Slide.", supportedProperties: ["transform", "opacity"] });
def({ id: "fly-in-right", name: "Fly In Right", category: "entrance", description: "Voa a partir da direita.", supportedProperties: ["transform", "opacity"] });
def({ id: "fly-in-up", name: "Fly In Up", category: "entrance", description: "Voa de baixo para cima.", supportedProperties: ["transform", "opacity"] });
def({ id: "fly-in-down", name: "Fly In Down", category: "entrance", description: "Voa de cima para baixo.", supportedProperties: ["transform", "opacity"] });

// ===== Escala — Entrada =====
def({ id: "scale-in", name: "Scale In", category: "entrance", description: "Cresce levemente até o tamanho normal.", supportedProperties: ["transform", "opacity"] });
def({ id: "zoom-in", name: "Zoom In", category: "entrance", description: "Aproxima (escala menor para maior).", supportedProperties: ["transform", "opacity"] });
def({ id: "pop-in", name: "Pop In", category: "entrance", description: "Surge rapidamente de escala reduzida.", supportedProperties: ["transform", "opacity"] });
def({ id: "bounce-in", name: "Bounce In", category: "entrance", description: "Cresce com efeito de salto (spring).", supportedProperties: ["transform", "opacity"], defaultDuration: 0.7 });
def({ id: "elastic-in", name: "Elastic In", category: "entrance", description: "Cresce com efeito elástico pronunciado (spring).", supportedProperties: ["transform", "opacity"], defaultDuration: 0.8 });

// ===== Cascata (Fase 03 — Seção 10 do prompt original) =====
// "stagger" é uma entrada especial: aplicada a um CONTAINER (card/grid/container), anima os
// filhos em cascata via `StaggerConfig` (não anima o próprio container). Ver
// `AnimacaoItemForm.tsx` (só mostra os controles de stagger quando `ehContainer` é true) e
// `ComponenteNoCanvas.tsx` (`useStaggerDelayAtivo`, consome esta config dentro do Editor).
def({ id: "stagger", name: "Cascata (Stagger)", category: "entrance", description: "Anima os filhos do container em cascata, na ordem configurada.", supportedProperties: ["opacity", "transform"] });

// ===== Rotação — Entrada =====
def({ id: "rotate-in", name: "Rotate In", category: "entrance", description: "Gira ao aparecer.", supportedProperties: ["transform", "opacity"] });
def({ id: "rotate-in-left", name: "Rotate In Left", category: "entrance", description: "Gira vindo da esquerda.", supportedProperties: ["transform", "opacity"] });
def({ id: "rotate-in-right", name: "Rotate In Right", category: "entrance", description: "Gira vindo da direita.", supportedProperties: ["transform", "opacity"] });
def({ id: "flip-in-horizontal", name: "Flip In Horizontal", category: "entrance", description: "Vira no eixo horizontal.", supportedProperties: ["transform", "opacity"] });
def({ id: "flip-in-vertical", name: "Flip In Vertical", category: "entrance", description: "Vira no eixo vertical.", supportedProperties: ["transform", "opacity"] });

// ===== Revelação — Entrada =====
def({ id: "mask-reveal-left", name: "Mask Reveal Left", category: "entrance", description: "Revela a partir da esquerda.", supportedProperties: ["opacity", "transform"] });
def({ id: "mask-reveal-right", name: "Mask Reveal Right", category: "entrance", description: "Revela a partir da direita.", supportedProperties: ["opacity", "transform"] });
def({ id: "mask-reveal-up", name: "Mask Reveal Up", category: "entrance", description: "Revela de baixo para cima.", supportedProperties: ["opacity", "transform"] });
def({ id: "mask-reveal-down", name: "Mask Reveal Down", category: "entrance", description: "Revela de cima para baixo.", supportedProperties: ["opacity", "transform"] });
def({ id: "center-reveal", name: "Center Reveal", category: "entrance", description: "Revela a partir do centro.", supportedProperties: ["opacity", "transform"] });
def({ id: "split-reveal", name: "Split Reveal", category: "entrance", description: "Revela em divisão (aproximação).", supportedProperties: ["opacity", "transform"] });
def({ id: "curtain-reveal", name: "Curtain Reveal", category: "entrance", description: "Revela como cortina.", supportedProperties: ["opacity", "transform"] });
def({
  id: "border-draw",
  name: "Border Draw",
  category: "entrance",
  description: "Borda desenhada progressivamente ao redor do elemento (sentido/início/espessura/cor configuráveis).",
  supportedProperties: ["opacity"],
  customProperties: { borderDraw: CONFIG_BORDER_DRAW_PADRAO },
});
def({ id: "outline-reveal", name: "Outline Reveal", category: "entrance", description: "Contorno revelado progressivamente.", supportedProperties: ["opacity"] });
def({ id: "line-draw", name: "Line Draw", category: "entrance", description: "Linha desenhada progressivamente.", supportedProperties: ["opacity"] });

// ===== Saída (Seção 6) =====
def({ id: "fade-out", name: "Fade Out", category: "exit", description: "Desaparece via opacidade.", supportedProperties: ["opacity"] });
def({ id: "fade-up-out", name: "Fade Up Out", category: "exit", description: "Desaparece subindo.", supportedProperties: ["opacity", "transform"] });
def({ id: "fade-down-out", name: "Fade Down Out", category: "exit", description: "Desaparece descendo.", supportedProperties: ["opacity", "transform"] });
def({ id: "fade-left-out", name: "Fade Left Out", category: "exit", description: "Desaparece para a esquerda.", supportedProperties: ["opacity", "transform"] });
def({ id: "fade-right-out", name: "Fade Right Out", category: "exit", description: "Desaparece para a direita.", supportedProperties: ["opacity", "transform"] });
def({ id: "slide-out-left", name: "Slide Out Left", category: "exit", description: "Desliza para fora à esquerda.", supportedProperties: ["transform", "opacity"] });
def({ id: "slide-out-right", name: "Slide Out Right", category: "exit", description: "Desliza para fora à direita.", supportedProperties: ["transform", "opacity"] });
def({ id: "slide-out-up", name: "Slide Out Up", category: "exit", description: "Desliza para fora por cima.", supportedProperties: ["transform", "opacity"] });
def({ id: "slide-out-down", name: "Slide Out Down", category: "exit", description: "Desliza para fora por baixo.", supportedProperties: ["transform", "opacity"] });
def({ id: "zoom-out", name: "Zoom Out", category: "exit", description: "Afasta (escala maior para menor) e desaparece.", supportedProperties: ["transform", "opacity"] });
def({ id: "scale-out", name: "Scale Out", category: "exit", description: "Encolhe levemente e desaparece.", supportedProperties: ["transform", "opacity"] });
def({ id: "blur-out", name: "Blur Out", category: "exit", description: "Desfoca até desaparecer.", supportedProperties: ["opacity", "filter"] });
def({ id: "dissolve-out", name: "Dissolve Out", category: "exit", description: "Dissolve suavemente até transparente.", supportedProperties: ["opacity"] });
def({ id: "rotate-out", name: "Rotate Out", category: "exit", description: "Gira ao desaparecer.", supportedProperties: ["transform", "opacity"] });
def({ id: "flip-out", name: "Flip Out", category: "exit", description: "Vira ao desaparecer.", supportedProperties: ["transform", "opacity"] });
def({ id: "collapse", name: "Collapse", category: "exit", description: "Colapsa verticalmente (scaleY).", supportedProperties: ["transform", "opacity"] });
def({ id: "mask-close", name: "Mask Close", category: "exit", description: "Fecha como máscara.", supportedProperties: ["opacity", "transform"] });
def({ id: "shrink-to-point", name: "Shrink to Point", category: "exit", description: "Encolhe até um ponto.", supportedProperties: ["transform", "opacity"] });

// ===== Ênfase simples (Seção 7 — sem Dim Others/Focus Element/Color Fill/Border Draw completo, Fase 07) =====
def({ id: "pulse", name: "Pulse", category: "emphasis", description: "Pulsação de escala.", supportedProperties: ["transform"], defaultDuration: 1 });
def({ id: "heartbeat", name: "Heartbeat", category: "emphasis", description: "Pulsação dupla, como batimento.", supportedProperties: ["transform"], defaultDuration: 1 });
def({ id: "bounce", name: "Bounce", category: "emphasis", description: "Salto vertical contínuo.", supportedProperties: ["transform"], defaultDuration: 0.6 });
def({ id: "shake", name: "Shake", category: "emphasis", description: "Tremor horizontal.", supportedProperties: ["transform"], defaultDuration: 0.5 });
def({ id: "wiggle", name: "Wiggle", category: "emphasis", description: "Rotação leve alternada.", supportedProperties: ["transform"], defaultDuration: 0.5 });
def({ id: "swing", name: "Swing", category: "emphasis", description: "Balanço como pêndulo.", supportedProperties: ["transform"], defaultDuration: 0.8 });
def({ id: "float", name: "Float", category: "emphasis", description: "Flutuação suave contínua.", supportedProperties: ["transform"], defaultDuration: 2 });
def({ id: "glow", name: "Glow", category: "emphasis", description: "Brilho pulsante.", supportedProperties: ["filter"], defaultDuration: 1.5 });
def({ id: "flash", name: "Flash", category: "emphasis", description: "Piscada rápida de opacidade.", supportedProperties: ["opacity"], defaultDuration: 0.4 });
def({ id: "blink", name: "Blink", category: "emphasis", description: "Piscar contínuo.", supportedProperties: ["opacity"], defaultDuration: 0.8 });
def({ id: "highlight", name: "Highlight", category: "emphasis", description: "Destaque de opacidade.", supportedProperties: ["opacity"], defaultDuration: 1 });
def({ id: "color-shift", name: "Color Shift", category: "emphasis", description: "Variação sutil de opacidade (proxy de cor nesta fase).", supportedProperties: ["opacity"], defaultDuration: 1 });
def({ id: "border-pulse", name: "Border Pulse", category: "emphasis", description: "Pulsação de borda (proxy de opacidade nesta fase).", supportedProperties: ["opacity"], defaultDuration: 1 });
def({ id: "scale-pulse", name: "Scale Pulse", category: "emphasis", description: "Pulsação de escala contínua.", supportedProperties: ["transform"], defaultDuration: 1 });
def({ id: "rotate-pulse", name: "Rotate Pulse", category: "emphasis", description: "Pulsação de rotação leve.", supportedProperties: ["transform"], defaultDuration: 1 });
def({ id: "blur-focus", name: "Blur Focus", category: "emphasis", description: "Alterna foco/desfoque.", supportedProperties: ["filter"], defaultDuration: 1.2 });

// ===== Efeitos Especiais (Fase 07 — Seção 8 do prompt original) =====

// --- Card Expand / Expand to Focus ---
def({
  id: "card-expand",
  name: "Card Expand",
  category: "emphasis",
  description: "Um card selecionado cresce e ocupa uma área maior do slide.",
  supportedProperties: ["transform", "opacity"],
  defaultDuration: 0.6,
  customProperties: { modo: "centro", escurecerOutros: true, ocultarOutros: false, alterarBorderRadius: false },
});
def({
  id: "expand-to-focus",
  name: "Expand to Focus",
  category: "emphasis",
  description: "Elemento sai da posição, cresce, move-se para o destaque e reduz os secundários.",
  supportedProperties: ["transform", "opacity"],
  defaultDuration: 0.8,
});

// --- Color Fill (Seção 8 — 7 direções, ver color-fill.ts) ---
def({
  id: "color-fill",
  name: "Color Fill",
  category: "emphasis",
  description: "Fundo do elemento preenchido gradualmente (esquerda→direita, direita→esquerda, cima→baixo, baixo→cima, centro→fora, radial, diagonal).",
  supportedProperties: ["opacity"],
  defaultDuration: 0.8,
  customProperties: { direcao: "left-to-right", cor: "#6366f1" },
});

// --- Counter (Seção 8 — 6 tipos, ver counter.ts) ---
def({ id: "count-up", name: "Count Up", category: "entrance", description: "Contador numérico crescente.", supportedProperties: ["opacity"], defaultDuration: 1.5 });
def({ id: "count-down", name: "Count Down", category: "entrance", description: "Contador numérico decrescente.", supportedProperties: ["opacity"], defaultDuration: 1.5 });
def({ id: "percent-counter", name: "Percent Counter", category: "entrance", description: "Contador percentual.", supportedProperties: ["opacity"], defaultDuration: 1.5 });
def({ id: "currency-counter", name: "Currency Counter", category: "entrance", description: "Contador em formato monetário.", supportedProperties: ["opacity"], defaultDuration: 1.5 });
def({ id: "decimal-counter", name: "Decimal Counter", category: "entrance", description: "Contador com casas decimais.", supportedProperties: ["opacity"], defaultDuration: 1.5 });
def({ id: "compact-number-counter", name: "Compact Number Counter", category: "entrance", description: "Contador compacto (ex: 1,8mi).", supportedProperties: ["opacity"], defaultDuration: 1.5 });

// --- Bar Grow (Seção 8 — 5 direções, ver bar-grow.ts) ---
def({ id: "bar-grow-horizontal-ltr", name: "Bar Grow →", category: "entrance", description: "Barra cresce da esquerda para a direita (scaleX).", supportedProperties: ["transform"], defaultDuration: 0.8 });
def({ id: "bar-grow-horizontal-rtl", name: "Bar Grow ←", category: "entrance", description: "Barra cresce da direita para a esquerda (scaleX).", supportedProperties: ["transform"], defaultDuration: 0.8 });
def({ id: "bar-grow-vertical-btt", name: "Bar Grow ↑", category: "entrance", description: "Barra cresce de baixo para cima (scaleY).", supportedProperties: ["transform"], defaultDuration: 0.8 });
def({ id: "bar-grow-vertical-ttb", name: "Bar Grow ↓", category: "entrance", description: "Barra cresce de cima para baixo (scaleY).", supportedProperties: ["transform"], defaultDuration: 0.8 });
def({ id: "bar-grow-center", name: "Bar Grow (centro)", category: "entrance", description: "Barra cresce a partir do centro (scaleX).", supportedProperties: ["transform"], defaultDuration: 0.8 });

// --- Dim Others / Focus Element (Seção 7/8 — afetam os IRMÃOS do slide, ver EfeitosGlobaisSlide.tsx) ---
def({
  id: "dim-others",
  name: "Dim Others",
  category: "emphasis",
  description: "Reduz a opacidade (e opcionalmente aplica blur leve) dos demais elementos do slide, mantendo o selecionado intacto.",
  supportedProperties: ["opacity", "filter"],
  defaultDuration: 0.5,
  customProperties: { nivelEscurecimento: 0.6, aplicarBlur: false },
});
def({
  id: "focus-element",
  name: "Focus Element",
  category: "emphasis",
  description: "Destaca o elemento via escala, brilho, sombra e escurecimento do fundo (combina-se com Dim Others).",
  supportedProperties: ["transform", "filter"],
  defaultDuration: 0.5,
  customProperties: { escala: 1.08, brilho: true, sombra: true },
});

// ===== Interação — hover e clique =====
def({ id: "hover-lift", name: "Elevar ao passar", category: "interaction", description: "Eleva e amplia suavemente enquanto o ponteiro está sobre o elemento.", supportedProperties: ["transform"], defaultDuration: 0.25, defaultTrigger: "on-hover" });
def({ id: "hover-grow", name: "Ampliar ao passar", category: "interaction", description: "Amplia o elemento enquanto o ponteiro está sobre ele.", supportedProperties: ["transform"], defaultDuration: 0.2, defaultTrigger: "on-hover" });
def({ id: "hover-glow", name: "Brilhar ao passar", category: "interaction", description: "Aplica brilho e destaque enquanto o ponteiro está sobre o elemento.", supportedProperties: ["filter"], defaultDuration: 0.25, defaultTrigger: "on-hover" });
def({ id: "hover-tilt", name: "Inclinar ao passar", category: "interaction", description: "Inclina levemente o elemento durante o hover.", supportedProperties: ["transform"], defaultDuration: 0.25, defaultTrigger: "on-hover" });
def({ id: "click-pulse", name: "Pulso ao clicar", category: "interaction", description: "Executa uma pulsação curta a cada clique.", supportedProperties: ["transform"], defaultDuration: 0.35, defaultTrigger: "on-click" });
def({ id: "click-bounce", name: "Salto ao clicar", category: "interaction", description: "Faz o elemento saltar e retornar ao lugar ao clicar.", supportedProperties: ["transform"], defaultDuration: 0.45, defaultTrigger: "on-click" });
def({ id: "click-shake", name: "Tremer ao clicar", category: "interaction", description: "Executa um tremor horizontal curto a cada clique.", supportedProperties: ["transform"], defaultDuration: 0.4, defaultTrigger: "on-click" });
def({ id: "click-flip", name: "Girar ao clicar", category: "interaction", description: "Faz uma volta completa no eixo vertical ao clicar.", supportedProperties: ["transform"], defaultDuration: 0.55, defaultTrigger: "on-click" });
