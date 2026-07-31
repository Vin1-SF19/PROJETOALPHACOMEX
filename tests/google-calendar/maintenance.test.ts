import { describe, expect, it, vi } from "vitest";

import {
  executarMaintenanceAgendaAlpha,
  parseMaintenanceAgendaAlphaArgs,
} from "@/lib/google-calendar/maintenance";

const fullConfig = {
  distributedLockEnabled: true,
  queueEnabled: true,
  pushEnabled: true,
  webhookBaseUrl: "https://painel.example.com",
  valid: true,
  errors: [],
};

const plan = {
  renewCandidates: 1,
  staleCalendars: 1,
  expiredClaims: 1,
  channelsToCreate: 1,
  channelsToStop: 1,
};

describe("Agenda Alpha maintenance", () => {
  it("exige dry-run/apply para mutações e aceita create/stop", () => {
    expect(() => parseMaintenanceAgendaAlphaArgs(["renew"])).toThrow();
    expect(
      parseMaintenanceAgendaAlphaArgs([
        "create",
        "--calendar",
        "cal-1",
        "stop",
        "--channel=channel-1",
        "--dry-run",
      ]),
    ).toMatchObject({
      mode: "dry-run",
      createCalendarIds: ["cal-1"],
      stopChannelIds: ["channel-1"],
    });
  });

  it("dry-run calcula inventário sem Google ou DML", async () => {
    const mutate = vi.fn();
    const result = await executarMaintenanceAgendaAlpha(
      {
        mode: "dry-run",
        status: false,
        renewWatches: true,
        reconcileStale: true,
        recoverExpired: true,
        createCalendarIds: ["cal-1"],
        stopChannelIds: ["channel-1"],
        stopAll: false,
      },
      {
        config: {
          ...fullConfig,
          distributedLockEnabled: false,
          queueEnabled: false,
          pushEnabled: false,
          webhookBaseUrl: null,
        },
        getPlan: vi.fn().mockResolvedValue(plan),
        renewWatches: mutate,
        createChannel: mutate,
        stopChannel: mutate,
        reconcileStale: mutate,
        recoverExpired: mutate,
        emit: vi.fn(),
      },
    );
    expect(result).toMatchObject({ mode: "dry-run", plan });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("apply executa create/stop/reconcile/recover sob flags", async () => {
    const createChannel = vi.fn().mockResolvedValue({});
    const stopChannel = vi.fn().mockResolvedValue(true);
    const result = await executarMaintenanceAgendaAlpha(
      {
        mode: "apply",
        status: false,
        renewWatches: false,
        reconcileStale: true,
        recoverExpired: true,
        createCalendarIds: ["cal-1"],
        stopChannelIds: ["channel-1"],
        stopAll: false,
      },
      {
        config: fullConfig,
        getPlan: vi.fn().mockResolvedValue(plan),
        createChannel,
        stopChannel,
        reconcileStale: vi.fn().mockResolvedValue(1),
        recoverExpired: vi.fn().mockResolvedValue(1),
        emit: vi.fn(),
      },
    );
    expect(result).toMatchObject({
      mode: "apply",
      channelsCreated: 1,
      reconciliationsEnqueued: 1,
      expiredClaimsRecovered: 1,
      stopped: { concluidos: 1, falhas: 0 },
    });
  });
});

