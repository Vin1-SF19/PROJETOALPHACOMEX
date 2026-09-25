import { describe, expect, it } from "vitest";
import { carregarContratoPadrao, qualificarContratadaContratoPadrao } from "@/lib/gerador-documentos/contrato-padrao";

describe("contratada do contrato padrão gerado pelo Financeiro", () => {
  it("substitui a qualificação antiga pela empresa cadastrada, preservando as demais cláusulas", async () => {
    const modelo = await carregarContratoPadrao();
    const original = modelo.clausulas[0].conteudo;
    const resultado = qualificarContratadaContratoPadrao(original, {
      razaoSocial: "ALPHA - COMEX, SERVICOS ADMINISTRATIVOS ESPECIALIZADOS E COWORKING LTDA",
      cnpj: "57906707000189", logradouro: "RUA SAO PAULO", numero: "73", bairro: "CORDEIROS",
      municipio: "ITAJAI", uf: "SC", cep: "88.310-190",
    });
    expect(resultado).toContain("ALPHA - COMEX, SERVICOS ADMINISTRATIVOS ESPECIALIZADOS E COWORKING LTDA");
    expect(resultado).toContain("57906707000189");
    expect(resultado).not.toContain("ALPHA COMEX BRASIL LTDA");
    expect(resultado).not.toContain("44.342.670/0001-61");
    expect(resultado).toContain("{{contratante_nome}}");
    expect(modelo.clausulas[0].conteudo).toBe(original);
  });
});
