import { describe, expect, it } from "vitest";
import {
  chaveOpcaoCampo,
  erroValorCampo,
  fonteCampoPermitida,
  mapeamentoCriariaCiclo,
  normalizarValorCampo,
  resolverMapeamentosCampo,
} from "@/lib/bpm/campos-configuraveis";

describe("gestão configurável de campos", () => {
  it("usa allowlist fechada para fontes canônicas", () => {
    expect(fonteCampoPermitida("CLIENTE", "cnpj")).toBe(true);
    expect(fonteCampoPermitida("CLIENTE", "senhaHash")).toBe(false);
    expect(fonteCampoPermitida("TabelaInjetada", "id")).toBe(false);
  });

  it("normaliza CNPJ, número e multiseleção", () => {
    expect(normalizarValorCampo("cnpj", "12.345.678/0001-90")).toBe("12345678000190");
    expect(normalizarValorCampo("moeda", "10,50")).toBe("10.50");
    expect(normalizarValorCampo("multiselecao", '["a", "a", "b"]')).toBe('["a","b"]');
  });

  it("valida formatos e opções no servidor", () => {
    expect(erroValorCampo("email", "invalido")).toBe("E-mail inválido");
    expect(erroValorCampo("percentual", "101")).toContain("entre 0 e 100");
    expect(erroValorCampo("selecao", "x", ["a", "b"])).toBe("Opção inválida");
  });

  it("gera chave estável legível para opções", () => {
    expect(chaveOpcaoCampo("  Opção Ágil  ")).toBe("opcao-agil");
  });

  it("bloqueia ciclos dirigidos", () => {
    const existentes = [
      { campoOrigemId: "a", campoDestinoId: "b", modo: "COPIAR" as const, ativo: true },
      { campoOrigemId: "b", campoDestinoId: "c", modo: "SINCRONIZAR" as const, ativo: true },
    ];
    expect(mapeamentoCriariaCiclo(existentes, { campoOrigemId: "c", campoDestinoId: "a", modo: "REFERENCIAR", ativo: true })).toBe(true);
    expect(mapeamentoCriariaCiclo(existentes, { campoOrigemId: "a", campoDestinoId: "c", modo: "COPIAR", ativo: true })).toBe(false);
  });

  it("distingue snapshot, sincronização e referência", () => {
    const resultado = resolverMapeamentosCampo({
      valores: { origem: "novo", copiaCheia: "mantido" },
      valoresCanonicos: { global: "canônico" },
      mapeamentos: [
        { campoOrigemId: "origem", campoDestinoId: "copia", modo: "COPIAR", ativo: true },
        { campoOrigemId: "origem", campoDestinoId: "copiaCheia", modo: "COPIAR", ativo: true },
        { campoOrigemId: "origem", campoDestinoId: "sync", modo: "SINCRONIZAR", ativo: true },
        { campoOrigemId: "global", campoDestinoId: "ref", modo: "REFERENCIAR", ativo: true },
      ],
    });
    expect(resultado.snapshots).toEqual({ copia: "novo" });
    expect(resultado.efetivos.copiaCheia).toBe("mantido");
    expect(resultado.efetivos.sync).toBe("novo");
    expect(resultado.efetivos.ref).toBe("canônico");
    expect([...resultado.somenteLeitura]).toEqual(expect.arrayContaining(["sync", "ref"]));
  });
});
