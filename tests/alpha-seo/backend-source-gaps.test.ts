import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/alpha-seo/project-access", () => ({
  requireAlphaSeoProjectAccess: vi.fn(),
}));
import {
  getAlphaSeoApiKeyStatus,
  getAlphaSeoSamAccessSetupStatus,
} from "@/lib/alpha-seo/config/status";
import {
  alphaSeoOnboardingAnswersSchema,
  alphaSeoOnboardingSiteSchema,
} from "@/lib/alpha-seo/onboarding/contracts";
import {
  buildAlphaSeoLighthouseExportFile,
  buildAlphaSeoLighthouseIssueReport,
} from "@/lib/alpha-seo/lighthouse/report";
import {
  parseAlphaSeoSerpLocations,
  searchAlphaSeoSerpLocationRows,
} from "@/lib/alpha-seo/serp-locations/service";

describe("Alpha SEO source backend gaps", () => {
  it("exposes only a sanitized DataForSEO configuration boolean", () => {
    const secret = "do-not-return-this-secret";
    const status = getAlphaSeoApiKeyStatus({ DATAFORSEO_API_KEY: secret });
    expect(status).toEqual({ configured: true });
    expect(JSON.stringify(status)).not.toContain(secret);
    expect(
      getAlphaSeoApiKeyStatus({
        DATAFORSEO_LOGIN: "user",
        DATAFORSEO_PASSWORD: "password",
      }),
    ).toEqual({ configured: true });
    expect(getAlphaSeoApiKeyStatus({})).toEqual({ configured: false });
    expect(
      getAlphaSeoSamAccessSetupStatus({ OPENROUTER_API_KEY: secret }),
    ).toEqual({ enabled: true, errorMessage: null });
    expect(
      JSON.stringify(getAlphaSeoSamAccessSetupStatus({ OPENROUTER_API_KEY: secret })),
    ).not.toContain(secret);
  });

  it("validates partial onboarding answers and a bounded site target", () => {
    expect(
      alphaSeoOnboardingAnswersSchema.parse({
        projectId: "project-1",
        interestedFeatures: ["rank", "audit"],
        mcpSetupIntent: "yes",
        completed: true,
      }),
    ).toMatchObject({ completed: true, mcpSetupIntent: "yes" });
    expect(
      alphaSeoOnboardingAnswersSchema.safeParse({
        mcpSetupIntent: "maybe",
      }).success,
    ).toBe(false);
    expect(
      alphaSeoOnboardingSiteSchema.safeParse({
        projectId: "project-1",
        domain: "example.com",
        locationCode: -1,
      }).success,
    ).toBe(false);
  });

  it("filters, normalizes and searches free SERP locations without a provider call", () => {
    const rows = parseAlphaSeoSerpLocations({
      status_code: 20000,
      tasks: [
        {
          status_code: 20000,
          result: [
            {
              location_code: 1001,
              location_name: "São Paulo, São Paulo, Brazil",
              location_type: "City",
            },
            {
              location_code: 1002,
              location_name: "São Paulo,  Brazil",
              location_type: "Region",
            },
            {
              location_code: 1003,
              location_name: "01000-000, Brazil",
              location_type: "Postal Code",
            },
          ],
        },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[1]?.displayLabel).toBe("São Paulo, Brazil");
    expect(searchAlphaSeoSerpLocationRows(rows, "PAULO")).toHaveLength(2);
  });

  it("builds actionable Lighthouse issues, metrics and category exports", () => {
    const payload = {
      finalUrl: "https://example.com/final",
      categories: {
        performance: {
          score: 0.61,
          auditRefs: [
            { id: "render-blocking-resources" },
            { id: "passed-audit" },
            { id: "numeric-audit" },
          ],
        },
        accessibility: { score: 0.9, auditRefs: [{ id: "manual-audit" }] },
        "best-practices": { score: 1, auditRefs: [] },
        seo: { score: 0.88, auditRefs: [] },
      },
      audits: {
        "render-blocking-resources": {
          title: "Eliminate render-blocking resources",
          description: "Resources delay first paint",
          score: 0.4,
          scoreDisplayMode: "binary",
          displayValue: "400 ms",
          details: {
            overallSavingsMs: 400,
            overallSavingsBytes: 20_000,
            items: [{ url: "https://example.com/app.css", wastedMs: 400 }],
          },
        },
        "passed-audit": { score: 0.95, scoreDisplayMode: "binary" },
        "numeric-audit": { score: 0.2, scoreDisplayMode: "numeric" },
        "manual-audit": { score: 0, scoreDisplayMode: "manual" },
        "first-contentful-paint": {
          score: 0.8,
          numericValue: 1500,
          displayValue: "1.5 s",
        },
      },
    };
    const report = buildAlphaSeoLighthouseIssueReport(payload);
    expect(report.hasIssueDetails).toBe(true);
    expect(report.scores.performance).toBe(61);
    expect(report.metrics.firstContentfulPaint.numericValue).toBe(1500);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      category: "performance",
      score: 40,
      severity: "critical",
    });

    const exported = buildAlphaSeoLighthouseExportFile({
      resultId: "result-1",
      finalUrl: "https://example.com/final",
      strategy: "mobile",
      createdAt: "2026-08-20T12:00:00.000Z",
      payload,
      mode: "category",
      category: "performance",
    });
    expect(exported.filename).toContain("performance-issues.json");
    expect(JSON.parse(exported.content).issues).toHaveLength(1);
  });

  it("wires session/module/project ownership on every new action surface", async () => {
    const root = process.cwd();
    const [settings, onboarding, lighthouse] = await Promise.all([
      readFile(path.join(root, "src/actions/AlphaSeoSettings.ts"), "utf8"),
      readFile(path.join(root, "src/lib/alpha-seo/onboarding/service.ts"), "utf8"),
      readFile(path.join(root, "src/lib/alpha-seo/lighthouse/issues.ts"), "utf8"),
    ]);
    expect(settings).toContain("requireAlphaSeoModuleAccess");
    expect(settings).toContain("searchAlphaSeoSerpLocations");
    expect(onboarding).toContain("requireAlphaSeoModuleAccess");
    expect(onboarding).toContain("requireAlphaSeoProjectAccess");
    expect(lighthouse).toContain('action: "seo:read"');
    expect(lighthouse).toContain('action: "seo:export"');
  });
});
