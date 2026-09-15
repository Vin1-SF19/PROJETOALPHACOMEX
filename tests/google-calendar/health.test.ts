import { describe, expect, it } from "vitest";

import { calcularSaudeAgendaAlpha } from "@/lib/google-calendar/health";

const runtime = {
  distributedLockEnabled: true,
  queueEnabled: true,
  pushEnabled: true,
  webhookBaseUrl: "https://painel.example.com",
  valid: true,
  errors: [],
};
const agora = new Date("2026-09-15T12:00:00Z");

function calendario(overrides = {}) {
  return {
    visivel: true,
    syncToken: "cursor",
    ultimaSincronizacaoEm: new Date("2026-09-15T11:55:00Z"),
    eventosEmCache: 12,
    canais: [{ status: "ACTIVE", expiresAt: new Date("2026-09-16T12:00:00Z") }],
    operacoesComErro: 0,
    ...overrides,
  };
}

describe("calcularSaudeAgendaAlpha", () => {
  it("não declara sincronizado quando a conexão não possui agenda visível", () => {
    expect(calcularSaudeAgendaAlpha({ conectado: true, calendarios: [], runtime, agora }))
      .toMatchObject({ estado: "sem_agendas", calendariosVisiveis: 0 });
  });

  it("expõe primeira sincronização pendente em vez de falso positivo verde", () => {
    expect(calcularSaudeAgendaAlpha({
      conectado: true,
      calendarios: [calendario({ syncToken: null, ultimaSincronizacaoEm: null })],
      runtime,
      agora,
    })).toMatchObject({ estado: "primeira_sincronizacao", calendariosNuncaSincronizados: 1 });
  });

  it("considera saudável apenas agenda recente, com cursor e automação disponível", () => {
    expect(calcularSaudeAgendaAlpha({
      conectado: true,
      calendarios: [calendario()],
      runtime,
      agora,
    })).toMatchObject({ estado: "saudavel", eventosEmCache: 12, canaisAtivos: 1 });
  });

  it("sinaliza erro persistente de canal ou fila", () => {
    expect(calcularSaudeAgendaAlpha({
      conectado: true,
      calendarios: [calendario({ canais: [{ status: "ERROR", expiresAt: agora }] })],
      runtime,
      agora,
    })).toMatchObject({ estado: "com_erro", canaisComErro: 1 });
  });

  it("não declara automação saudável quando uma agenda não possui canal válido", () => {
    expect(calcularSaudeAgendaAlpha({
      conectado: true,
      calendarios: [calendario({ canais: [] })],
      runtime,
      agora,
    })).toMatchObject({
      estado: "desatualizada",
      calendariosSemCanalAtivo: 1,
      sincronizacaoAutomaticaDisponivel: false,
    });
  });
});
