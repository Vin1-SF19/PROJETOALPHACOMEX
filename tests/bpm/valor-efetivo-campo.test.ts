import { describe, expect, it } from "vitest";
import {
  campoBpmPossuiFonteMestre,
  resolverValorEfetivoCampoBpm,
  type DadosMestresCampoBpm,
} from "@/lib/bpm/valor-efetivo-campo";

const dadosMestres: DadosMestresCampoBpm = {
  empresa: {
    cnpj: "12345678000190",
    razaoSocial: "Alpha Comércio Exterior Ltda",
    nomeFantasia: "Alpha Comex",
  },
  contatoPrincipal: {
    nome: "Maria Silva",
    celular: "11999999999",
    email: "maria@exemplo.com",
    telefoneExtra: "1133334444",
  },
};

describe("valor efetivo de campo BPM", () => {
  it.each([
    ["CNPJ", "12345678000190"],
    ["Razão social", "Alpha Comércio Exterior Ltda"],
    ["Empresa", "Alpha Comércio Exterior Ltda"],
    ["Nome fantasia", "Alpha Comex"],
    ["Nome do responsável", "Maria Silva"],
    ["Telefone", "11999999999"],
    ["E-mail", "maria@exemplo.com"],
  ])("hidrata %s a partir da fonte mestre", (nomeCampo, esperado) => {
    expect(resolverValorEfetivoCampoBpm({
      nomeCampo,
      valorPersistido: null,
      dadosMestres,
    })).toBe(esperado);
  });

  it("preserva valor local divergente sem sobrescrever silenciosamente", () => {
    expect(resolverValorEfetivoCampoBpm({
      nomeCampo: "CNPJ",
      valorPersistido: "99999999000199",
      dadosMestres,
    })).toBe("99999999000199");
  });

  it("não escolhe contato quando a camada servidora não encontrou um responsável inequívoco", () => {
    expect(resolverValorEfetivoCampoBpm({
      nomeCampo: "Nome do responsável",
      valorPersistido: null,
      dadosMestres: { ...dadosMestres, contatoPrincipal: null },
    })).toBeNull();
  });

  it("só reconhece equivalências explícitas e não confunde outros responsáveis", () => {
    expect(campoBpmPossuiFonteMestre("Vendedor responsável")).toBe(false);
    expect(campoBpmPossuiFonteMestre("Parceiro responsável")).toBe(false);
  });
});
