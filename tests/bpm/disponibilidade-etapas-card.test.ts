import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), acesso: vi.fn(), card: vi.fn(), requisitos: vi.fn(), avaliar: vi.fn(),
}));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: { bpmCard: { findUnique: mocks.card } } }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: mocks.acesso }));
vi.mock("@/lib/bpm/transicao-command", () => ({ avaliarTransicaoBpm: mocks.avaliar }));
vi.mock("@/actions/bpm/Cards", () => ({ ObterRequisitosTransicaoBpm: mocks.requisitos }));

import { ObterDisponibilidadeEtapasCardBpm } from "@/actions/bpm/DisponibilidadeEtapasCard";

describe("disponibilidade das etapas do card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.acesso.mockResolvedValue({});
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    mocks.card.mockResolvedValue({ etapaId: "origem", etapa: { transicoesEtapaOrigem: [
      { etapaDestinoId: "permitida" }, { etapaDestinoId: "restrita" }, { etapaDestinoId: "sem-saida" },
    ] } });
    mocks.requisitos.mockResolvedValue({ success: true, data: { faltantes: [], guardas: [] } });
    mocks.avaliar.mockResolvedValue({ success: true });
  });

  it("consulta somente destinos manuais permitidos e preserva múltiplas pendências", async () => {
    mocks.requisitos.mockResolvedValue({ success: true, data: {
      faltantes: [{ nome: "Radar pretendido" }, { nome: "Vendedor responsável" }],
      guardas: ["Conclua o checklist"],
    } });
    mocks.avaliar.mockResolvedValue({ success: false, code: "REQUIREMENTS_PENDING", error: "Pendências", pendencias: ["Radar pretendido", "Regra comercial"] });
    const result = await ObterDisponibilidadeEtapasCardBpm("card", ["origem", "permitida", "sem-transicao"]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual([{ etapaId: "permitida", oculta: false, pendencias: [
      "Radar pretendido", "Vendedor responsável", "Conclua o checklist", "Regra comercial",
    ] }]);
    expect(mocks.avaliar).toHaveBeenCalledTimes(1);
    expect(mocks.avaliar.mock.calls[0][0]).toMatchObject({ cardId: "card", etapaOrigemEsperadaId: "origem", etapaDestinoId: "permitida", ator: { tipo: "MANUAL", userId: 7 } });
  });

  it("omite destino sem autorização ou saída permitida e mantém a atribuição resolvida pelo fluxo existente", async () => {
    mocks.avaliar.mockImplementation(async (input: { etapaDestinoId: string }) => input.etapaDestinoId === "restrita"
      ? { success: false, code: "UNAUTHORIZED_DESTINATION", error: "Sem acesso" }
      : input.etapaDestinoId === "sem-saida"
        ? { success: false, code: "STAGE_EXIT_BLOCKED", error: "Saída não permitida" }
        : { success: false, code: "ASSIGNMENT_REQUIRED", error: "Escolha responsável" });
    const result = await ObterDisponibilidadeEtapasCardBpm("card", ["permitida", "restrita", "sem-saida"]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual([
      { etapaId: "permitida", oculta: false, pendencias: [] },
      { etapaId: "restrita", oculta: true, pendencias: [] },
      { etapaId: "sem-saida", oculta: true, pendencias: [] },
    ]);
  });

  it("RD pode consultar destino sem aresta e distingue falta confirmável de bloqueio", async () => {
    mocks.card.mockResolvedValue({ etapaId: "origem", origemExterna: { provider: "RD_STATION_CRM_V1" },
      etapa: { transicoesEtapaOrigem: [] } });
    mocks.avaliar.mockImplementation(async (input: { etapaDestinoId: string }) => input.etapaDestinoId === "negada"
      ? { success: false, code: "TRANSITION_DISABLED", error: "Negada pelo administrador" }
      : input.etapaDestinoId === "aviso"
        ? { success: false, code: "RD_MOVE_CONFIRMATION_REQUIRED", pendencias: ["Documento X"] }
        : { success: true });
    const result = await ObterDisponibilidadeEtapasCardBpm("card", ["origem", "livre", "aviso", "negada"]);
    expect(result).toMatchObject({ success: true, data: [
      { etapaId: "livre", oculta: false, pendencias: [], podeConfirmarPendenciasRd: false },
      { etapaId: "aviso", oculta: false, pendencias: ["Documento X"], podeConfirmarPendenciasRd: true },
      { etapaId: "negada", oculta: true, pendencias: [] },
    ] });
    expect(mocks.requisitos).not.toHaveBeenCalled();
    expect(mocks.avaliar).toHaveBeenCalledTimes(3);
  });
});
