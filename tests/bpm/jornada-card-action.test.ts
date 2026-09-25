import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  acessoCard: vi.fn(),
  acessoPipeline: vi.fn(),
  vinculos: vi.fn(),
  cards: vi.fn(),
  etapas: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmCardVinculo: { findMany: mocks.vinculos },
  bpmCard: { findMany: mocks.cards },
  bpmEtapa: { findMany: mocks.etapas },
} }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: mocks.acessoCard,
  exigirAcessoBpmPipeline: mocks.acessoPipeline,
}));

import { ObterJornadaCardPipeline } from "@/actions/bpm/Jornada";

const date = (dia: number) => new Date(`2026-09-${String(dia).padStart(2, "0")}T12:00:00Z`);
const cards = [
  { id: "comercial", pipelineId: "p1", etapaId: "e1", createdAt: date(1), updatedAt: date(1), historico: [] },
  { id: "financeiro", pipelineId: "p2", etapaId: "e2", createdAt: date(2), updatedAt: date(2), historico: [] },
  { id: "operacional", pipelineId: "p3", etapaId: "e3", createdAt: date(3), updatedAt: date(3), historico: [] },
  { id: "avulso", pipelineId: "p3", etapaId: "e4", createdAt: date(4), updatedAt: date(4), historico: [] },
];
const linksBase = [
  { cardOrigemId: "comercial", cardDestinoId: "financeiro" },
  { cardOrigemId: "financeiro", cardDestinoId: "operacional" },
  { cardOrigemId: "operacional", cardDestinoId: "comercial" },
];
let links = linksBase;

describe("leitura autorizada da jornada entre pipelines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    links = linksBase;
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    mocks.acessoCard.mockResolvedValue({ perfilGlobal: "COMERCIAL" });
    mocks.acessoPipeline.mockResolvedValue({});
    mocks.vinculos.mockImplementation(({ where }: { where: { OR: Array<{ cardOrigemId?: { in: string[] }; cardDestinoId?: { in: string[] } }> } }) => {
      const origem = where.OR[0].cardOrigemId?.in ?? [];
      const destino = where.OR[1].cardDestinoId?.in ?? [];
      return links.filter((link) => origem.includes(link.cardOrigemId) || destino.includes(link.cardDestinoId));
    });
    mocks.cards.mockImplementation(({ where }: { where: { id: { in: string[] }; pipelineId: string } }) =>
      cards.filter((card) => where.id.in.includes(card.id) && card.pipelineId === where.pipelineId));
    mocks.etapas.mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({ id, nome: id.toUpperCase(), visibilidades: [] })));
  });

  it("atravessa três pipelines e ignora outro card da mesma empresa", async () => {
    const resultado = await ObterJornadaCardPipeline("comercial", "p3");
    expect(resultado).toMatchObject({ success: true, data: [{ cardId: "operacional", etapaId: "e3" }] });
    expect(resultado.data).toHaveLength(1);
    expect(mocks.cards).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["comercial", "financeiro", "operacional"] }, pipelineId: "p3" } }));
  });

  it("não atravessa um card vinculado sem permissão", async () => {
    links = linksBase.slice(0, 2);
    mocks.acessoCard.mockImplementation((id: string) => id === "financeiro" ? Promise.reject(new Error("Não autorizado")) : Promise.resolve({}));
    const resultado = await ObterJornadaCardPipeline("comercial", "p3");
    expect(resultado).toMatchObject({ success: true, data: [] });
    expect(mocks.acessoCard).not.toHaveBeenCalledWith("operacional", expect.anything(), expect.anything(), expect.anything());
  });

  it("nega a consulta antes de ler vínculos quando não há acesso ao card aberto", async () => {
    mocks.acessoCard.mockRejectedValueOnce(new Error("Não autorizado"));
    const resultado = await ObterJornadaCardPipeline("comercial", "p3");
    expect(resultado).toMatchObject({ success: false, error: "Não autorizado" });
    expect(mocks.vinculos).not.toHaveBeenCalled();
  });

  it("oculta uma etapa histórica restrita ao perfil confiável do usuário", async () => {
    mocks.cards.mockResolvedValue([{ ...cards[0], etapaId: "e2", historico: [
      { id: "h1", acao: "CARD_CRIADO", createdAt: date(1), valorAnteriorJson: null, valorNovoJson: JSON.stringify({ etapaId: "e1" }) },
      { id: "h2", acao: "CARD_MOVIDO_POR_AUTOMACAO", createdAt: date(2), valorAnteriorJson: JSON.stringify({ etapaId: "e1" }), valorNovoJson: JSON.stringify({ etapaId: "e2" }) },
    ] }]);
    mocks.etapas.mockResolvedValue([
      { id: "e1", nome: "Restrita", visibilidades: [{ perfil: "FINANCEIRO", podeVer: true, podeAgir: true }] },
      { id: "e2", nome: "Visível", visibilidades: [] },
    ]);
    const resultado = await ObterJornadaCardPipeline("comercial", "p1");
    expect(resultado).toMatchObject({ success: true, data: [{ etapaId: "e2", etapaNome: "Visível" }] });
    expect(resultado.data).toHaveLength(1);
    expect(mocks.cards.mock.calls.at(-1)?.[0].select.historico.where.acao.in).toContain("CARD_MOVIDO_POR_AUTOMACAO");
    expect(resolverVisibilidadeEtapa("COMERCIAL", [{ perfil: "FINANCEIRO", podeVer: true, podeAgir: true }]).podeVer).toBe(false);
  });
});
