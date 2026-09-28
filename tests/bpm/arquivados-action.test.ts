import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), modulo: vi.fn(), pipeline: vi.fn(), config: vi.fn(), card: vi.fn(),
  pipelineFind: vi.fn(), usuarioFind: vi.fn(), etapaFind: vi.fn(), cardFind: vi.fn(),
  cardCount: vi.fn(), cardList: vi.fn(), membroFind: vi.fn(), campos: vi.fn(), eventoFind: vi.fn(),
}));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmPipeline: { findMany: mocks.pipelineFind }, usuarios: { findUnique: mocks.usuarioFind },
  bpmEtapa: { findMany: mocks.etapaFind }, bpmCard: {
    count: mocks.cardCount, findMany: mocks.cardList, findUnique: mocks.cardFind,
  }, bpmCardMembro: { findUnique: mocks.membroFind },
  bpmCardHistorico: { findFirst: mocks.eventoFind },
} }));
vi.mock("@/lib/bpm/ownership", () => ({
  checarAcessoBpmPipeline: mocks.pipeline, checarAcessoConfigPipeline: mocks.config,
  exigirAcessoBpmCard: mocks.card, exigirAcessoModuloBpm: mocks.modulo,
}));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({ carregarCamposAplicaveisCardEtapa: mocks.campos }));

import { ListarCardsArquivadosBpm, ObterCardArquivadoBpm } from "@/actions/bpm/Arquivados";

describe("consulta autorizada de cards arquivados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "10" } });
    mocks.config.mockResolvedValue(false);
    mocks.usuarioFind.mockResolvedValue({ role: "COMERCIAL" });
    mocks.pipelineFind.mockResolvedValue([{ id: "permitido" }, { id: "oculto" }]);
    mocks.pipeline.mockImplementation((id: string) => Promise.resolve(id === "permitido"));
    mocks.etapaFind.mockResolvedValue([{ id: "etapa", visibilidades: [] }]);
    mocks.cardCount.mockResolvedValue(1);
    mocks.cardList.mockResolvedValue([]);
    mocks.membroFind.mockResolvedValue({ role: "RESPONSAVEL" });
    mocks.campos.mockResolvedValue([{ nome: "Radar pretendido", valor: "Ilimitado", tipo: "SELECT" }]);
    mocks.eventoFind.mockResolvedValue(null);
  });

  it("pagina apenas cards arquivados dos pipelines, etapas e membros acessíveis", async () => {
    const resultado = await ListarCardsArquivadosBpm(2);
    expect(resultado).toMatchObject({ success: true, data: { pagina: 2, total: 1 } });
    expect(mocks.cardList).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "ARQUIVADO", pipelineId: { in: ["permitido"] },
        etapaId: { in: ["etapa"] }, membros: { some: { userId: 10 } } },
      skip: 20, take: 20,
    }));
  });

  it("usa o snapshot histórico da etapa e do pipeline no detalhe", async () => {
    mocks.cardFind.mockResolvedValue({
      id: "card", status: "ARQUIVADO", pipelineId: "permitido", etapaId: "etapa",
      pipeline: { nome: "Nome atual" }, etapa: { nome: "Etapa atual" },
      anexos: [{ id: "anexo", nome: "Contrato.pdf", url: "bpm-blob:bpm/privado.pdf" }],
      historico: [{ acao: "CARD_ARQUIVADO", createdAt: new Date("2026-09-28T10:00:00Z"),
        valorAnteriorJson: JSON.stringify({ pipelineNome: "Radar anterior", etapaNome: "Reunião agendada" }) }],
    });
    mocks.eventoFind.mockResolvedValue({ createdAt: new Date("2026-09-28T10:00:00Z"),
      valorAnteriorJson: JSON.stringify({ pipelineNome: "Radar anterior", etapaNome: "Reunião agendada" }) });
    const resultado = await ObterCardArquivadoBpm("card");
    expect(resultado).toMatchObject({ success: true, data: {
      localizacao: { pipelineNome: "Radar anterior", etapaNome: "Reunião agendada" },
      campos: [{ nome: "Radar pretendido", valor: "Ilimitado" }],
      anexos: [{ id: "anexo", nome: "Contrato.pdf", url: "/api/bpm/anexos/anexo" }],
    } });
    expect(mocks.card).toHaveBeenCalledWith("card", 10, "COMERCIAL", "visualizar");
  });

  it("nega acesso por ID direto quando card está em pipeline oculto", async () => {
    mocks.cardFind.mockResolvedValue({ id: "card", status: "ARQUIVADO", pipelineId: "oculto" });
    expect(await ObterCardArquivadoBpm("card")).toMatchObject({ success: false, error: "Card não encontrado" });
    expect(mocks.campos).not.toHaveBeenCalled();
  });

  it("usa a localização preservada no card antigo sem snapshot", async () => {
    mocks.cardFind.mockResolvedValue({
      id: "card", status: "ARQUIVADO", pipelineId: "permitido", etapaId: "etapa",
      pipeline: { nome: "Revisão de Radar" }, etapa: { nome: "Reunião agendada" }, historico: [],
      anexos: [],
    });
    const resultado = await ObterCardArquivadoBpm("card");
    expect(resultado).toMatchObject({ success: true, data: {
      localizacao: { pipelineNome: "Revisão de Radar", etapaNome: "Reunião agendada" },
    } });
  });

  it("nega acesso quando a permissão de leitura do card falha", async () => {
    mocks.cardFind.mockResolvedValue({ id: "card", status: "ARQUIVADO", pipelineId: "permitido" });
    mocks.card.mockRejectedValue(new Error("Não autorizado"));
    expect(await ObterCardArquivadoBpm("card")).toMatchObject({ success: false });
    expect(mocks.campos).not.toHaveBeenCalled();
  });
});
