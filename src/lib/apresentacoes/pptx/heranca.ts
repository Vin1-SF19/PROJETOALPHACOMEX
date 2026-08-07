import { comoArray, type NoXml } from "./xml-utils";

export interface PlaceholderKey {
  type: string;
  idx?: string;
}

export interface PlaceholderChain {
  key: PlaceholderKey | null;
  slide: NoXml;
  layout: NoXml | null;
  master: NoXml | null;
}

export function lerPlaceholder(shape: NoXml | null | undefined): PlaceholderKey | null {
  const ph = shape?.["p:nvSpPr"]?.["p:nvPr"]?.["p:ph"]
    ?? shape?.["p:nvPicPr"]?.["p:nvPr"]?.["p:ph"];
  if (!ph) return null;
  return { type: String(ph["@_type"] ?? "body"), ...(ph["@_idx"] !== undefined ? { idx: String(ph["@_idx"]) } : {}) };
}

export function encontrarPlaceholder(tree: NoXml | null, key: PlaceholderKey | null): NoXml | null {
  if (!tree || !key) return null;
  const shapes = comoArray<NoXml>(tree["p:sp"]);
  let byType: NoXml | null = null;
  for (const shape of shapes) {
    const candidate = lerPlaceholder(shape);
    if (!candidate || candidate.type !== key.type) continue;
    if (!byType) byType = shape;
    if (key.idx !== undefined && candidate.idx === key.idx) return shape;
  }
  return byType;
}

export function montarCadeiaPlaceholder(slideShape: NoXml, layoutTree: NoXml | null, masterTree: NoXml | null): PlaceholderChain {
  const key = lerPlaceholder(slideShape);
  const layout = encontrarPlaceholder(layoutTree, key);
  return {
    key,
    slide: slideShape,
    layout,
    master: encontrarPlaceholder(masterTree, key) ?? (layout ? encontrarPlaceholder(masterTree, lerPlaceholder(layout)) : null),
  };
}

function valueAt(root: NoXml | null, path: string[]): NoXml | undefined {
  let current: NoXml = root;
  for (const segment of path) {
    if (current === null || current === undefined) return undefined;
    current = current[segment];
  }
  return current;
}

/** Prioridade OOXML: direto no slide -> placeholder do layout -> placeholder do master. */
export function resolverNaCadeia(chain: PlaceholderChain, path: string[]): NoXml | undefined {
  return valueAt(chain.slide, path) ?? valueAt(chain.layout, path) ?? valueAt(chain.master, path);
}

export function shapeEhPlaceholder(shape: NoXml): boolean {
  return Boolean(lerPlaceholder(shape));
}

const MASTER_EDITOR_TEXT = /click to edit master|clique para editar (o )?estilo mestre/i;

/** Textos instrucionais do editor de Master não pertencem ao slide apresentado. */
export function textoEhInstrucaoDeMaster(shape: NoXml): boolean {
  const paragraphs = comoArray<NoXml>(shape?.["p:txBody"]?.["a:p"]);
  const text = paragraphs.flatMap((p) => comoArray<NoXml>(p?.["a:r"]))
    .map((run) => String(run?.["a:t"] ?? ""))
    .join(" ")
    .trim();
  return MASTER_EDITOR_TEXT.test(text);
}

