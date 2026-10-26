import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ etapas: vi.fn(), campos: vi.fn(), requisitos: vi.fn(), transicoes: vi.fn(), publicados: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmEtapa: { findMany: mocks.etapas }, bpmCampo: { findMany: mocks.campos },
  bpmRequisito: { findMany: mocks.requisitos }, bpmTransicaoEtapa: { findMany: mocks.transicoes },
} }));
vi.mock("@/lib/bpm/campos-formulario-publicado", () => ({ camposPublicadosPorEtapa: mocks.publicados }));

import { listarCamposObrigatoriosWebhook } from "@/lib/bpm/webhook-campos-server";

const config = (etapaId: string, extras = {}) => ({ etapaId, visivel: true, editavel: true, somenteLeitura: false,
  obrigatorio: false, obrigatorioSaida: false, obrigatorioEntrada: false,
  condicaoObrigatoriedadeJson: null, condicaoVisibilidadeJson: null, ...extras });
const campo = (id: string, etapaConfiguracoes: ReturnType<typeof config>[]) => ({ id, nome: id, tipo: "texto",
  editavel: true, somenteLeitura: false, opcoesJson: null, opcoes: [], etapaConfiguracoes });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.etapas.mockResolvedValue([{ id: "novo", nome: "Novo Lead" }, { id: "agendar", nome: "Agendar reunião" }, { id: "agendada", nome: "Reunião Agendada" }]);
  mocks.campos.mockResolvedValue([
    campo("saida", [config("novo", { obrigatorioSaida: true })]),
    campo("entrada", [config("agendar", { obrigatorioEntrada: true })]),
    campo("durante", [config("agendar", { obrigatorio: true })]),
    campo("condicional", [config("novo", { condicaoObrigatoriedadeJson: "{}" })]),
    campo("nao-publicado", [config("novo", { obrigatorio: true })]),
  ]);
  mocks.requisitos.mockResolvedValue([]);
  mocks.transicoes.mockResolvedValue([
    { id: "t1", etapaOrigemId: "novo", etapaDestinoId: "agendar", permitida: true, origem: "AMBOS" },
    { id: "t2", etapaOrigemId: "agendar", etapaDestinoId: "agendada", permitida: true, origem: "AUTOMACAO" },
  ]);
  mocks.publicados.mockResolvedValue(new Map([
    ["novo", new Set(["saida", "condicional"])], ["agendar", new Set(["entrada", "durante"])],
  ]));
});

describe("catálogo de campos obrigatórios dos webhooks", () => {
  it("separa saída da origem e entrada do destino e exclui campos fora do formulário", async () => {
    const [agendar, agendada] = await listarCamposObrigatoriosWebhook("radar");
    expect(agendar.campos.map((item) => item.id)).toEqual(["condicional", "entrada", "saida"]);
    expect(agendada.campos.map((item) => item.id)).toEqual(["durante"]);
    expect(agendar.campos.find((item) => item.id === "condicional")).toMatchObject({ condicional: true, editavelViaWebhook: true });
    expect(agendar.campos.find((item) => item.id === "saida")).toMatchObject({ condicional: false });
    expect(mocks.etapas).toHaveBeenCalledWith(expect.objectContaining({ where: { pipelineId: "radar", ativo: true } }));
    expect(mocks.campos.mock.calls[0][0].where).toMatchObject({ ativo: true });
  });

  it("respeita o escopo da transição dos requisitos explícitos e não lista IDs não publicados", async () => {
    mocks.requisitos.mockResolvedValue([
      { etapaId: null, transicaoId: "t1", campoId: "durante", fase: "ENTER_STAGE", condicaoJson: null, alvoTipo: "CAMPO", mensagem: "Durante obrigatório" },
      { etapaId: null, transicaoId: "t2", campoId: "entrada", fase: "ENTER_STAGE", condicaoJson: null, alvoTipo: "CAMPO", mensagem: "Outra transição" },
      { etapaId: null, transicaoId: null, campoId: "nao-publicado", fase: "ENTER_STAGE", condicaoJson: null, alvoTipo: "CAMPO", mensagem: "Oculto" },
    ]);
    const [grupo] = await listarCamposObrigatoriosWebhook("radar");
    expect(grupo.campos.map((item) => item.id)).toContain("durante");
    expect(grupo.campos.map((item) => item.id)).not.toContain("nao-publicado");
    expect(grupo.campos.filter((item) => item.id === "entrada")).toHaveLength(1);
  });

  it("informa condições de visibilidade e campos que precisam ser preenchidos no CRM", async () => {
    mocks.campos.mockResolvedValue([
      campo("saida", [config("novo", { obrigatorio: true, somenteLeitura: true, condicaoVisibilidadeJson: "{}" })]),
    ]);
    const [grupo] = await listarCamposObrigatoriosWebhook("radar");
    expect(grupo.campos[0]).toMatchObject({ id: "saida", condicional: true, editavelViaWebhook: false });
  });

  it("usa opções relacionais ativas antes das opções legadas", async () => {
    mocks.campos.mockResolvedValue([{ ...campo("saida", [config("novo", { obrigatorio: true })]),
      tipo: "selecao", opcoesJson: '["Legada"]', opcoes: [{ rotulo: "Ativa" }] }]);
    const [grupo] = await listarCamposObrigatoriosWebhook("radar");
    expect(grupo.campos[0].opcoes).toEqual(["Ativa"]);
  });

  it("sinaliza transição indisponível e inclui os demais requisitos configurados", async () => {
    mocks.transicoes.mockResolvedValue([]);
    mocks.requisitos.mockResolvedValue([{ etapaId: "novo", transicaoId: null, campoId: null, fase: "EXIT_STAGE",
      condicaoJson: "{}", alvoTipo: "CHECKLIST", mensagem: "Concluir checklist" }]);
    const [grupo] = await listarCamposObrigatoriosWebhook("radar");
    expect(grupo.aviso).toContain("não está permitida");
    expect(grupo.outrosRequisitos).toEqual(["Concluir checklist (condicional)"]);
  });
});
