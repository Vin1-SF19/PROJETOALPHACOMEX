import { describe, expect, it, vi } from "vitest";
import { GA4_REPORTS, runGa4Report } from "@/lib/alpha-seo/google/ga4";

describe("GA4", () => {
  it("preserva os dez contratos de relatório", () =>
    expect(GA4_REPORTS).toHaveLength(10));
  it("normaliza dimensões e métricas sem rede real", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            dimensionHeaders: [{ name: "date" }],
            metricHeaders: [{ name: "sessions" }],
            rows: [
              {
                dimensionValues: [{ value: "20260820" }],
                metricValues: [{ value: "12" }],
              },
            ],
            rowCount: 1,
          }),
          { status: 200 },
        ),
      );
    const result = await runGa4Report("token", {
      propertyId: "properties/123",
      report: "organic_overview",
      startDate: "2026-08-01",
      endDate: "2026-08-20",
    });
    expect(result.rows[0]).toEqual({ date: "20260820", sessions: 12 });
    fetchMock.mockRestore();
  });
});
