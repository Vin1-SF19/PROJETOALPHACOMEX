import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cpfEhValido,
  ERRO_ALINHAMENTO_RESUMO_OBRIGATORIO,
  etapaEhAlinhamentoEstrategico,
  obterErroCamposAlinhamentoParaSaida,
  TEMPLATE_RESUMO_ALINHAMENTO,
} from "@/lib/bpm/alinhamento-estrategico";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";

const campos = [
  { nome: "Responsável pelo processo", valor: "Ana" },
  { nome: "CPF do responsável", valor: "52998224725" },
  { nome: "Resumo da reunião", valor: "Decisões registradas." },
];

describe("Alinhamento Estratégico agendado", () => {
  it("identifica a etapa e oferece um template de resumo utilizável", () => {
    expect(etapaEhAlinhamentoEstrategico(" alinhamento estratégico agendado ")).toBe(true);
    expect(TEMPLATE_RESUMO_ALINHAMENTO).toContain("Decisões tomadas:");
    expect(TEMPLATE_RESUMO_ALINHAMENTO).toContain("Próximos passos:");
  });

  it("bloqueia a saída sem resumo e libera somente com os três dados completos", () => {
    expect(obterErroCamposAlinhamentoParaSaida({
      etapaOrigemNome: "Alinhamento Estratégico agendado",
      campos: campos.map((campo) => campo.nome === "Resumo da reunião" ? { ...campo, valor: "" } : campo),
    })).toBe(ERRO_ALINHAMENTO_RESUMO_OBRIGATORIO);
    expect(obterErroCamposAlinhamentoParaSaida({
      etapaOrigemNome: "Alinhamento Estratégico agendado",
      campos,
    })).toBeNull();
  });

  it("valida CPF no backend e normaliza o valor armazenado", () => {
    expect(cpfEhValido("529.982.247-25")).toBe(true);
    expect(cpfEhValido("111.111.111-11")).toBe(false);
    expect(validarValoresCamposBpm(
      [{ id: "campo-cpf", nome: "CPF do responsável", tipo: "cpf", opcoesJson: null }],
      { "campo-cpf": "529.982.247-25" },
    )).toEqual({ success: true, valores: { "campo-cpf": "52998224725" } });
  });

  it("conecta alerta, template e guard transacional sem um formulário paralelo", () => {
    const painel = readFileSync(resolve("src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx"), "utf8");
    const board = readFileSync(resolve("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx"), "utf8");
    const cards = readFileSync(resolve("src/actions/bpm/Cards.ts"), "utf8");
    expect(painel).toContain("Chamada de alinhamento pendente");
    expect(painel).toContain("Usar template do resumo");
    expect(board).toContain("alertaAlinhamento");
    expect(cards).toContain("obterErroCamposAlinhamentoParaSaida");
    expect(cards).toContain("camposEtapaOrigemAtuais");
  });
});
