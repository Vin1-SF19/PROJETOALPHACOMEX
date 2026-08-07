/**
 * Fase 07 (Alpha Motion) - Border Draw completo (Secao 8 do prompt original). A Fase 02
 * ja registrou "border-draw" como animacao de entrada simples no catalogo - este arquivo
 * fornece a config rica (sentido/inicio/espessura/cor/duracao) que a MESMA entrada do
 * catalogo passa a aceitar via customProperties, sem criar uma segunda entrada.
 *
 * Tecnica escolhida: CSS `conic-gradient` mascarado - mais simples e mais barato em
 * performance que SVG com stroke-dasharray/dashoffset (evita criar/gerenciar um <svg>
 * proprio por elemento, reaproveita o mesmo estilo `background`/`mask` que o resto do
 * projeto ja usa para efeitos de borda).
 */
export const SENTIDO_BORDER_DRAW = ["horario", "anti-horario"] as const;
export type SentidoBorderDraw = (typeof SENTIDO_BORDER_DRAW)[number];

export const INICIO_BORDER_DRAW = ["topo", "esquerda", "centro"] as const;
export type InicioBorderDraw = (typeof INICIO_BORDER_DRAW)[number];

export interface ConfigBorderDraw {
  sentido: SentidoBorderDraw;
  inicio: InicioBorderDraw;
  espessura: number;
  cor: string;
  duracao: number;
}

export const CONFIG_BORDER_DRAW_PADRAO: ConfigBorderDraw = {
  sentido: "horario",
  inicio: "topo",
  espessura: 2,
  cor: "#6366f1",
  duracao: 1,
};

const ANGULO_INICIAL_POR_INICIO: Record<InicioBorderDraw, number> = {
  topo: 0,
  esquerda: 270,
  centro: 180,
};

/**
 * Gera o `background` CSS (conic-gradient) que desenha a borda progressivamente conforme
 * `progresso` (0 a 1). Aplicado num pseudo-elemento/`::before` com `mask` recortando só a
 * moldura (espessura definida em `config.espessura`) - o chamador (componente React) é
 * responsável por aplicar `mask`/`-webkit-mask` com essa espessura.
 */
export function conicGradientBorderDraw(config: ConfigBorderDraw, progresso: number): string {
  const p = Math.min(1, Math.max(0, progresso));
  const anguloBase = ANGULO_INICIAL_POR_INICIO[config.inicio] ?? 0;
  const grausPreenchidos = p * 360;
  const direcao = config.sentido === "anti-horario" ? "-1" : "1";
  // `from` aceita ângulo negativo (sentido anti-horário via multiplicador) — conic-gradient
  // sempre desenha em sentido horário a partir de `from`; para anti-horário, inverte o sinal
  // do ângulo de progresso, mantendo o ponto de início fixo.
  const anguloFinal = Number(direcao) * grausPreenchidos;

  return `conic-gradient(from ${anguloBase}deg, ${config.cor} 0deg ${anguloFinal}deg, transparent ${anguloFinal}deg 360deg)`;
}
