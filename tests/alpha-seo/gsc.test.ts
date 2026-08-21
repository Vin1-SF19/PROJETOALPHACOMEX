import { describe, expect, it } from "vitest";
import {
  previousPeriod,
  rowsToCsv,
  searchTotals,
  strikingDistance,
} from "@/lib/alpha-seo/google/gsc";
describe("GSC", () => {
  const rows = [
    {
      keys: ["term", "/a"],
      clicks: 10,
      impressions: 100,
      ctr: 0.1,
      position: 8,
    },
    {
      keys: ["term", "/b"],
      clicks: 2,
      impressions: 50,
      ctr: 0.04,
      position: 4,
    },
    {
      keys: ["other", "/c"],
      clicks: 1,
      impressions: 20,
      ctr: 0.05,
      position: 12,
    },
  ];
  it("calcula totais ponderados", () =>
    expect(searchTotals(rows)).toEqual({
      clicks: 13,
      impressions: 170,
      ctr: 13 / 170,
      position: (800 + 200 + 240) / 170,
    }));
  it("striking distance usa a melhor página", () =>
    expect(strikingDistance(rows).map((r) => r.query)).toEqual(["other"]));
  it("resolve período anterior com o mesmo número de dias", () =>
    expect(previousPeriod("2026-08-11", "2026-08-20")).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-10",
    }));
  it("export CSV neutraliza fórmulas", () =>
    expect(
      rowsToCsv([
        { keys: ["=CMD()"], clicks: 0, impressions: 0, ctr: 0, position: 0 },
      ]),
    ).toContain("'=CMD()"));
});
