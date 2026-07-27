import { z } from "zod";
import type { Node, Edge } from "@xyflow/react";

/**
 * Padrões de layout fixos que a IA escolhe e preenche com conteúdo textual — nunca gera
 * coordenadas x/y livres (mesmo princípio do motor de geração de slide do Apresentation
 * Studio: `templates-layout.ts`). Isso evita elementos sobrepostos, fora da viewport, ou
 * qualquer payload malformado vindo do modelo.
 */
export const TIPOS_LAYOUT = ["fluxo_linear", "grid_telas", "comparacao"] as const;
export type TipoLayout = (typeof TIPOS_LAYOUT)[number];

export const respostaLayoutSchema = z.object({
  tipo: z.enum(TIPOS_LAYOUT),
  itens: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
});

export type RespostaLayoutIA = z.infer<typeof respostaLayoutSchema>;

const ESPACAMENTO_X = 220;
const ESPACAMENTO_Y = 160;

function criarNodeTexto(id: string, texto: string, x: number, y: number): Node {
  return { id, type: "textoNode", position: { x, y }, data: { texto, tamanhoFonte: "md" } };
}

function criarNodeTela(id: string, nome: string, x: number, y: number): Node {
  return {
    id,
    type: "telaNode",
    position: { x, y },
    data: { nome, plataforma: "desktop" },
    style: { width: 200, height: 140 },
  };
}

/** Preenche o layout escolhido pela IA com os itens fornecidos, gerando nodes/edges reais. */
export function preencherLayout(resposta: RespostaLayoutIA): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  switch (resposta.tipo) {
    case "fluxo_linear": {
      resposta.itens.forEach((item, i) => {
        const id = `layout-${i}`;
        nodes.push(criarNodeTela(id, item, i * ESPACAMENTO_X, 0));
        if (i > 0) {
          edges.push({ id: `edge-${i}`, source: `layout-${i - 1}`, target: id, type: "smoothstep" });
        }
      });
      break;
    }
    case "grid_telas": {
      const colunas = Math.min(3, resposta.itens.length);
      resposta.itens.forEach((item, i) => {
        const id = `layout-${i}`;
        const col = i % colunas;
        const linha = Math.floor(i / colunas);
        nodes.push(criarNodeTela(id, item, col * ESPACAMENTO_X, linha * ESPACAMENTO_Y));
      });
      break;
    }
    case "comparacao": {
      resposta.itens.forEach((item, i) => {
        const id = `layout-${i}`;
        nodes.push(criarNodeTexto(id, item, i * ESPACAMENTO_X, 0));
      });
      break;
    }
  }

  return { nodes, edges };
}

export function descricaoTiposLayout(): string {
  return [
    "- fluxo_linear: sequência de telas/passos conectados em linha (ex: login → dashboard → cadastro)",
    "- grid_telas: várias telas/módulos organizados em grade, sem conexão sequencial obrigatória",
    "- comparacao: itens lado a lado sem conexão, para comparar opções/alternativas",
  ].join("\n");
}
