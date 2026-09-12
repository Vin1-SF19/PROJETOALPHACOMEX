import { describe, expect, it } from "vitest";

import {
  loginTransitionIsBlocking,
  reduceLoginTransition,
  type LoginTransitionEvent,
  type LoginTransitionPhase,
} from "@/components/login/login-transition-state";

function run(events: LoginTransitionEvent[]): LoginTransitionPhase[] {
  return events.reduce<LoginTransitionPhase[]>((phases, event) => {
    phases.push(reduceLoginTransition(phases.at(-1) ?? "idle", event));
    return phases;
  }, ["idle"]);
}

describe("máquina de estados da transição de login", () => {
  it("só navega e revela o painel depois da autenticação e da rota pronta", () => {
    expect(run([
      { type: "SUBMIT" },
      { type: "AUTH_SUCCESS" },
      { type: "COVERING" },
      { type: "COVERED" },
      { type: "ROUTE_READY" },
      { type: "TRAVERSAL_COMPLETE" },
      { type: "RESET" },
    ])).toEqual([
      "idle",
      "validating",
      "authorized",
      "covering",
      "navigation",
      "traversing",
      "revealed",
      "idle",
    ]);
  });

  it("mantém o formulário disponível após falha e ignora eventos fora de ordem", () => {
    expect(run([
      { type: "AUTH_SUCCESS" },
      { type: "SUBMIT" },
      { type: "ROUTE_READY" },
      { type: "AUTH_FAILURE" },
    ])).toEqual(["idle", "idle", "validating", "validating", "auth_error"]);
    expect(loginTransitionIsBlocking("auth_error")).toBe(false);
  });

  it("é idempotente para callbacks duplicados em todos os checkpoints", () => {
    expect(run([
      { type: "SUBMIT" },
      { type: "SUBMIT" },
      { type: "AUTH_SUCCESS" },
      { type: "AUTH_SUCCESS" },
      { type: "COVERING" },
      { type: "COVERING" },
      { type: "COVERED" },
      { type: "COVERED" },
      { type: "ROUTE_READY" },
      { type: "ROUTE_READY" },
      { type: "TRAVERSAL_COMPLETE" },
      { type: "TRAVERSAL_COMPLETE" },
      { type: "RESET" },
      { type: "RESET" },
    ])).toEqual([
      "idle",
      "validating",
      "validating",
      "authorized",
      "authorized",
      "covering",
      "covering",
      "navigation",
      "navigation",
      "traversing",
      "traversing",
      "revealed",
      "revealed",
      "idle",
      "idle",
    ]);
  });

  it.each<LoginTransitionPhase>([
    "validating",
    "authorized",
    "covering",
    "navigation",
    "traversing",
    "revealed",
  ])("bloqueia interação durante %s", (phase) => {
    expect(loginTransitionIsBlocking(phase)).toBe(true);
  });
});
