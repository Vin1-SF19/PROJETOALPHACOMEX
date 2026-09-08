import type { JSONContent } from "@tiptap/react";

const PREFIXO_SCRIPT_NOTE = "SCRIPT_NOTE_V1:";
export const MAX_TEXTO_SCRIPT_ETAPA = 8_000;
export const MAX_SCRIPT_ETAPA_PERSISTIDO = 100_000;

interface ScriptNotePersistido {
  version: 1;
  content: JSONContent;
  plainText: string;
}

const TIPOS_NO_PERMITIDOS = new Set([
  "doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem",
  "taskList", "taskItem", "blockquote", "codeBlock", "horizontalRule", "hardBreak",
  "table", "tableRow", "tableCell", "tableHeader", "mention",
]);
const TIPOS_MARCA_PERMITIDOS = new Set([
  "bold", "italic", "underline", "strike", "code", "link", "textStyle", "highlight",
]);

function protocoloSeguro(valor: string): boolean {
  if (valor.startsWith("/") || valor.startsWith("#")) return true;
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(new URL(valor).protocol);
  } catch {
    return false;
  }
}

function atributosSeguros(atributos: unknown): boolean {
  if (atributos === undefined) return true;
  if (!atributos || typeof atributos !== "object" || Array.isArray(atributos)) return false;
  return Object.entries(atributos).every(([chave, valor]) => {
    if (chave.length > 50) return false;
    if ((chave === "href" || chave === "src") && typeof valor === "string") return protocoloSeguro(valor);
    if (valor === null || typeof valor === "boolean" || typeof valor === "number") return true;
    if (typeof valor === "string") return valor.length <= 2_000;
    return Array.isArray(valor) && valor.length <= 100
      && valor.every((item) => item === null || typeof item === "boolean" || typeof item === "number" || (typeof item === "string" && item.length <= 2_000));
  });
}

function conteudoTipTapSeguro(documento: JSONContent): boolean {
  let quantidadeNos = 0;
  let quantidadeTexto = 0;

  function visitar(no: JSONContent, profundidade: number): boolean {
    quantidadeNos += 1;
    if (profundidade > 30 || quantidadeNos > 2_000 || !no.type || !TIPOS_NO_PERMITIDOS.has(no.type)) return false;
    if (!atributosSeguros(no.attrs)) return false;
    if (no.type === "text") {
      if (typeof no.text !== "string") return false;
      quantidadeTexto += no.text.length;
      if (quantidadeTexto > MAX_TEXTO_SCRIPT_ETAPA) return false;
    }
    if (no.marks && (!Array.isArray(no.marks) || no.marks.length > 20 || no.marks.some((marca) => (
      !marca.type || !TIPOS_MARCA_PERMITIDOS.has(marca.type) || !atributosSeguros(marca.attrs)
    )))) return false;
    return no.content === undefined || (Array.isArray(no.content) && no.content.every((filho) => visitar(filho, profundidade + 1)));
  }

  return documento.type === "doc" && visitar(documento, 0);
}

function textoLegadoParaDocumento(texto: string): JSONContent {
  const linhas = texto.split(/\r?\n/);
  return {
    type: "doc",
    content: linhas.map((linha) => ({
      type: "paragraph",
      content: linha ? [{ type: "text", text: linha }] : undefined,
    })),
  };
}

function ehDocumentoTipTap(valor: unknown): valor is JSONContent {
  if (!valor || typeof valor !== "object") return false;
  const documento = valor as { type?: unknown; content?: unknown };
  return documento.type === "doc" && (documento.content === undefined || Array.isArray(documento.content));
}

export function serializarScriptEtapa(content: JSONContent, plainText: string): string | null {
  const textoNormalizado = plainText.trim();
  if (!textoNormalizado) return null;
  if (textoNormalizado.length > MAX_TEXTO_SCRIPT_ETAPA) {
    throw new Error(`O script deve ter no máximo ${MAX_TEXTO_SCRIPT_ETAPA} caracteres.`);
  }

  const payload: ScriptNotePersistido = { version: 1, content, plainText: textoNormalizado };
  const persistido = `${PREFIXO_SCRIPT_NOTE}${JSON.stringify(payload)}`;
  if (persistido.length > MAX_SCRIPT_ETAPA_PERSISTIDO) {
    throw new Error("O conteúdo formatado do script excede o limite permitido.");
  }
  return persistido;
}

export function desserializarScriptEtapa(script: string | null | undefined): {
  content: JSONContent;
  plainText: string;
  estruturado: boolean;
} {
  if (!script) return { content: { type: "doc", content: [] }, plainText: "", estruturado: false };
  if (!script.startsWith(PREFIXO_SCRIPT_NOTE)) {
    return { content: textoLegadoParaDocumento(script), plainText: script, estruturado: false };
  }

  try {
    const payload = JSON.parse(script.slice(PREFIXO_SCRIPT_NOTE.length)) as Partial<ScriptNotePersistido>;
    if (
      payload.version !== 1
      || !ehDocumentoTipTap(payload.content)
      || !conteudoTipTapSeguro(payload.content)
      || typeof payload.plainText !== "string"
    ) {
      throw new Error("Formato inválido");
    }
    return { content: payload.content, plainText: payload.plainText, estruturado: true };
  } catch {
    return { content: textoLegadoParaDocumento(script), plainText: script, estruturado: false };
  }
}

export function scriptEtapaPersistidoValido(script: string | null): boolean {
  if (script === null) return true;
  if (script.length > MAX_SCRIPT_ETAPA_PERSISTIDO || !script.startsWith(PREFIXO_SCRIPT_NOTE)) return false;
  const parsed = desserializarScriptEtapa(script);
  return parsed.estruturado && parsed.plainText.length <= MAX_TEXTO_SCRIPT_ETAPA;
}
