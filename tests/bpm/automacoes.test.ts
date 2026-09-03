import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  automacaoFindMany: vi.fn(),
  execucaoFindUnique: vi.fn(),
  execucaoCreate: vi.fn(),
  cardFindMany: vi.fn(),
  historicoFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  default: {
    bpmAutomacao: { findMany: mocks.automacaoFindMany },
    bpmAutomacaoExecucao: {
      findUnique: mocks.execucaoFindUnique,
      create: mocks.execucaoCreate,
    },
    bpmCard: { findMany: mocks.cardFindMany },
    bpmCardHistorico: { findMany: mocks.historicoFindMany },
  },
}));

import {
  enfileirarAutomacoesMovimentoBpm,
  materializarAutomacoesTempoBpm,
} from "@/lib/bpm/automacoes/fila";
import { renderizarPlaceholdersAutomacaoBpm } from "@/lib/bpm/automacoes/placeholders";
import { salvarAutomacaoBpmSchema } from "@/lib/bpm/automacoes/schemas";

const PIPELINE_ID = "clw0000000000000pipeline";
const ETAPA_ID = "clw000000000000000etapa";
const DESTINO_ID = "clw0000000000000destino";
const TEMPLATE_ID = "clw000000000000template";

describe("automações configuráveis do BPM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execucaoFindUnique.mockResolvedValue(null);
    mocks.execucaoCreate.mockResolvedValue({ id: "execucao-1" });
  });

  it("valida uma automação de e-mail completa", () => {
    const resultado = salvarAutomacaoBpmSchema.safeParse({
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      nome: "Boas-vindas",
      descricao: null,
      gatilhoTipo: "ENTRAR_COLUNA",
      tempoMinutos: null,
      acaoTipo: "ENVIAR_EMAIL",
      parametros: {
        para: "cliente@example.com",
        assunto: "Olá",
        corpo: "Empresa {{empresa.razaoSocial}}",
        cc: [],
      },
      ativa: true,
    });
    expect(resultado.success).toBe(true);
  });

  it("exige minutos apenas para o gatilho de permanência", () => {
    const semTempo = salvarAutomacaoBpmSchema.safeParse({
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      nome: "Contrato atrasado",
      gatilhoTipo: "TEMPO_NA_COLUNA",
      tempoMinutos: null,
      acaoTipo: "GERAR_CONTRATO",
      parametros: { templateId: TEMPLATE_ID, titulo: "Contrato", variaveis: {} },
      ativa: true,
    });
    const tempoIndevido = salvarAutomacaoBpmSchema.safeParse({
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      nome: "Ficha imediata",
      gatilhoTipo: "ENTRAR_COLUNA",
      tempoMinutos: 60,
      acaoTipo: "GERAR_FICHA",
      parametros: {},
      ativa: true,
    });
    expect(semTempo.success).toBe(false);
    expect(tempoIndevido.success).toBe(false);
  });

  it("rejeita parâmetros extras para gerar ficha", () => {
    const resultado = salvarAutomacaoBpmSchema.safeParse({
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      nome: "Gerar ficha",
      gatilhoTipo: "SAIR_COLUNA",
      tempoMinutos: null,
      acaoTipo: "GERAR_FICHA",
      parametros: { comando: "não permitido" },
      ativa: true,
    });
    expect(resultado.success).toBe(false);
  });

  it("substitui somente placeholders reconhecidos", () => {
    expect(renderizarPlaceholdersAutomacaoBpm(
      "{{empresa.razaoSocial}} / {{ card.id }} / {{nao.existe}}",
      { "empresa.razaoSocial": "Alpha", "card.id": "card-1" },
    )).toBe("Alpha / card-1 / {{nao.existe}}");
  });

  it("enfileira entrada e saída usando a identidade do mesmo movimento", async () => {
    const client = {
      bpmAutomacao: {
        findMany: vi.fn().mockResolvedValue([
          { id: "auto-sair", etapaId: ETAPA_ID, gatilhoTipo: "SAIR_COLUNA" },
          { id: "auto-entrar", etapaId: DESTINO_ID, gatilhoTipo: "ENTRAR_COLUNA" },
        ]),
      },
      bpmAutomacaoExecucao: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "execucao" }),
      },
    };
    const total = await enfileirarAutomacoesMovimentoBpm({
      cardId: "card-1",
      pipelineId: PIPELINE_ID,
      etapaOrigemId: ETAPA_ID,
      etapaDestinoId: DESTINO_ID,
      eventoId: "historico-1",
    }, client as never);
    expect(total).toBe(2);
    expect(client.bpmAutomacaoExecucao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        automacaoId: "auto-sair",
        eventoChave: "MOVIMENTO:historico-1:SAIR_COLUNA",
      }),
    });
    expect(client.bpmAutomacaoExecucao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        automacaoId: "auto-entrar",
        eventoChave: "MOVIMENTO:historico-1:ENTRAR_COLUNA",
      }),
    });
  });

  it("não duplica item já existente na fila", async () => {
    const client = {
      bpmAutomacao: {
        findMany: vi.fn().mockResolvedValue([
          { id: "auto-1", etapaId: DESTINO_ID, gatilhoTipo: "ENTRAR_COLUNA" },
        ]),
      },
      bpmAutomacaoExecucao: {
        findUnique: vi.fn().mockResolvedValue({ id: "existente" }),
        create: vi.fn(),
      },
    };
    const total = await enfileirarAutomacoesMovimentoBpm({
      cardId: "card-1",
      pipelineId: PIPELINE_ID,
      etapaOrigemId: ETAPA_ID,
      etapaDestinoId: DESTINO_ID,
      eventoId: "historico-1",
    }, client as never);
    expect(total).toBe(0);
    expect(client.bpmAutomacaoExecucao.create).not.toHaveBeenCalled();
  });

  it("materializa o gatilho temporal uma vez para o ciclo atual da coluna", async () => {
    mocks.automacaoFindMany.mockResolvedValue([{
      id: "auto-tempo",
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      tempoMinutos: 30,
    }]);
    mocks.cardFindMany.mockResolvedValue([{
      id: "card-1",
      createdAt: new Date("2026-09-02T10:00:00.000Z"),
    }]);
    mocks.historicoFindMany.mockResolvedValue([{
      id: "historico-entrada",
      cardId: "card-1",
      createdAt: new Date("2026-09-02T11:00:00.000Z"),
      valorNovoJson: JSON.stringify({ etapaId: ETAPA_ID }),
    }]);
    const resultado = await materializarAutomacoesTempoBpm(
      new Date("2026-09-02T11:30:00.000Z"),
    );
    expect(resultado).toEqual({ examinados: 1, enfileirados: 1 });
    expect(mocks.execucaoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        automacaoId: "auto-tempo",
        cardId: "card-1",
        eventoChave: `TEMPO:${ETAPA_ID}:${new Date("2026-09-02T11:00:00.000Z").getTime()}`,
        gatilhoTipo: "TEMPO_NA_COLUNA",
      }),
    });
  });

  it("não materializa antes de completar o tempo configurado", async () => {
    mocks.automacaoFindMany.mockResolvedValue([{
      id: "auto-tempo",
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      tempoMinutos: 30,
    }]);
    mocks.cardFindMany.mockResolvedValue([{
      id: "card-1",
      createdAt: new Date("2026-09-02T11:00:00.000Z"),
    }]);
    mocks.historicoFindMany.mockResolvedValue([]);
    const resultado = await materializarAutomacoesTempoBpm(
      new Date("2026-09-02T11:29:59.999Z"),
    );
    expect(resultado).toEqual({ examinados: 1, enfileirados: 0 });
    expect(mocks.execucaoCreate).not.toHaveBeenCalled();
  });
});
describe("integração da aba Automações", () => {
  it("mantém rota, menu, cron e hook de movimento ligados", async () => {
    const fs = await import("node:fs/promises");
    const [layout, cards, vercel, rota] = await Promise.all([
      fs.readFile("src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx", "utf8"),
      fs.readFile("src/actions/bpm/Cards.ts", "utf8"),
      fs.readFile("vercel.json", "utf8"),
      fs.readFile("src/app/api/bpm/jobs/automacoes/route.ts", "utf8"),
    ]);
    expect(layout).toContain("/PainelAlpha/AlphaCRM/automacoes");
    expect(cards).toContain("enfileirarAutomacoesMovimentoBpm");
    expect(vercel).toContain("/api/bpm/jobs/automacoes");
    expect(rota).toContain("autorizarCron");
    expect(rota).toContain("materializarAutomacoesTempoBpm");
    expect(rota).toContain("processarFilaAutomacoesBpm");
  });
});
