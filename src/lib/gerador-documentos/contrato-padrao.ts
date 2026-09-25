import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { extrairEstiloDocxPdf } from "./docx-style";
import type { VariavelTemplate } from "./schemas";
/** Registro existente que mantém a FK dos documentos; o conteúdo vem sempre do DOCX versionado. */
export { CONTRATO_PADRAO_ID } from "./contrato-padrao-id";
export const CONTRATO_PADRAO_NOME = "CONTRATO DE PRESTAÇÃO DE SERVIÇOS";
const CAMINHO_DOCX = path.join(process.cwd(), "docs", `${CONTRATO_PADRAO_NOME}.docx`);

export const VARIAVEIS_CONTRATO_PADRAO: VariavelTemplate[] = [
  { nome: "contratante_nome", label: "Nome do contratante", tipo: "texto", obrigatorio: true, placeholder: "" },
  { nome: "contratante_cnpj", label: "CNPJ do contratante", tipo: "texto", obrigatorio: true, placeholder: "" },
  { nome: "contratante_endereco", label: "Endereço completo do contratante", tipo: "texto", obrigatorio: true, placeholder: "" },
  { nome: "contratante_email", label: "E-mail do contratante", tipo: "texto", obrigatorio: true, placeholder: "" },
  { nome: "valor_total", label: "Valor total (R$)", tipo: "moeda", obrigatorio: true, placeholder: "" },
  { nome: "valor_total_extenso", label: "Valor total por extenso", tipo: "texto", obrigatorio: true, placeholder: "" },
  { nome: "valor_inicial", label: "Valor inicial (R$)", tipo: "moeda", obrigatorio: true, placeholder: "" },
  { nome: "valor_inicial_extenso", label: "Valor inicial por extenso", tipo: "texto", obrigatorio: true, placeholder: "" },
  { nome: "valor_final", label: "Valor final (R$)", tipo: "moeda", obrigatorio: true, placeholder: "" },
  { nome: "valor_final_extenso", label: "Valor final por extenso", tipo: "texto", obrigatorio: true, placeholder: "" },
  { nome: "desconto_valor", label: "Desconto (valor em R$)", tipo: "texto", obrigatorio: false, placeholder: "" },
  { nome: "desconto_extenso", label: "Desconto por extenso", tipo: "texto", obrigatorio: false, placeholder: "" },
  { nome: "data_assinatura", label: "Data de assinatura", tipo: "data", obrigatorio: true, placeholder: "" },
];

export const VALORES_INICIAIS_CONTRATO_PADRAO: Record<string, string> = {
  valor_total: "15000",
  valor_total_extenso: "quinze mil reais",
  valor_inicial: "7500",
  valor_inicial_extenso: "sete mil e quinhentos reais",
  valor_final: "7500",
  valor_final_extenso: "sete mil e quinhentos reais",
  desconto_valor: "_______",
  desconto_extenso: "________",
};

type NoXml = Record<string, unknown>;

function textoDoParagrafo(nos: NoXml[]): string {
  let texto = "";
  for (const no of nos) {
    if ("w:tab" in no) texto += "    ";
    if (Array.isArray(no["w:t"])) {
      texto += (no["w:t"] as NoXml[]).map((parte) => String(parte["#text"] ?? "")).join("");
    }
    for (const [chave, filhos] of Object.entries(no)) {
      if (chave !== "w:t" && Array.isArray(filhos)) texto += textoDoParagrafo(filhos as NoXml[]);
    }
  }
  return texto;
}

function extrairParagrafos(xml: string): string[] {
  const arvore = new XMLParser({ preserveOrder: true, ignoreAttributes: false, trimValues: false, parseTagValue: false }).parse(xml) as NoXml[];
  const paragrafos: string[] = [];
  function percorrer(nos: NoXml[]) {
    for (const no of nos) {
      for (const [chave, filhos] of Object.entries(no)) {
        if (!Array.isArray(filhos)) continue;
        if (chave === "w:p") {
          const texto = textoDoParagrafo(filhos as NoXml[]).trim();
          if (texto) paragrafos.push(texto);
        } else percorrer(filhos as NoXml[]);
      }
    }
  }
  percorrer(arvore);
  return paragrafos;
}

