import "server-only";

import { z } from "zod";

export const ALPHA_SEO_LIGHTHOUSE_CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
] as const;
export type LighthouseCategory =
  (typeof ALPHA_SEO_LIGHTHOUSE_CATEGORIES)[number];
type ExportMode = "full" | "issues" | "category";
type RecordValue = Record<string, unknown>;

export const alphaSeoLighthouseIssueSchema = z.object({
  projectId: z.string().trim().min(1),
  resultId: z.string().trim().min(1),
});
export const alphaSeoLighthouseExportSchema =
  alphaSeoLighthouseIssueSchema
    .extend({
      mode: z.enum(["full", "issues", "category"]),
      category: z.enum(ALPHA_SEO_LIGHTHOUSE_CATEGORIES).optional(),
    })
    .superRefine((value, context) => {
      if (value.mode === "category" && !value.category) {
        context.addIssue({
          code: "custom",
          path: ["category"],
          message: "Categoria é obrigatória neste modo",
        });
      }
    });

type StoredIssue = {
  category: LighthouseCategory;
  auditKey: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string | null;
  displayValue: string | null;
  impactMs: number | null;
  impactBytes: number | null;
  severity: "critical" | "warning" | "info";
  items: string[];
};

export function asLighthouseRecord(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function lighthouseStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function scoreToPercent(value: unknown): number | null {
  const score = numberOrNull(value);
  if (score === null) return null;
  return Math.round(score <= 1 ? score * 100 : score);
}

const DIAGNOSTIC_AUDIT_KEYS = new Set([
  "largest-contentful-paint-element",
  "layout-shifts",
  "diagnostics",
  "metrics",
  "network-requests",
  "network-rtt",
  "network-server-latency",
  "main-thread-tasks",
  "screenshot-thumbnails",
  "final-screenshot",
  "script-treemap-data",
  "resource-summary",
]);

function compactItem(value: unknown): string {
  const item = asLighthouseRecord(value);
  const preferredKeys = [
    "url",
    "source",
    "nodeLabel",
    "snippet",
    "totalBytes",
    "wastedBytes",
    "wastedMs",
    "label",
    "value",
  ];
  const compact: RecordValue = {};
  for (const key of preferredKeys) {
    if (item[key] != null) compact[key] = item[key];
  }
  if (Object.keys(compact).length === 0) {
    for (const [key, nested] of Object.entries(item).slice(0, 6)) {
      compact[key] = nested;
    }
  }
  return JSON.stringify(compact).slice(0, 4_000);
}

function severity(input: {
  score: number | null;
  impactMs: number | null;
  impactBytes: number | null;
}): StoredIssue["severity"] {
  if ((input.impactMs ?? 0) >= 300 || (input.impactBytes ?? 0) >= 150_000) {
    return "critical";
  }
  if (input.score !== null && input.score < 50) return "critical";
  if ((input.impactMs ?? 0) >= 100 || (input.impactBytes ?? 0) >= 50_000) {
    return "warning";
  }
  if (input.score !== null && input.score < 90) return "warning";
  return "info";
}

function metric(audits: RecordValue, key: string) {
  const audit = asLighthouseRecord(audits[key]);
  return {
    score: scoreToPercent(audit.score),
    displayValue: lighthouseStringOrNull(audit.displayValue),
    numericValue: numberOrNull(audit.numericValue),
  };
}

export function buildAlphaSeoLighthouseIssueReport(
  payload: unknown,
  categoryFilter?: LighthouseCategory,
) {
  const root = asLighthouseRecord(payload);
  const audits = asLighthouseRecord(root.audits);
  const categories = asLighthouseRecord(root.categories);
  const issues: StoredIssue[] = [];
  const selectedCategories = categoryFilter
    ? [categoryFilter]
    : [...ALPHA_SEO_LIGHTHOUSE_CATEGORIES];

  for (const category of selectedCategories) {
    const refs = asLighthouseRecord(categories[category]).auditRefs;
    if (!Array.isArray(refs)) continue;
    for (const reference of refs) {
      const auditKey = lighthouseStringOrNull(asLighthouseRecord(reference).id);
      if (!auditKey || DIAGNOSTIC_AUDIT_KEYS.has(auditKey)) continue;
      const audit = asLighthouseRecord(audits[auditKey]);
      if (Object.keys(audit).length === 0) continue;
      const auditScore = scoreToPercent(audit.score);
      const scoreDisplayMode = lighthouseStringOrNull(audit.scoreDisplayMode);
      if (scoreDisplayMode === "numeric") continue;
      if (
        auditScore === null ||
        auditScore >= 90 ||
        ["notApplicable", "informative", "manual", "error"].includes(
          scoreDisplayMode ?? "",
        )
      ) {
        continue;
      }
      const details = asLighthouseRecord(audit.details);
      const impactMs = numberOrNull(details.overallSavingsMs);
      const impactBytes = numberOrNull(details.overallSavingsBytes);
      const items = Array.isArray(details.items)
        ? details.items.slice(0, 10).map(compactItem)
        : [];
      issues.push({
        category,
        auditKey,
        title: lighthouseStringOrNull(audit.title) ?? auditKey,
        description: lighthouseStringOrNull(audit.description) ?? "",
        score: auditScore,
        scoreDisplayMode,
        displayValue: lighthouseStringOrNull(audit.displayValue),
        impactMs,
        impactBytes,
        severity: severity({ score: auditScore, impactMs, impactBytes }),
        items,
      });
    }
  }

  issues.sort((left, right) => {
    const rightImpact = (right.impactMs ?? 0) * 1000 + (right.impactBytes ?? 0);
    const leftImpact = (left.impactMs ?? 0) * 1000 + (left.impactBytes ?? 0);
    return rightImpact - leftImpact || (left.score ?? 100) - (right.score ?? 100);
  });

  return {
    hasIssueDetails: ALPHA_SEO_LIGHTHOUSE_CATEGORIES.some((category) => {
      const refs = asLighthouseRecord(categories[category]).auditRefs;
      return Array.isArray(refs) && refs.length > 0;
    }),
    scores: {
      performance: scoreToPercent(asLighthouseRecord(categories.performance).score),
      accessibility: scoreToPercent(asLighthouseRecord(categories.accessibility).score),
      "best-practices": scoreToPercent(
        asLighthouseRecord(categories["best-practices"]).score,
      ),
      seo: scoreToPercent(asLighthouseRecord(categories.seo).score),
    },
    metrics: {
      firstContentfulPaint: metric(audits, "first-contentful-paint"),
      largestContentfulPaint: metric(audits, "largest-contentful-paint"),
      totalBlockingTime: metric(audits, "total-blocking-time"),
      cumulativeLayoutShift: metric(audits, "cumulative-layout-shift"),
      speedIndex: metric(audits, "speed-index"),
      timeToInteractive: metric(audits, "interactive"),
      interactionToNextPaint: metric(audits, "interaction-to-next-paint"),
      serverResponseTime: metric(audits, "server-response-time"),
    },
    issues,
  };
}

export function buildAlphaSeoLighthouseExportFile(input: {
  resultId: string;
  finalUrl: string;
  strategy: "mobile" | "desktop";
  createdAt: string;
  payload: unknown;
  mode: ExportMode;
  category?: LighthouseCategory;
}) {
  const safeDate = input.createdAt.replace(/[:.]/g, "-");
  const baseName = `lighthouse-${input.strategy}-${safeDate}`;
  if (input.mode === "full") {
    return {
      filename: `${baseName}-payload.json`,
      content: `${JSON.stringify(input.payload, null, 2)}\n`,
      contentType: "application/json",
    };
  }
  const report = buildAlphaSeoLighthouseIssueReport(input.payload, input.category);
  return {
    filename:
      input.mode === "category" && input.category
        ? `${baseName}-${input.category}-issues.json`
        : `${baseName}-issues.json`,
    content: `${JSON.stringify(
      {
        resultId: input.resultId,
        finalUrl: input.finalUrl,
        strategy: input.strategy,
        createdAt: input.createdAt,
        category: input.category ?? "all",
        issues: report.issues,
      },
      null,
      2,
    )}\n`,
    contentType: "application/json",
  };
}
