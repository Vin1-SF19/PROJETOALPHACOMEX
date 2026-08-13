import { describe, expect, it } from "vitest";

import {
  normalizarPermissaoBpm,
  podeAcessarPipelineBpm,
  podeSerResponsavelPipelineBpm,
  possuiPermissaoCrm,
} from "@/lib/bpm/ownership";

describe("permissão CRM normalizada", () => {
  it("aceita permissão CRM sem depender de caixa ou espaços", () => {
    expect(possuiPermissaoCrm([" Metas ", " CRM "])).toBe(true);
    expect(possuiPermissaoCrm(["crm"])).toBe(true);
  });

  it("não aceita permissões parecidas ou vazias", () => {
    expect(possuiPermissaoCrm(["crm-admin", "alpha-crm"])).toBe(false);
    expect(possuiPermissaoCrm([])).toBe(false);
  });

  it("normaliza de forma determinística", () => {
    expect(normalizarPermissaoBpm("  CrM  ")).toBe("crm");
  });

  it("nega não-admin sem permissão CRM mesmo no setor correto", () => {
    expect(podeAcessarPipelineBpm({
      role: "Comercial",
      permissoes: ["metas"],
      setoresPipeline: ["COMERCIAL"],
      ehMembroPipeline: false,
    })).toBe(false);
  });

  it("permite pipeline aberto, setor compatível ou membro, sempre com CRM", () => {
    const base = { role: "Comercial", permissoes: ["CRM"] };
    expect(podeAcessarPipelineBpm({
      ...base,
      setoresPipeline: [],
      ehMembroPipeline: false,
    })).toBe(true);
    expect(podeAcessarPipelineBpm({
      ...base,
      setoresPipeline: ["COMERCIAL"],
      ehMembroPipeline: false,
    })).toBe(true);
    expect(podeAcessarPipelineBpm({
      ...base,
      setoresPipeline: ["OPERACIONAL"],
      ehMembroPipeline: true,
    })).toBe(true);
  });

  it("nega pipeline de outro setor sem membresia", () => {
    expect(podeAcessarPipelineBpm({
      role: "Comercial",
      permissoes: ["crm"],
      setoresPipeline: ["Operacional"],
      ehMembroPipeline: false,
    })).toBe(false);
  });

  it("mantém bypass administrativo", () => {
    expect(podeAcessarPipelineBpm({
      role: "TI",
      permissoes: [],
      setoresPipeline: ["Operacional"],
      ehMembroPipeline: false,
    })).toBe(true);
  });

  it("não torna membro de outro setor elegível como responsável", () => {
    expect(podeSerResponsavelPipelineBpm({
      role: "Comercial",
      permissoes: ["crm"],
      setoresPipeline: ["Operacional"],
    })).toBe(false);
  });

  it("permite responsável admin ou com CRM no setor do pipeline", () => {
    expect(podeSerResponsavelPipelineBpm({
      role: "Comercial",
      permissoes: ["CRM"],
      setoresPipeline: ["COMERCIAL"],
    })).toBe(true);
    expect(podeSerResponsavelPipelineBpm({
      role: "TI",
      permissoes: [],
      setoresPipeline: ["Operacional"],
    })).toBe(true);
  });
});
