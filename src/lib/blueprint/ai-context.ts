import db from "@/lib/prisma";
import { VARIANTE_LABEL, type VarianteForma } from "@/components/AlphaBlueprint/canvas/tipos-node";

const MAX_CONTENT_TEXT_CHARS = 8000;
const MAX_REQUIREMENTS = 40;
const MAX_QUESTIONS = 40;
const MAX_COMMENTS = 20;
const MAX_NODES_DESCRITOS = 80;

interface NodeCanvasBruto {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
}

interface EdgeCanvasBruto {
  source: string;
  target: string;
  label?: string;
}

function descreverNode(node: NodeCanvasBruto): string | null {
  const data = node.data ?? {};
  switch (node.type) {
    case "textoNode":
      return typeof data.texto === "string" && data.texto.trim() ? `Texto: "${data.texto.trim()}"` : null;
    case "stickyNode":
      return typeof data.texto === "string" && data.texto.trim() ? `Observação: "${data.texto.trim()}"` : null;
    case "telaNode": {
      const nome = typeof data.nome === "string" ? data.nome : "Tela";
      const plataforma = data.plataforma === "mobile" ? "mobile" : "desktop";
      return `Tela (${plataforma}): "${nome}"`;
    }
    case "linhaNode":
      return null; // conector visual puro, sem conteúdo textual relevante para a IA
    case "imagemNode": {
      const legenda = typeof data.legenda === "string" ? data.legenda.trim() : "";
      if (!data.url) return null;
      return legenda ? `Imagem: "${legenda}"` : "Imagem de referência anexada";
    }
    case "formaNode": {
      const variante = (data.variante as VarianteForma | undefined) ?? "retangulo";
      const label = typeof data.label === "string" ? data.label.trim() : "";
      const nomeVariante = VARIANTE_LABEL[variante] ?? variante;
      return label ? `${nomeVariante}: "${label}"` : nomeVariante;
    }
    default:
      return null;
  }
}

/**
 * Serializa o canvas (nodes/edges do primeiro board) em uma descrição textual legível para
 * a IA — nunca o JSON bruto de coordenadas, que não é informação útil para gerar um prompt
 * de implementação e só infla o contexto sem necessidade.
 */
export async function descreverCanvasProjeto(projectId: string): Promise<string> {
  const board = await db.blueprintBoard.findFirst({
    where: { projectId },
    select: { elementsJson: true },
    orderBy: { createdAt: "asc" },
  });
  if (!board) return "";

  let elementos: { nodes: NodeCanvasBruto[]; edges: EdgeCanvasBruto[] };
  try {
    elementos = JSON.parse(board.elementsJson);
  } catch {
    return "";
  }

  const nodes = (elementos.nodes ?? []).slice(0, MAX_NODES_DESCRITOS);
  if (nodes.length === 0) return "";

  const idParaDescricao = new Map<string, string>();
  const linhas: string[] = [];
  let indice = 1;
  for (const node of nodes) {
    const descricao = descreverNode(node);
    if (descricao) {
      idParaDescricao.set(node.id, `[${indice}] ${descricao}`);
      linhas.push(`[${indice}] ${descricao}`);
      indice++;
    }
  }

  const conexoes = (elementos.edges ?? [])
    .map((e) => {
      const origem = idParaDescricao.get(e.source);
      const destino = idParaDescricao.get(e.target);
      if (!origem || !destino) return null;
      return `${origem.split("]")[0]}] → ${destino.split("]")[0]}]${e.label ? ` (${e.label})` : ""}`;
    })
    .filter((c): c is string => !!c);

  const partes = [`## Elementos do canvas (${linhas.length})`, linhas.join("\n")];
  if (conexoes.length > 0) {
    partes.push(`## Conexões do canvas`, conexoes.join("\n"));
  }
  return partes.join("\n\n");
}

/**
 * Monta o contexto textual do projeto para a IA. Deliberadamente seletivo — nunca serializa
 * o projeto inteiro (canvas bruto, arquivos binários, board JSON) de uma vez: só os campos
 * textuais relevantes, truncados. Ver restrição do prompt original: "não enviar todo o
 * projeto à IA a cada mensagem" e "selecionar contexto relevante".
 */
export async function montarContextoProjeto(projectId: string): Promise<string> {
  const [projeto, documentos, requisitos, perguntas, comentarios] = await Promise.all([
    db.blueprintProject.findUnique({
      where: { id: projectId },
      select: {
        title: true, summary: true, problem: true, objective: true,
        status: true, priority: true, setor: true,
        requester: { select: { nome: true } },
      },
    }),
    db.blueprintDocument.findMany({
      where: { projectId },
      select: { title: true, contentText: true },
      take: 3,
    }),
    db.blueprintRequirement.findMany({
      where: { projectId },
      select: { code: true, title: true, type: true, status: true },
      take: MAX_REQUIREMENTS,
    }),
    db.blueprintQuestion.findMany({
      where: { projectId },
      select: { question: true, answer: true, status: true },
      take: MAX_QUESTIONS,
    }),
    db.blueprintComment.findMany({
      where: { projectId, resolved: false },
      select: { content: true },
      take: MAX_COMMENTS,
    }),
  ]);

  if (!projeto) return "";

  const partes: string[] = [];
  partes.push(`# Projeto: ${projeto.title}`);
  partes.push(`Status: ${projeto.status} | Prioridade: ${projeto.priority} | Setor: ${projeto.setor ?? "não definido"}`);
  if (projeto.summary) partes.push(`## Resumo\n${projeto.summary}`);
  if (projeto.problem) partes.push(`## Problema\n${projeto.problem}`);
  if (projeto.objective) partes.push(`## Objetivo\n${projeto.objective}`);

  for (const doc of documentos) {
    if (doc.contentText) {
      const texto = doc.contentText.length > MAX_CONTENT_TEXT_CHARS
        ? doc.contentText.slice(0, MAX_CONTENT_TEXT_CHARS) + "\n...[truncado]"
        : doc.contentText;
      partes.push(`## Documento: ${doc.title}\n${texto}`);
    }
  }

  if (requisitos.length > 0) {
    partes.push(`## Requisitos (${requisitos.length})\n` + requisitos.map((r) => `- [${r.code}] ${r.title} (${r.type}, ${r.status})`).join("\n"));
  }

  if (perguntas.length > 0) {
    partes.push(`## Perguntas\n` + perguntas.map((p) => `- ${p.question}${p.answer ? ` → ${p.answer}` : " (sem resposta)"}`).join("\n"));
  }

  if (comentarios.length > 0) {
    partes.push(`## Comentários não resolvidos\n` + comentarios.map((c) => `- ${c.content}`).join("\n"));
  }

  return partes.join("\n\n");
}
