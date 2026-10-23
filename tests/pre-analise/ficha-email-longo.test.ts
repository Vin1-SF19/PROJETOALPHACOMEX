import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "node:path";
import { FichaAlphaPDF } from "@/components/GerarFicha";
import { fichaViabilidadeExtrasSchema } from "@/lib/bpm/ficha-viabilidade-documento";

const prefixo = "teste.instagram.fluxo.noloss.";
const dominio = "@example.com";
const email72 = prefixo + "1".repeat(72 - prefixo.length - dominio.length) + dominio;
const email254 = "w".repeat(64) + "@" + [63, 63, 61].map(tamanho => "w".repeat(tamanho)).join(".");
const email320 = "W".repeat(64) + "@" + [63, 63, 63, 63].map(tamanho => "W".repeat(tamanho)).join(".");

async function renderizar(email: string | undefined, finalidade: "padrao" | "pre-analise") {
  const buffer = await renderToBuffer(FichaAlphaPDF({
    dados: { rfb: { razaoSocial: "Empresa Sintética de Teste", cnpj: "00000000000000" }, extra: { email } },
    userLogado: "Closer QA", finalidade, logoPath: path.resolve("public/LogoTipo02.png"),
  }));
  const pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const paginas = [];
  try {
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const pagina = await pdf.getPage(n);
      const conteudo = await pagina.getTextContent();
      paginas.push({ tamanho: pagina.view, itens: conteudo.items.filter(item => "str" in item) });
    }
  } finally { await pdf.destroy(); }
  return paginas;
}

function extrairCampoEmail(paginas: Awaited<ReturnType<typeof renderizar>>) {
  let dentro = false;
  let esquerda = 0;
  const itens: Awaited<ReturnType<typeof renderizar>>[number]["itens"] = [];
  for (const pagina of paginas) {
    for (const item of pagina.itens) {
      if (item.str === "E-MAIL") { dentro = true; esquerda = item.transform[4]; continue; }
      if (dentro && item.str === "ORIGEM DO LEAD") return { esquerda, itens };
      if (dentro && item.str.trim()) itens.push(item);
    }
  }
  throw new Error("Campo de e-mail não encontrado no documento");
}

describe("E-mail completo na ficha PDF compartilhada", () => {
  it.each([
    ["curto com pontuação", "Contato+qa_01-teste@example.com"],
    ["72 caracteres", email72],
    ["254 caracteres", email254],
    ["320 caracteres e glifos largos", email320],
  ])("preserva todos os caracteres de %s sem sair da coluna", async (_nome, email) => {
    expect(fichaViabilidadeExtrasSchema.safeParse({ email }).success).toBe(true);
    const paginas = await renderizar(email, "pre-analise");
    const campo = extrairCampoEmail(paginas);
    expect(campo.itens.map(item => item.str).join("").replace(/\s+/g, "")).toBe(email);
    expect(campo.itens.length).toBeGreaterThan(0);
    for (const item of campo.itens) {
      expect(item.transform[4]).toBeGreaterThanOrEqual(campo.esquerda - 0.5);
      // A coluna termina na margem direita A4; nenhum glifo pode invadi-la.
      expect(item.transform[4] + item.width).toBeLessThanOrEqual(595.28 - 30 - 2);
      expect(item.height).toBeGreaterThanOrEqual(9);
    }
    for (const pagina of paginas) {
      expect(pagina.tamanho[2]).toBeCloseTo(595.28, 1);
      expect(pagina.tamanho[3]).toBeCloseTo(841.89, 1);
    }
    if (email.length <= 72) expect(paginas).toHaveLength(1);
    const texto = paginas.flatMap(pagina => pagina.itens.map(item => item.str)).join(" ");
    expect(texto.match(/A CONFIRMAR \( \)/g)).toHaveLength(2);
  });

  it("usa o mesmo campo íntegro no modelo padrão dos demais consumidores", async () => {
    const paginas = await renderizar(email72, "padrao");
    const campo = extrairCampoEmail(paginas);
    expect(campo.itens.map(item => item.str).join("").replace(/\s+/g, "")).toBe(email72);
    expect(paginas).toHaveLength(1);
    expect(paginas.flatMap(pagina => pagina.itens.map(item => item.str)).join(" ")).toContain("OBSERVAÇÕES");
  });

  it("mantém o espaço de preenchimento quando não há e-mail", async () => {
    const paginas = await renderizar(undefined, "pre-analise");
    const campo = extrairCampoEmail(paginas);
    expect(campo.itens.map(item => item.str).join("").replace(/\s+/g, "")).toBe("____________________________");
  });
});
