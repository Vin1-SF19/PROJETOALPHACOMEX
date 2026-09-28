import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pipeline: vi.fn(), cards: vi.fn(), noloss: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmPipeline: { findUnique: mocks.pipeline }, bpmCard: { findMany: mocks.cards },
} }));
vi.mock("@/lib/bpm/noloss-leads", () => ({ buscarNolossLeadsPendentes: mocks.noloss }));

import { cardApareceNoQuadro, contarCardsVisiveisNoQuadro, etapasComSaidaDoQuadro } from "@/lib/bpm/cards-no-quadro";

const etapas = [
  { id: "novo", nome: "Novo lead", ehFinal: false, visibilidades: [], automacoes: [] },
  { id: "fechado", nome: "Fechado", ehFinal: true, visibilidades: [], automacoes: [
    { versoes: [{ grafoJson: JSON.stringify({ nos: [{ acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE" }] }) }] },
  ] },
  { id: "lost", nome: "Lost", ehFinal: true, visibilidades: [], automacoes: [] },
];

describe("seleção de cards reais do Kanban", () => {
  const saidas = etapasComSaidaDoQuadro(etapas);
  it("mostra ativos, mesmo em etapa final", () => {
    expect(cardApareceNoQuadro({ status: "ATIVO", etapaId: "novo", vinculosOrigem: [] }, etapas, saidas)).toBe(true);
  });
  it("oculta arquivados e outros estados", () => {
    for (const status of ["ARQUIVADO", "CANCELADO"]) {
      expect(cardApareceNoQuadro({ status, etapaId: "novo", vinculosOrigem: [] }, etapas, saidas)).toBe(false);
    }
  });
  it("mantém concluído final exibido pelo vínculo ou pela saída configurada", () => {
    expect(cardApareceNoQuadro({ status: "CONCLUIDO", etapaId: "fechado", vinculosOrigem: [] }, etapas, saidas)).toBe(true);
    expect(cardApareceNoQuadro({ status: "CONCLUIDO", etapaId: "lost", vinculosOrigem: [{}] }, etapas, saidas)).toBe(true);
  });
  it("oculta concluído sem vínculo/saída e concluído fora de etapa final", () => {
    expect(cardApareceNoQuadro({ status: "CONCLUIDO", etapaId: "lost", vinculosOrigem: [] }, etapas, saidas)).toBe(false);
    expect(cardApareceNoQuadro({ status: "CONCLUIDO", etapaId: "novo", vinculosOrigem: [{}] }, etapas, saidas)).toBe(false);
  });
});

describe("contagem do quadro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pipeline.mockResolvedValue({ nome: "Revisão de Radar", etapas: [
      { ...etapas[0], nome: "Novos leads" }, etapas[1], etapas[2],
    ] });
    mocks.noloss.mockResolvedValue([]);
  });
  it("exclui o arquivado do caso 4 no banco e 3 no quadro", async () => {
    mocks.cards.mockResolvedValue([
      ...Array.from({ length: 3 }, () => ({ status: "ATIVO", etapaId: "novo", vinculosOrigem: [] })),
      { status: "ARQUIVADO", etapaId: "novo", vinculosOrigem: [] },
    ]);
    expect(await contarCardsVisiveisNoQuadro("radar", 10, "COMERCIAL", false)).toBe(3);
    expect(mocks.cards).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      membros: { some: { userId: 10 } },
      OR: [{ status: "ATIVO" }, { status: "CONCLUIDO", etapa: { ehFinal: true } }],
    }) }));
  });
  it("inclui concluído final elegível e leads virtuais, sem contar arquivado", async () => {
    mocks.cards.mockResolvedValue([
      { status: "ATIVO", etapaId: "novo", vinculosOrigem: [] },
      { status: "CONCLUIDO", etapaId: "fechado", vinculosOrigem: [] },
      { status: "CONCLUIDO", etapaId: "lost", vinculosOrigem: [] },
    ]);
    mocks.noloss.mockResolvedValue([{ id: "n1" }, { id: "n2" }]);
    expect(await contarCardsVisiveisNoQuadro("radar", 10, "ADMIN", true)).toBe(4);
  });
  it("não conta NoLoss quando a etapa de novos leads está oculta para o perfil", async () => {
    mocks.pipeline.mockResolvedValue({ nome: "Revisão de Radar", etapas: [
      { ...etapas[0], nome: "Novos leads", visibilidades: [{ perfil: "COMERCIAL", podeVer: false, podeAgir: false }] },
      etapas[1],
    ] });
    mocks.cards.mockResolvedValue([]);
    expect(await contarCardsVisiveisNoQuadro("radar", 10, "COMERCIAL", false)).toBe(0);
    expect(mocks.noloss).not.toHaveBeenCalled();
  });
});
