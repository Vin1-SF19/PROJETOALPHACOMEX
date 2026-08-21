import "server-only";

import db from "@/lib/prisma";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import {
  alphaSeoLighthouseExportSchema,
  alphaSeoLighthouseIssueSchema,
  asLighthouseRecord,
  buildAlphaSeoLighthouseExportFile,
  buildAlphaSeoLighthouseIssueReport,
  lighthouseStringOrNull,
} from "./report";
import { readLighthousePayload } from "./storage";

async function loadLighthouseResult(input: { projectId: string; resultId: string }) {
  const result = await db.alphaSeoAuditLighthouse.findFirst({
    where: { id: input.resultId, audit: { projectId: input.projectId } },
    select: {
      id: true,
      strategy: true,
      storageKey: true,
      payloadSizeBytes: true,
      audit: { select: { startedAt: true } },
      page: { select: { url: true } },
    },
  });
  if (!result?.storageKey) throw new Error("LIGHTHOUSE_PAYLOAD_NOT_FOUND");
  const stored = await readLighthousePayload({
    storageKey: result.storageKey,
    expectedSizeBytes: result.payloadSizeBytes,
  });
  const root = asLighthouseRecord(stored.payload);
  return {
    result,
    payload: stored.payload,
    finalUrl:
      lighthouseStringOrNull(root.finalUrl) ??
      lighthouseStringOrNull(root.final_url) ??
      result.page.url,
    strategy: result.strategy === "DESKTOP" ? "desktop" : "mobile",
    createdAt: result.audit.startedAt.toISOString(),
  } as const;
}

export async function getAlphaSeoAuditLighthouseIssues(input: unknown) {
  const parsed = alphaSeoLighthouseIssueSchema.parse(input);
  await requireAlphaSeoProjectAccess({
    projectId: parsed.projectId,
    action: "seo:read",
  });
  const lighthouse = await loadLighthouseResult(parsed);
  const report = buildAlphaSeoLighthouseIssueReport(lighthouse.payload);
  return {
    id: lighthouse.result.id,
    finalUrl: lighthouse.finalUrl,
    strategy: lighthouse.strategy,
    createdAt: lighthouse.createdAt,
    ...report,
  };
}

export async function exportAlphaSeoAuditLighthouseIssues(input: unknown) {
  const parsed = alphaSeoLighthouseExportSchema.parse(input);
  await requireAlphaSeoProjectAccess({
    projectId: parsed.projectId,
    action: "seo:export",
  });
  const lighthouse = await loadLighthouseResult(parsed);
  return buildAlphaSeoLighthouseExportFile({
    resultId: lighthouse.result.id,
    finalUrl: lighthouse.finalUrl,
    strategy: lighthouse.strategy,
    createdAt: lighthouse.createdAt,
    payload: lighthouse.payload,
    mode: parsed.mode,
    category: parsed.category,
  });
}
