import { describe, expect, it, vi } from "vitest";

import {
  registrarEventoAgendaAlpha,
  serializarEventoAgendaAlpha,
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
});
