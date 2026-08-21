import "server-only";

import {
  executeAlphaSeoDataForSeo,
  type AlphaSeoProviderOperationAccess,
} from "@/lib/alpha-seo/dataforseo/operations";

export interface LighthouseSampleResult {
  strategy: "MOBILE" | "DESKTOP";
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  ttfbMs: number | null;
  errorMessage?: string | null;
  payload?: unknown;
}

export interface LighthouseProvider {
  run(url: string, strategy: "MOBILE" | "DESKTOP"): Promise<LighthouseSampleResult>;
}

interface LighthouseApprovalPolicy {
  request: unknown;
  units: number;
}

export class DataForSeoLighthouseProvider implements LighthouseProvider {
  constructor(
    private readonly access: AlphaSeoProviderOperationAccess,
    private readonly approval?: LighthouseApprovalPolicy,
  ) {}

  async run(url: string, strategy: "MOBILE" | "DESKTOP"): Promise<LighthouseSampleResult> {
    try {
      const response = await executeAlphaSeoDataForSeo({
        access: this.access,
        operation: "LIGHTHOUSE",
        path: "on_page/lighthouse/live/json",
        payload: { url, for_mobile: strategy === "MOBILE" },
        units: 1,
        cacheTtlSeconds: 86_400,
        timeoutMs: 120_000,
        approval: this.approval
          ? { operation: "LIGHTHOUSE", request: this.approval.request, units: this.approval.units }
          : undefined,
        parse: (results) => mapLighthouseResult(results[0], strategy),
      });
      return response.data;
    } catch (error) {
      return emptyLighthouseResult(
        strategy,
        error instanceof Error ? error.message : "LIGHTHOUSE_FAILED",
      );
    }
  }
}

export function mapLighthouseResult(
  raw: unknown,
  strategy: "MOBILE" | "DESKTOP",
): LighthouseSampleResult {
  const result = isRecord(raw) ? raw : {};
  const categories = isRecord(result.categories) ? result.categories : {};
  const audits = isRecord(result.audits) ? result.audits : {};
  return {
    strategy,
    performanceScore: score(categories.performance),
    accessibilityScore: score(categories.accessibility),
    bestPracticesScore: score(categories["best-practices"]),
    seoScore: score(categories.seo),
    lcpMs: numericAudit(audits["largest-contentful-paint"]),
    cls: numericAudit(audits["cumulative-layout-shift"]),
    inpMs: numericAudit(audits["interaction-to-next-paint"]),
    ttfbMs: numericAudit(audits["server-response-time"]),
    payload: result,
  };
}

function emptyLighthouseResult(
  strategy: "MOBILE" | "DESKTOP",
  errorMessage: string,
): LighthouseSampleResult {
  return {
    strategy,
    performanceScore: null,
    accessibilityScore: null,
    bestPracticesScore: null,
    seoScore: null,
    lcpMs: null,
    cls: null,
    inpMs: null,
    ttfbMs: null,
    errorMessage,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function score(value: unknown) {
  if (!isRecord(value) || typeof value.score !== "number") return null;
  return Math.round(value.score <= 1 ? value.score * 100 : value.score);
}

function numericAudit(value: unknown) {
  return isRecord(value) && typeof value.numericValue === "number" ? value.numericValue : null;
}
