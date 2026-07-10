import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

export const NOMES_TEMPLATE = [
  "titulo-subtitulo",
  "titulo-paragrafo",
  "titulo-tres-cards",
  "imagem-texto",
  "citacao",
] as const;

export type NomeTemplate = (typeof NOMES_TEMPLATE)[number];

interface TemplateDef {
  descricao: string;
  camposEsperados: string[];
  preencher: (conteudo: Record<string, string>) => ComponenteSlide[];
}

function gerarId(): string {
  return crypto.randomUUID();
}

/** Card padrão usado nas 3 colunas do template titulo-tres-cards — evita repetir a mesma estrutura 3x. */
function cardComTexto(texto: string): ComponenteSlide {
  return {
    id: gerarId(), tipo: "card", x: 0, y: 0, w: 344, h: 320, zIndex: 0, rotacao: 0, animacao: undefined,
    corFundo: "#0f172a", borderRadius: 16, padding: 24,
    filhos: [{ id: gerarId(), tipo: "texto", x: 0, y: 0, w: 296, h: 272, zIndex: 0, rotacao: 0, animacao: undefined, texto, tag: "p", alinhamento: "left", fontSize: 16 }],
  };
}

const TEMPLATES: Record<NomeTemplate, TemplateDef> = {
  "titulo-subtitulo": {
    descricao: "Título grande centralizado com subtítulo menor abaixo — bom para abertura de apresentação.",
    camposEsperados: ["TITULO", "SUBTITULO"],
    preencher: (c) => [
      { id: gerarId(), tipo: "texto", x: 120, y: 260, w: 1040, h: 100, zIndex: 0, rotacao: 0, animacao: undefined, texto: c.TITULO ?? "", tag: "h1", alinhamento: "center", fontSize: 48, fontWeight: "bold" },
      { id: gerarId(), tipo: "texto", x: 200, y: 380, w: 880, h: 60, zIndex: 1, rotacao: 0, animacao: undefined, texto: c.SUBTITULO ?? "", tag: "p", alinhamento: "center", fontSize: 22 },
    ],
  },
  "titulo-paragrafo": {
    descricao: "Título alinhado à esquerda no topo com parágrafo de corpo abaixo — bom para explicar um conceito.",
    camposEsperados: ["TITULO", "CORPO"],
    preencher: (c) => [
      { id: gerarId(), tipo: "texto", x: 100, y: 80, w: 1080, h: 70, zIndex: 0, rotacao: 0, animacao: undefined, texto: c.TITULO ?? "", tag: "h2", alinhamento: "left", fontSize: 36, fontWeight: "bold" },
      { id: gerarId(), tipo: "texto", x: 100, y: 180, w: 1080, h: 320, zIndex: 1, rotacao: 0, animacao: undefined, texto: c.CORPO ?? "", tag: "p", alinhamento: "left", fontSize: 20 },
    ],
  },
  "titulo-tres-cards": {
    descricao: "Título no topo com grid de 3 cards abaixo, cada um com um texto — bom para listar benefícios/etapas/diferenciais.",
    camposEsperados: ["TITULO", "CARD1", "CARD2", "CARD3"],
    preencher: (c) => [
      { id: gerarId(), tipo: "texto", x: 100, y: 60, w: 1080, h: 60, zIndex: 0, rotacao: 0, animacao: undefined, texto: c.TITULO ?? "", tag: "h2", alinhamento: "center", fontSize: 32, fontWeight: "bold" },
      {
        id: gerarId(), tipo: "grid", x: 100, y: 160, w: 1080, h: 320, zIndex: 1, rotacao: 0, animacao: undefined, colunas: 3, gap: 24,
        filhos: [c.CARD1 ?? "", c.CARD2 ?? "", c.CARD3 ?? ""].map(cardComTexto),
      },
    ],
  },
  "imagem-texto": {
    descricao: "Imagem ocupando a metade esquerda com texto na metade direita — bom para apresentar um produto/serviço com apoio visual.",
    camposEsperados: ["TITULO", "CORPO", "URL_IMAGEM"],
    preencher: (c) => [
      { id: gerarId(), tipo: "imagem", x: 80, y: 100, w: 500, h: 400, zIndex: 0, rotacao: 0, animacao: undefined, url: c.URL_IMAGEM ?? "", objectFit: "cover" },
      { id: gerarId(), tipo: "texto", x: 620, y: 120, w: 560, h: 70, zIndex: 1, rotacao: 0, animacao: undefined, texto: c.TITULO ?? "", tag: "h2", alinhamento: "left", fontSize: 32, fontWeight: "bold" },
      { id: gerarId(), tipo: "texto", x: 620, y: 220, w: 560, h: 260, zIndex: 2, rotacao: 0, animacao: undefined, texto: c.CORPO ?? "", tag: "p", alinhamento: "left", fontSize: 18 },
    ],
  },
  citacao: {
    descricao: "Texto grande centralizado estilo citação/destaque — bom para uma frase de impacto ou depoimento.",
    camposEsperados: ["CITACAO"],
    preencher: (c) => [
      { id: gerarId(), tipo: "texto", x: 140, y: 280, w: 1000, h: 160, zIndex: 0, rotacao: 0, animacao: undefined, texto: c.CITACAO ?? "", tag: "h2", alinhamento: "center", fontSize: 34, fontWeight: "bold" },
    ],
  },
};

export function listarTemplates(): { nome: NomeTemplate; descricao: string; camposEsperados: string[] }[] {
  return NOMES_TEMPLATE.map((nome) => ({ nome, descricao: TEMPLATES[nome].descricao, camposEsperados: TEMPLATES[nome].camposEsperados }));
}

export function preencherTemplate(nome: string, conteudo: Record<string, string>): ComponenteSlide[] | null {
  if (!NOMES_TEMPLATE.includes(nome as NomeTemplate)) return null;
  return TEMPLATES[nome as NomeTemplate].preencher(conteudo);
}

/** Campos esperados do template, ou [] se o nome não existir — usado só para observabilidade (log), nunca bloqueia a geração. */
export function camposEsperadosDoTemplate(nome: string): string[] {
  if (!NOMES_TEMPLATE.includes(nome as NomeTemplate)) return [];
  return TEMPLATES[nome as NomeTemplate].camposEsperados;
}
