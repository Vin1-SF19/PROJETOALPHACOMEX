import { beforeEach, describe, expect, it, vi } from "vitest";

// Testes de integração da Fase 4 (RM-2026-F4B6A8): ao contrário de
// fechado-actions.test.ts/lost-actions.test.ts, aqui verificarTransicaoPermitidaBpm
// NÃO é mockada — o objetivo é provar que MoverCardBpm de fato consulta
// BpmTransicaoEtapa (engine real da Fase 2) e reage corretamente, cobrindo:
// regressão de pipeline existente (fail-open), bloqueio explícito por admin,
// e liberação exclusiva para o Motor de Automações.

const authMock = vi.hoisted(() => vi.fn());
const exigirAcessoBpmCardMock = vi.hoisted(() => vi.fn());
const usuarioElegivelResponsavelBpmMock = vi.hoisted(() => vi.fn());
const carregarCamposObrigatoriosEtapaMock = vi.hoisted(() => vi.fn());
const carregarCamposAplicaveisEtapaMock = vi.hoisted(() => vi.fn());
const carregarCamposAplicaveisCardEtapaMock = vi.hoisted(() => vi.fn());
const notificarPipelineBpmMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  bpmPipeline: { findUnique: vi.fn() },
  bpmEtapa: { findUnique: vi.fn(), findMany: vi.fn() },
  bpmCard: { findUnique: vi.fn(), updateMany: vi.fn() },
  bpmCardChecklist: { findMany: vi.fn() },
  bpmChecklistTemplate: { findMany: vi.fn() },
  bpmEtapaTransicaoPermitida: { findMany: vi.fn() },
  bpmTransicaoEtapa: { findUnique: vi.fn() },
  bpmCardCampoValor: { upsert: vi.fn() },
  bpmCardHistorico: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/realtime-server", () => ({
  notificarPipelineBpm: notificarPipelineBpmMock,
}));
vi.mock("@/lib/bpm/automacoes", () => ({
  executarAutomacaoFechamentoComercial: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: exigirAcessoBpmCardMock,
  exigirAcessoBpmPipeline: vi.fn().mockResolvedValue(undefined),
  exigirAcessoModuloBpm: vi.fn(),
  isAdminRole: vi.fn().mockReturnValue(false),
  usuarioElegivelResponsavelBpm: usuarioElegivelResponsavelBpmMock,
}));
vi.mock("@/lib/bpm/requisitos-etapa-server", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/bpm/requisitos-etapa-server")>();
  return {
    ...real,
    carregarCamposObrigatoriosEtapa: carregarCamposObrigatoriosEtapaMock,
    carregarCamposAplicaveisEtapa: carregarCamposAplicaveisEtapaMock,
    carregarCamposAplicaveisCardEtapa: carregarCamposAplicaveisCardEtapaMock,
    carregarSnapshotsCopiaCamposCard: vi.fn().mockResolvedValue({}),
    // verificarTransicaoPermitidaBpm NÃO é sobrescrita: usa a implementação real,
    // que consulta prismaMock.bpmTransicaoEtapa (mockado acima).
  };
});

import { MoverCardBpm } from "@/actions/bpm/Cards";
import { verificarTransicaoPermitidaBpm } from "@/lib/bpm/requisitos-etapa-server";

const PIPELINE_ID = "clw0000000000000pipe2";
const ORIGEM_ID = "clw0000000000000orig2";
const DESTINO_ID = "clw0000000000000dest2";
const CARD_ID = "clw0000000000000card2";
const UPDATED_AT = new Date("2026-09-04T12:00:00.000Z");

function instalarTransaction() {
  prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
}

function cardMovimento() {
  return {
    id: CARD_ID,
    pipelineId: PIPELINE_ID,
    etapaId: ORIGEM_ID,
    status: "ATIVO",
    statusPosFechamento: null,
    updatedAt: UPDATED_AT,
    dataReuniao: null,
    transcricaoReuniao: null,
    proximoContatoEm: null,
    servico: null,
    tipoProcesso: null,
    // nomes neutros — não devem acionar nenhum guard nativo (Boas-vindas,
    // Fechado, Lost, Financeiro, Revisão de Radar).
    etapa: { nome: "Etapa Origem" },
    pipeline: { nome: "Pipeline Genérico" },
  };
}

function etapaDestino() {
  return {
    id: DESTINO_ID,
    pipelineId: PIPELINE_ID,
    nome: "Etapa Destino",
    visibilidades: [],
  };
}

