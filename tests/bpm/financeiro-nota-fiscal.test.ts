import { describe, expect, it } from "vitest";
import { pendenciasNotaFiscal, resolverCamposNotaFiscal, validarDadosNotaFiscal } from "@/lib/bpm/financeiro-nota-fiscal";

const campos = [
  { id: "nf", chave: "alpha.nf.emitida", nome: "NF emitida", tipo: "booleano" },
  { id: "data", chave: "alpha.data.de.emissao", nome: "Data de emissão", tipo: "data" },
  { id: "numero", chave: "alpha.numero.da.nf", nome: "Número da NF", tipo: "texto" },
  { id: "valor", chave: "alpha.valor.da.nf", nome: "Valor da NF", tipo: "moeda" },
  { id: "link", chave: "alpha.arquivo.link.da.nf", nome: "Arquivo/link da NF", tipo: "texto" },
].map((campo) => ({ ...campo, escopo: "CARD", ativo: true }));

describe("acompanhamento da NF após conclusão", () => {
  it("usa somente os campos existentes e falha se a configuração é ambígua", () => {
    expect(resolverCamposNotaFiscal("financeiro", campos).numero.id).toBe("numero");
    const publicados = campos.map((campo) => campo.id === "nf" ? { ...campo, tipo: "selecao" }
      : campo.id === "link" ? { ...campo, tipo: "url_ou_arquivo" } : campo);
    expect(resolverCamposNotaFiscal("financeiro", publicados).emitida.id).toBe("nf");
    expect(() => resolverCamposNotaFiscal("operacional", campos)).toThrow();
    expect(() => resolverCamposNotaFiscal("financeiro", [...campos, { ...campos[0], id: "duplicado" }])).toThrow(/ambígua/);
  });

  it("aceita link HTTPS e preserva referência de arquivo existente", () => {
    const base = { emitida: "Sim" as const, dataEmissao: "2026-09-26", numero: "NF-123", valor: "120.50", link: "https://exemplo.com/nf.pdf" };
    expect(validarDadosNotaFiscal(base)).toEqual(base);
    expect(validarDadosNotaFiscal({ ...base, link: "arquivo-cuid" }, "arquivo-cuid").link).toBe("arquivo-cuid");
  });

  it("rejeita data inexistente e link inseguro", () => {
    const base = { emitida: "Sim" as const, dataEmissao: "2026-02-30", numero: "NF-123", valor: "120.50", link: "" };
    expect(() => validarDadosNotaFiscal(base)).toThrow(/Data/);
    expect(() => validarDadosNotaFiscal({ ...base, dataEmissao: "2026-09-26", link: "javascript:alert(1)" })).toThrow(/HTTPS/);
  });

  it("exige os quatro dados apenas quando a NF é emitida e rejeita valor não positivo", () => {
    const vazia = { emitida: "Não" as const, dataEmissao: "", numero: "", valor: "", link: "" };
    expect(pendenciasNotaFiscal(vazia, false)).toEqual([]);
    expect(pendenciasNotaFiscal({ ...vazia, emitida: "Sim" }, false)).toEqual([
      "Número da NF", "Data de emissão", "Valor da NF", "Arquivo/link da NF",
    ]);
    expect(pendenciasNotaFiscal({ ...vazia, emitida: "Sim", numero: "NF-1", dataEmissao: "2026-09-29",
      valor: "0", link: "https://exemplo.com/nf" }, false)).toContain("Valor da NF");
    expect(pendenciasNotaFiscal({ ...vazia, emitida: "Sim", numero: "NF-1", dataEmissao: "2026-09-29",
      valor: "1.00", link: "arquivo-cuid" }, true)).toEqual([]);
  });
});
