import { describe, expect, it, vi } from "vitest";

import {
  registrarEventoAgendaAlpha,
  registrarMetricaPerformanceAgendaAlpha,
  serializarEventoAgendaAlpha,
  serializarMetricaPerformanceAgendaAlpha,
} from "@/lib/google-calendar/observability";

describe("observabilidade segura da Agenda Alpha", () => {
  it("serializa somente allowlist técnica e nunca segredo, URI, payload, email ou PII", () => {
    const entrada = Object.assign(
      {
        correlationId: "019fb437-c332-7b10-a85a-edb5539f1680",
        outcome: "accepted" as const,
        googleChannelId: "channel-opaco-secreto",
        resourceState: "exists" as const,
        latencyMs: 17,
      },
      {
        channelToken: "token-ultrassecreto",
        resourceUri: "https://google.example/private/resource",
        email: "pessoa@alpha.com",
        payload: '{"summary":"Consulta médica"}',
        nome: "Maria da Silva",
        cpf: "123.456.789-00",
      },
    );

    const serializado = serializarEventoAgendaAlpha(entrada);
    const objeto = JSON.parse(serializado) as Record<string, unknown>;

    expect(objeto).toMatchObject({
      scope: "agenda-alpha",
      event: "webhook",
      metric: "agenda_alpha_webhook_total",
      value: 1,
      outcome: "accepted",
      resourceState: "exists",
      latencyMs: 17,
    });
    expect(objeto.channelRef).toMatch(/^[a-f0-9]{12}$/);
    for (const proibido of [
      "channel-opaco-secreto",
      "token-ultrassecreto",
      "google.example",
      "pessoa@alpha.com",
      "Consulta médica",
      "Maria da Silva",
      "123.456.789-00",
    ]) {
      expect(serializado).not.toContain(proibido);
    }
  });

  it("registra uma linha JSON por incremento de contador", () => {
    const escrever = vi.fn();
    registrarEventoAgendaAlpha(
      {
        correlationId: "019fb437-c332-7b10-a85a-edb5539f1680",
        outcome: "rejected",
        reason: "AUTH_FAILED",
        googleChannelId: "channel-1",
        latencyMs: 2,
      },
      escrever,
    );

    expect(escrever).toHaveBeenCalledTimes(1);
    expect(JSON.parse(escrever.mock.calls[0]?.[0] ?? "{}")).toMatchObject({
      metric: "agenda_alpha_webhook_total",
      value: 1,
      outcome: "rejected",
      reason: "AUTH_FAILED",
    });
  });

  it("serializa métricas de performance sem conteúdo da agenda e limita valores", () => {
    const entrada = Object.assign(
      {
        correlationId: "019fb437-c332-7b10-a85a-edb5539f1680",
        operation: "snapshot_intervalo" as const,
        outcome: "success" as const,
        latencyMs: 999_999,
        itemCount: 999_999,
      },
      {
        titulo: "Consulta médica",
        email: "pessoa@alpha.com",
        googleEventId: "evento-secreto",
      },
    );

    const serializado = serializarMetricaPerformanceAgendaAlpha(entrada);
    expect(JSON.parse(serializado)).toMatchObject({
      scope: "agenda-alpha",
      event: "performance",
      metric: "agenda_alpha_operation_duration_ms",
      operation: "snapshot_intervalo",
      outcome: "success",
      latencyMs: 600_000,
      itemCount: 100_000,
    });
    expect(serializado).not.toContain("Consulta médica");
    expect(serializado).not.toContain("pessoa@alpha.com");
    expect(serializado).not.toContain("evento-secreto");
  });

  it("registra uma linha JSON por operação de performance", () => {
    const escrever = vi.fn();
    registrarMetricaPerformanceAgendaAlpha(
      {
        correlationId: "019fb437-c332-7b10-a85a-edb5539f1680",
        operation: "criar_evento",
        outcome: "error",
        latencyMs: -5,
      },
      escrever,
    );

    expect(escrever).toHaveBeenCalledTimes(1);
    expect(JSON.parse(escrever.mock.calls[0]?.[0] ?? "{}")).toMatchObject({
      operation: "criar_evento",
      outcome: "error",
      latencyMs: 0,
    });
  });
});