describe("Kanban — movimentação real respeita BpmTransicaoEtapa (Fase 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    exigirAcessoBpmCardMock.mockResolvedValue({ autorizado: true, perfilGlobal: "COMERCIAL" });
    usuarioElegivelResponsavelBpmMock.mockResolvedValue(true);
    carregarCamposObrigatoriosEtapaMock.mockResolvedValue([]);
    carregarCamposAplicaveisEtapaMock.mockResolvedValue([]);
    carregarCamposAplicaveisCardEtapaMock.mockResolvedValue([]);
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardMovimento());
    prismaMock.bpmEtapa.findUnique.mockResolvedValue(etapaDestino());
    prismaMock.bpmEtapaTransicaoPermitida.findMany.mockResolvedValue([]);
    prismaMock.bpmCardChecklist.findMany.mockResolvedValue([]);
    prismaMock.bpmChecklistTemplate.findMany.mockResolvedValue([]);
    prismaMock.bpmCard.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.bpmCardHistorico.create.mockResolvedValue({});
    notificarPipelineBpmMock.mockResolvedValue(undefined);
    instalarTransaction();
  });

  it("mantém o comportamento de pipelines existentes quando não há regra cadastrada (fail-open)", async () => {
    prismaMock.bpmTransicaoEtapa.findUnique.mockResolvedValue(null);

    const resultado = await MoverCardBpm({ cardId: CARD_ID, etapaDestinoId: DESTINO_ID });

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.bpmCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ etapaId: DESTINO_ID }) }),
    );
    expect(prismaMock.bpmCardHistorico.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ acao: "CARD_MOVIDO" }) }),
    );
  });

  it("bloqueia movimentação manual quando um admin desativou a transição, com mensagem clara", async () => {
    prismaMock.bpmTransicaoEtapa.findUnique.mockResolvedValue({
      permitida: false,
      origem: "AMBOS",
    });

    const resultado = await MoverCardBpm({ cardId: CARD_ID, etapaDestinoId: DESTINO_ID });

    expect(resultado).toEqual({
      success: false,
      error: "Esta transição foi desativada pelo administrador.",
    });
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarPipelineBpmMock).not.toHaveBeenCalled();
  });

  it("bloqueia movimentação manual quando a transição é 'apenas automação', com mensagem clara", async () => {
    prismaMock.bpmTransicaoEtapa.findUnique.mockResolvedValue({
      permitida: true,
      origem: "AUTOMACAO",
    });

    const resultado = await MoverCardBpm({ cardId: CARD_ID, etapaDestinoId: DESTINO_ID });

    expect(resultado).toEqual({
      success: false,
      error: "Esta transição só é permitida pelo Motor de Automações.",
    });
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
  });

  it("Motor de Automações executa com sucesso uma transição 'apenas automação' mesmo bloqueada para o usuário manual", async () => {
    prismaMock.bpmTransicaoEtapa.findUnique.mockResolvedValue({
      permitida: true,
      origem: "AUTOMACAO",
    });

    const viaManual = await verificarTransicaoPermitidaBpm(ORIGEM_ID, DESTINO_ID, "MANUAL");
    const viaAutomacao = await verificarTransicaoPermitidaBpm(ORIGEM_ID, DESTINO_ID, "AUTOMACAO");

    expect(viaManual.permitida).toBe(false);
    expect(viaAutomacao).toEqual({ permitida: true });
  });

  it("preserva histórico ao mover em transição hoje válida (regressão de pipeline existente)", async () => {
    prismaMock.bpmTransicaoEtapa.findUnique.mockResolvedValue({
      permitida: true,
      origem: "AMBOS",
    });

    await MoverCardBpm({ cardId: CARD_ID, etapaDestinoId: DESTINO_ID });

    expect(prismaMock.bpmCardHistorico.create).toHaveBeenCalledTimes(1);
    expect(notificarPipelineBpmMock).toHaveBeenCalled();
  });

  it("bloqueia o avanço quando o checklist real tem item obrigatório pendente", async () => {
    prismaMock.bpmTransicaoEtapa.findUnique.mockResolvedValue(null);
    prismaMock.bpmCardChecklist.findMany.mockResolvedValue([{
      id: "checklist-1",
      templateId: "template-1",
      templateNome: "Documentação",
      itens: [{ id: "item-1", nome: "Anexar contrato", status: "PENDENTE", obrigatorio: true }],
    }]);

    const resultado = await MoverCardBpm({ cardId: CARD_ID, etapaDestinoId: DESTINO_ID });

    expect(resultado).toMatchObject({ success: false });
    expect(resultado.error).toContain("item obrigatório pendente");
    expect(resultado.error).toContain("Anexar contrato");
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
  });

  it("libera o mesmo avanço depois que o item obrigatório é concluído", async () => {
    prismaMock.bpmTransicaoEtapa.findUnique.mockResolvedValue(null);
    prismaMock.bpmCardChecklist.findMany.mockResolvedValue([{
      id: "checklist-1",
      templateId: "template-1",
      templateNome: "Documentação",
      itens: [{ id: "item-1", nome: "Anexar contrato", status: "CONCLUIDO", obrigatorio: true }],
    }]);

    const resultado = await MoverCardBpm({ cardId: CARD_ID, etapaDestinoId: DESTINO_ID });

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.bpmCard.updateMany).toHaveBeenCalled();
  });
});
