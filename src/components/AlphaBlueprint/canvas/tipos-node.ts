export type TipoNodeCanvas = "textoNode" | "stickyNode" | "formaNode" | "telaNode" | "linhaNode" | "imagemNode";

export type VarianteForma =
  // Formas básicas
  | "retangulo" | "circulo" | "losango" | "container" | "triangulo" | "hexagono" | "estrela"
  // Fluxograma
  | "inicioFim" | "decisao" | "entradaSaida" | "conector" | "documento" | "bancoDados" | "subprocesso"
  // Wireframe
  | "botao" | "input" | "checkbox" | "radio" | "select" | "card" | "tabela" | "navbar" | "sidebar"
  // Anotações
  | "nota" | "alerta" | "check" | "x" | "numeracao" | "tag" | "balao";

export type PlataformaTela = "desktop" | "mobile";
export type OrientacaoLinha = "horizontal" | "vertical";

export const CORES_DESTAQUE = [
  { id: "slate", rgb: "148,163,184" },
  { id: "amber", rgb: "251,191,36" },
  { id: "emerald", rgb: "52,211,153" },
  { id: "blue", rgb: "96,165,250" },
  { id: "rose", rgb: "251,113,133" },
  { id: "violet", rgb: "167,139,250" },
] as const;

export type CorDestaqueId = (typeof CORES_DESTAQUE)[number]["id"];

export function corRgbPorId(id?: string): string {
  return CORES_DESTAQUE.find((c) => c.id === id)?.rgb ?? CORES_DESTAQUE[0].rgb;
}

/** Categorias para a toolbar colapsável — mesma lógica de agrupamento do Apresentation Studio. */
export const CATEGORIAS_FORMA: { nome: string; variantes: VarianteForma[] }[] = [
  { nome: "Formas", variantes: ["retangulo", "circulo", "losango", "triangulo", "hexagono", "estrela", "container"] },
  { nome: "Fluxograma", variantes: ["inicioFim", "decisao", "entradaSaida", "conector", "documento", "bancoDados", "subprocesso"] },
  { nome: "Wireframe", variantes: ["botao", "input", "checkbox", "radio", "select", "card", "tabela", "navbar", "sidebar"] },
  { nome: "Anotações", variantes: ["nota", "alerta", "check", "x", "numeracao", "tag", "balao"] },
];

export const VARIANTE_LABEL: Record<VarianteForma, string> = {
  retangulo: "Retângulo", circulo: "Círculo", losango: "Losango", container: "Container/Frame",
  triangulo: "Triângulo", hexagono: "Hexágono", estrela: "Estrela",
  inicioFim: "Início/Fim", decisao: "Decisão", entradaSaida: "Entrada/Saída", conector: "Conector",
  documento: "Documento", bancoDados: "Banco de Dados", subprocesso: "Subprocesso",
  botao: "Botão", input: "Campo de texto", checkbox: "Checkbox", radio: "Radio", select: "Select",
  card: "Card", tabela: "Tabela", navbar: "Navbar", sidebar: "Sidebar",
  nota: "Nota", alerta: "Alerta", check: "Check", x: "Rejeitado", numeracao: "Numeração",
  tag: "Tag", balao: "Balão de comentário",
};

export type DadosTextoNode = {
  texto: string;
  tamanhoFonte?: "sm" | "md" | "lg";
  cor?: CorDestaqueId;
  [key: string]: unknown;
};

export type DadosStickyNode = {
  texto: string;
  cor?: CorDestaqueId;
  [key: string]: unknown;
};

export type DadosFormaNode = {
  label: string;
  variante: VarianteForma;
  cor?: CorDestaqueId;
  numero?: number;
  [key: string]: unknown;
};

export type DadosTelaNode = {
  nome: string;
  plataforma: PlataformaTela;
  cor?: CorDestaqueId;
  [key: string]: unknown;
};

export type DadosLinhaNode = {
  orientacao: OrientacaoLinha;
  comPonta?: boolean;
  cor?: CorDestaqueId;
  [key: string]: unknown;
};

export type DadosImagemNode = {
  url?: string;
  nomeArquivo?: string;
  legenda?: string;
  cor?: CorDestaqueId;
  [key: string]: unknown;
};

export type DadosNodeCanvas =
  | DadosTextoNode | DadosStickyNode | DadosFormaNode | DadosTelaNode | DadosLinhaNode | DadosImagemNode;
