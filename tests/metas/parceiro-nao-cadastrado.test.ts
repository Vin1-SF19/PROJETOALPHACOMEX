import { describe, expect, it } from "vitest";
import {
  parseParceiroNaoCadastrado,
  serializarParceiroNaoCadastrado,
} from "@/lib/comercial/parceiro-nao-cadastrado";

describe("parceiro não cadastrado", () => {
  it("serializa e recupera os três campos com acentos", () => {
    const serializado = serializarParceiroNaoCadastrado({
      nome: "João da Indicação",
      empresa: "Comércio Ação Ltda.",
      telefone: "(47) 99999-0000",
    });

    expect(parseParceiroNaoCadastrado(serializado)).toEqual({
      nome: "João da Indicação",
      empresa: "Comércio Ação Ltda.",
      telefone: "(47) 99999-0000",
    });
  });

  it("remove campos opcionais vazios", () => {
    const serializado = serializarParceiroNaoCadastrado({
      nome: "  Maria Parceira  ",
      empresa: "   ",
      telefone: "",
    });

    expect(parseParceiroNaoCadastrado(serializado)).toEqual({ nome: "Maria Parceira" });
  });

  it("rejeita nome ausente", () => {
    expect(() => serializarParceiroNaoCadastrado({ nome: "" })).toThrow();
  });

  it("não interpreta texto livre legado de canalOutro", () => {
    expect(parseParceiroNaoCadastrado("Feira de negócios local")).toBeNull();
  });

  it("rejeita JSON de outro tipo, outra versão ou com campos extras", () => {
    expect(parseParceiroNaoCadastrado(JSON.stringify({ tipo: "OUTRO", versao: 1, nome: "João" }))).toBeNull();
    expect(parseParceiroNaoCadastrado(JSON.stringify({ tipo: "PARCEIRO_NAO_CADASTRADO", versao: 2, nome: "João" }))).toBeNull();
    expect(parseParceiroNaoCadastrado(JSON.stringify({ tipo: "PARCEIRO_NAO_CADASTRADO", versao: 1, nome: "João", admin: true }))).toBeNull();
  });

  it("rejeita payload excessivamente grande antes do parse", () => {
    expect(parseParceiroNaoCadastrado("x".repeat(1_001))).toBeNull();
  });
});
