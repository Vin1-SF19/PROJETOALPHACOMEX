import { describe, expect, it } from "vitest";
import { DOCK_PROGRESS, ROUTE_HANDOFF_PROGRESS, getPageTowFraction, getVoyageLayout } from "../../src/components/login/login-voyage";

describe("geometria do embarque e reboque", () => {
  it.each([[390, 844], [1366, 768], [1440, 900], [1600, 900], [1920, 1080], [2560, 1440]])("mantém encontro e corda conectados em %ix%i", (width, height) => {
    const layout = getVoyageLayout(width, height);
    expect(layout.dockX + layout.shipWidth * 0.57).toBeCloseTo(width / 2);
    expect(layout.startX + layout.shipWidth).toBeLessThan(0);
    expect(layout.startX).toBeLessThan(layout.dockX);
    expect(layout.dockX).toBeLessThan(layout.handoffX);
    expect(layout.handoffX).toBeLessThan(layout.exitX);
    expect(layout.exitX).toBeGreaterThan(width);
    expect(layout.ropeLength).toBeGreaterThan(0);
    expect(layout.cargoScale).toBeGreaterThan(0);
    expect(layout.cargoScale).toBeLessThan(1);

    for (const fraction of [0, 0.2, 0.5, 0.8, 1]) {
      const shipX = layout.handoffX + (layout.exitX - layout.handoffX) * fraction;
      const ropeLeftAnchor = shipX + layout.sternOffset - layout.ropeLength;
      const progress = ROUTE_HANDOFF_PROGRESS + (1 - ROUTE_HANDOFF_PROGRESS) * fraction;
      const actualPageRightEdge = width * getPageTowFraction(progress);
      expect(ropeLeftAnchor).toBeCloseTo(actualPageRightEdge);
    }
  });

  it("mantém o painel fora da tela até a partida e termina alinhado sem overshoot", () => {
    expect(getPageTowFraction(-1)).toBe(0);
    expect(getPageTowFraction(DOCK_PROGRESS)).toBe(0);
    expect(getPageTowFraction(ROUTE_HANDOFF_PROGRESS)).toBe(0);
    expect(getPageTowFraction(1)).toBe(1);
    expect(getPageTowFraction(2)).toBe(1);
  });
});
