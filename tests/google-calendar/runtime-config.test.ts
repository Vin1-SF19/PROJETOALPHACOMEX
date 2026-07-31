import { describe, expect, it } from "vitest";

import {
  AgendaAlphaConfigError,
  exigirAgendaAlphaRuntimeConfig,
  lerAgendaAlphaRuntimeConfig,
} from "@/lib/google-calendar/runtime-config";

describe("Agenda Alpha runtime config", () => {
  it("mantém todas as flags desligadas por padrão", () => {
    expect(lerAgendaAlphaRuntimeConfig({})).toMatchObject({
      distributedLockEnabled: false,
      queueEnabled: false,
      pushEnabled: false,
      webhookBaseUrl: null,
      valid: true,
    });
  });

  it("falha fechada quando fila ou push não possuem dependências", () => {
    const config = lerAgendaAlphaRuntimeConfig({
      AGENDA_ALPHA_QUEUE_ENABLED: "true",
      AGENDA_ALPHA_PUSH_ENABLED: "true",
      AGENDA_ALPHA_WEBHOOK_BASE_URL: "http://localhost:3000",
    });

    expect(config.valid).toBe(false);
    expect(config.distributedLockEnabled).toBe(false);
    expect(() =>
      exigirAgendaAlphaRuntimeConfig({
        AGENDA_ALPHA_QUEUE_ENABLED: "true",
      }),
    ).toThrow(AgendaAlphaConfigError);
  });

  it("aceita somente a matriz completa com HTTPS público", () => {
    expect(
      lerAgendaAlphaRuntimeConfig({
        AGENDA_ALPHA_DISTRIBUTED_LOCK_ENABLED: "true",
        AGENDA_ALPHA_QUEUE_ENABLED: "true",
        AGENDA_ALPHA_PUSH_ENABLED: "true",
        AGENDA_ALPHA_WEBHOOK_BASE_URL:
          "https://painel.example.com/base/?segredo=removido",
      }),
    ).toMatchObject({
      valid: true,
      webhookBaseUrl: "https://painel.example.com/base",
    });
  });
});

