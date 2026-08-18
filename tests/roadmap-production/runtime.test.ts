import { describe, expect, it } from "vitest";

import {
  assertRoadmapProductionRuntimeEnabled,
  canUseRoadmapProduction,
  isRoadmapProductionRuntimeEnabled,
  ROADMAP_PRODUCTION_RUNTIME_DISABLED,
} from "@/lib/roadmap-production/runtime";

describe("disponibilidade local da Produção", () => {
  it("permanece desabilitada quando a flag não foi configurada", () => {
    expect(isRoadmapProductionRuntimeEnabled({})).toBe(false);
  });

  it("permanece desabilitada para valores diferentes de true", () => {
    expect(
      isRoadmapProductionRuntimeEnabled({
        ROADMAP_PRODUCTION_ENABLED: "false",
      }),
    ).toBe(false);
    expect(
      isRoadmapProductionRuntimeEnabled({
        ROADMAP_PRODUCTION_ENABLED: "1",
      }),
    ).toBe(false);
  });

  it("fica habilitada somente quando o executor local opta explicitamente", () => {
    expect(
      isRoadmapProductionRuntimeEnabled({
        ROADMAP_PRODUCTION_ENABLED: " TRUE ",
      }),
    ).toBe(true);
  });

  it("exige a flag local e a permissão do usuário em conjunto", () => {
    const localRuntime = { ROADMAP_PRODUCTION_ENABLED: "true" };

    expect(canUseRoadmapProduction(true, localRuntime)).toBe(true);
    expect(canUseRoadmapProduction(false, localRuntime)).toBe(false);
    expect(canUseRoadmapProduction(true, {})).toBe(false);
  });

  it("gera um erro identificável para chamadas diretas no hospedado", () => {
    expect(() => assertRoadmapProductionRuntimeEnabled({})).toThrow(
      ROADMAP_PRODUCTION_RUNTIME_DISABLED,
    );
  });
});
