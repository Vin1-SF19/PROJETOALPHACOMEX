import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  card: vi.fn(), automacao: vi.fn(), agenda: vi.fn(), historicos: vi.fn(), acesso: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "7", role: "ADMIN" } }) }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: mocks.acesso }));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmCard: { findUnique: mocks.card }, bpmAutomacao: { findFirst: mocks.automacao },
  bpmAutomacaoAgenda: { findFirst: mocks.agenda }, bpmCardHistorico: { findMany: mocks.historicos },
} }));
vi.mock("@/lib/bpm/automacoes/agenda", () => ({ calcularProximaRecorrencia: (config: { intervaloDias: number }, referencia: Date) =>
  new Date(referencia.getTime() + config.intervaloDias * 86_400_000) }));

import { ObterProximaVerificacaoMonitoramentoBpm } from "@/actions/bpm/Monitoramento";

describe("Próxima verificação do Monitoramento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.card.mockResolvedValue({ id: "card-1", pipelineId: "pipeline-1", etapaId: "etapa-1",
      createdAt: new Date("2026-09-01T12:00:00Z"), status: "ATIVO", etapa: { nome: "Monitoramento" } });
    mocks.automacao.mockResolvedValue({ ativa: true, versoes: [{ id: "versao-1", timezone: "America/Sao_Paulo",
      gatilhoConfigJson: JSON.stringify({ escopo: "ETAPAS", recorrencia: { tipo: "INTERVALO_DIAS", intervaloDias: 10, ancora: "ENTRADA_ETAPA" } }) }] });
    mocks.agenda.mockResolvedValue(null);
    mocks.historicos.mockResolvedValue([]);
  });

  it("mostra a data efetiva da agenda central", async () => {
    mocks.agenda.mockResolvedValue({ proximaExecucaoEm: new Date("2026-09-11T12:00:00Z") });
    expect(await ObterProximaVerificacaoMonitoramentoBpm("card-1")).toEqual({
      success: true, data: { proximaVerificacaoEm: "2026-09-11T12:00:00.000Z", ativa: true },
    });
    expect(mocks.agenda).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ chaveAgendamento: `recorrencia:versao-1:card-1:${new Date("2026-09-01T12:00:00Z").getTime()}` }),
    }));
  });

  it("calcula o primeiro ciclo antes da materialização da agenda", async () => {
    expect(await ObterProximaVerificacaoMonitoramentoBpm("card-1")).toEqual({
      success: true, data: { proximaVerificacaoEm: "2026-09-11T12:00:00.000Z", ativa: true },
    });
    expect(mocks.historicos).toHaveBeenCalledOnce();
  });

  it("ignora a agenda da passagem anterior após reentrada", async () => {
    mocks.historicos.mockResolvedValue([{ createdAt: new Date("2026-09-05T12:00:00Z"), valorNovoJson: JSON.stringify({ etapaId: "etapa-1" }) }]);
    mocks.agenda.mockResolvedValue(null);
    expect(await ObterProximaVerificacaoMonitoramentoBpm("card-1")).toEqual({
      success: true, data: { proximaVerificacaoEm: "2026-09-15T12:00:00.000Z", ativa: true },
    });
    expect(mocks.agenda).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ chaveAgendamento: `recorrencia:versao-1:card-1:${new Date("2026-09-05T12:00:00Z").getTime()}` }),
    }));
  });

  it("não mostra previsão ativa quando a revisão está pausada", async () => {
    mocks.automacao.mockResolvedValue({ ativa: false, versoes: [] });
    expect(await ObterProximaVerificacaoMonitoramentoBpm("card-1")).toEqual({
      success: true, data: { proximaVerificacaoEm: null, ativa: false },
    });
    expect(mocks.agenda).not.toHaveBeenCalled();
  });
});