function substituirCampo(texto: string, original: string, variavel: string): string {
  if (!texto.includes(original)) throw new Error(`Campo ${variavel} não encontrado no contrato padrão`);
  return texto.replace(original, `{{${variavel}}}`);
}

function aplicarCampos(paragrafos: string[]): string[] {
  const copia = [...paragrafos];
  const indiceContratante = copia.findIndex((p) => p.startsWith("NOME DA EMPRESA,"));
  if (indiceContratante < 0) throw new Error("Qualificação do contratante ausente no contrato padrão");
  let contratante = copia[indiceContratante];
  contratante = substituirCampo(contratante, "NOME DA EMPRESA", "contratante_nome");
  contratante = substituirCampo(contratante, "00.000.000/0000-00", "contratante_cnpj");
  contratante = substituirCampo(contratante, "ENDEREÇO, nº 0000, bairro XXXXX, município de CIDADE, estado de ESTADO", "contratante_endereco");
  contratante = substituirCampo(contratante, "email@mail.com", "contratante_email");
  copia[indiceContratante] = contratante;

  const substituirNoDocumento = (original: string, variavel: string) => {
    const indice = copia.findIndex((p) => p.includes(original));
    if (indice < 0) throw new Error(`Campo ${variavel} não encontrado no contrato padrão`);
    copia[indice] = substituirCampo(copia[indice], original, variavel);
  };
  substituirNoDocumento("R$ 15.000,00 (quinze mil reais)", "valor_total");
  substituirNoDocumento("R$ 7.500,00 (sete mil e quinhentos reais)", "valor_inicial");
  substituirNoDocumento("R$ 7.500,00 (sete mil e quinhentos reais)", "valor_final");
  const indiceDesconto = copia.findIndex((p) => p.includes("R$ _______ (________)"));
  if (indiceDesconto < 0) throw new Error("Campo desconto_valor não encontrado no contrato padrão");
  copia[indiceDesconto] = copia[indiceDesconto].replace("R$ _______ (________)", "R$ {{desconto_valor}} ({{desconto_extenso}})");
  const indiceData = copia.findIndex((p) => p.includes("29 de agosto de 2026"));
  if (indiceData < 0) throw new Error("Data de assinatura ausente no contrato padrão");
  copia[indiceData] = substituirCampo(copia[indiceData], "29 de agosto de 2026", "data_assinatura");

  return copia.map((p) => p
    .replace("{{valor_total}}", "{{valor_total}} ({{valor_total_extenso}})")
    .replace("{{valor_inicial}}", "{{valor_inicial}} ({{valor_inicial_extenso}})")
    .replace("{{valor_final}}", "{{valor_final}} ({{valor_final_extenso}})"));
}

export async function carregarContratoPadrao() {
  const buffer = await readFile(CAMINHO_DOCX);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("Contrato padrão sem documento principal");
  const paragrafos = aplicarCampos(extrairParagrafos(xml));
  if (paragrafos[0] !== CONTRATO_PADRAO_NOME) throw new Error("Título inesperado no contrato padrão");

  const clausulas: Array<{ ordem: number; titulo: string; conteudo: string; tipo: "TEXTO"; editavel: true }> = [];
  let titulo = "Qualificação das partes";
  let conteudo: string[] = [];
  function guardar() {
    if (conteudo.length) clausulas.push({ ordem: clausulas.length, titulo, conteudo: conteudo.join("\n\n"), tipo: "TEXTO", editavel: true });
  }
  for (const paragrafo of paragrafos.slice(1)) {
    const clausula = /^Cláusula\s+(\d+)ª:\s*(.*)$/i.exec(paragrafo);
    if (clausula) {
      guardar();
      titulo = `Cláusula ${clausula[1]}ª`;
      conteudo = clausula[2] ? [clausula[2]] : [];
    } else conteudo.push(paragrafo);
  }
  guardar();
  if (clausulas.length !== 10) throw new Error("O contrato padrão deve conter qualificação e nove cláusulas");
  return { clausulas, variaveis: VARIAVEIS_CONTRATO_PADRAO, estiloDocx: await extrairEstiloDocxPdf(buffer) };
}
