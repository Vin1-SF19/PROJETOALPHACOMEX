import "server-only";

import { z } from "zod";
import db from "@/lib/prisma";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import { executeAlphaSeoDataForSeo } from "@/lib/alpha-seo/dataforseo/operations";
import { normalizeSeoTarget } from "@/lib/alpha-seo/dataforseo/target";

const inputSchema = z.object({ projectId: z.string().min(1) });
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function numberOrNull(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }

export async function getAlphaSeoDashboardActivation(input: unknown) {
  const { projectId } = inputSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess({ projectId, action: "seo:read" });
  const [project, ga4, gsc, userActivation, projectActivation] = await Promise.all([
    db.alphaSeoProject.findUniqueOrThrow({ where: { id: projectId }, select: { domain: true } }),
    db.alphaSeoGa4Connection.findUnique({ where: { projectId }, select: { propertyDisplayName: true } }),
    db.alphaSeoGscConnection.findUnique({ where: { projectId }, select: { siteUrl: true } }),
    db.alphaSeoUserActivation.findUnique({ where: { userId: access.userId }, select: { firstMcpAuthorizedAt: true, firstMcpToolCallAt: true } }),
    db.alphaSeoProjectActivation.findUnique({ where: { projectId }, select: { competitorStepClickedAt: true, mcpCardDismissedAt: true, ga4CardDismissedAt: true } }),
  ]);
  return { domain: project.domain, ga4: { connected: Boolean(ga4), propertyDisplayName: ga4?.propertyDisplayName ?? null, cardDismissedAt: projectActivation?.ga4CardDismissedAt ?? null }, gsc: { connected: Boolean(gsc), siteUrl: gsc?.siteUrl ?? null }, mcp: { authorizedAt: userActivation?.firstMcpAuthorizedAt ?? null, firstToolCallAt: userActivation?.firstMcpToolCallAt ?? null, cardDismissedAt: projectActivation?.mcpCardDismissedAt ?? null }, competitorClickedAt: projectActivation?.competitorStepClickedAt ?? null };
}

export async function getAlphaSeoDashboardOverview(input: unknown) {
  const { projectId } = inputSchema.parse(input);
  await requireAlphaSeoProjectAccess({ projectId, action: "seo:read" });
  const [rankConfigs, audit, backlink] = await Promise.all([
    db.alphaSeoRankConfig.findMany({ where: { projectId, isActive: true }, select: { lastCheckedAt: true, _count: { select: { keywords: true } }, runs: { where: { status: "COMPLETED" }, select: { snapshots: { select: { position: true, trackingKeywordId: true, device: true }, take: 1000 } }, orderBy: { completedAt: "desc" }, take: 2 } }, take: 5 }),
    db.alphaSeoSiteAudit.findFirst({ where: { projectId }, select: { id: true, status: true, pagesCrawled: true, startedAt: true, issues: { select: { issueType: true, severity: true }, take: 5000 } }, orderBy: { createdAt: "desc" } }),
    db.alphaSeoBacklinkSnapshot.findFirst({ where: { projectId }, select: { domain: true, rank: true, backlinks: true, referringDomains: true, newBacklinks: true, lostBacklinks: true, newReferringDomains: true, lostReferringDomains: true, capturedAt: true }, orderBy: { capturedAt: "desc" } }),
  ]);
  const rankMovement = rankConfigs.reduce(
    (totals, config) => {
      const [currentRun, previousRun] = config.runs;
      if (!currentRun || !previousRun) return totals;
      const previousPositions = new Map(
        previousRun.snapshots.map((snapshot) => [
          `${snapshot.trackingKeywordId}:${snapshot.device}`,
          snapshot.position,
        ]),
      );
      for (const snapshot of currentRun.snapshots) {
        const previous = previousPositions.get(`${snapshot.trackingKeywordId}:${snapshot.device}`);
        if (snapshot.position == null || previous == null || snapshot.position === previous) continue;
        if (snapshot.position < previous) totals.improved += 1;
        else totals.declined += 1;
      }
      return totals;
    },
    { improved: 0, declined: 0 },
  );
  const rank = rankConfigs.length ? { trackedKeywords: rankConfigs.reduce((sum, config) => sum + config._count.keywords, 0), top10: rankConfigs.flatMap((config) => config.runs[0]?.snapshots ?? []).filter((snapshot) => snapshot.position !== null && snapshot.position <= 10).length, ...rankMovement, lastCheckedAt: rankConfigs.map((config) => config.lastCheckedAt).filter(Boolean).sort().at(-1) ?? null } : null;
  const issueMap = new Map<string, { issueType: string; severity: string; count: number }>();
  for (const issue of audit?.issues ?? []) { const key = `${issue.issueType}:${issue.severity}`; const current = issueMap.get(key); issueMap.set(key, { ...issue, count: (current?.count ?? 0) + 1 }); }
  const auditSummary = audit ? { status: audit.status.toLowerCase(), pagesCrawled: audit.pagesCrawled, startedAt: audit.startedAt, topIssues: [...issueMap.values()].sort((a, b) => b.count - a.count).slice(0, 3), totalIssueTypes: issueMap.size } : null;
  const backlinks = backlink ? { ...backlink, stale: Date.now() - backlink.capturedAt.getTime() >= 86_400_000 } : null;
  return { rank, audit: auditSummary, backlinks };
}

export async function refreshAlphaSeoDashboardBacklinks(input: unknown) {
  const { projectId } = inputSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess({ projectId, action: "seo:execute", minimumRole: "EDITOR" });
  const project = await db.alphaSeoProject.findUniqueOrThrow({ where: { id: projectId }, select: { domain: true } });
  if (!project.domain) throw new Error("Configure o domínio do projeto primeiro");
  const latest = await db.alphaSeoBacklinkSnapshot.findFirst({ where: { projectId, domain: project.domain }, orderBy: { capturedAt: "desc" }, select: { capturedAt: true } });
  if (latest && Date.now() - latest.capturedAt.getTime() < 86_400_000) return getAlphaSeoDashboardOverview({ projectId });
  const target = normalizeSeoTarget(project.domain, "subdomains");
  const response = await executeAlphaSeoDataForSeo({ access, operation: "BACKLINKS_OVERVIEW", path: "backlinks/summary/live", payload: { target: target.apiTarget, include_subdomains: true, include_indirect_links: true, exclude_internal_backlinks: true, backlinks_status_type: "live", rank_scale: "one_hundred" }, parse: (results) => record(results[0]) });
  const summary = response.data;
  await db.alphaSeoBacklinkSnapshot.create({ data: { projectId, domain: project.domain, rank: numberOrNull(summary.rank), backlinks: numberOrNull(summary.backlinks), referringDomains: numberOrNull(summary.referring_domains), brokenBacklinks: numberOrNull(summary.broken_backlinks), newBacklinks: numberOrNull(summary.new_backlinks), lostBacklinks: numberOrNull(summary.lost_backlinks), newReferringDomains: numberOrNull(summary.new_referring_domains ?? summary.new_reffering_domains), lostReferringDomains: numberOrNull(summary.lost_referring_domains ?? summary.lost_reffering_domains) } });
  return getAlphaSeoDashboardOverview({ projectId });
}

export async function markAlphaSeoDashboardState(input: unknown, field: "competitorStepClickedAt" | "mcpCardDismissedAt" | "ga4CardDismissedAt") {
  const { projectId } = inputSchema.parse(input);
  await requireAlphaSeoProjectAccess({ projectId, action: "project:update", minimumRole: "EDITOR" });
  await db.alphaSeoProjectActivation.upsert({ where: { projectId }, create: { projectId, [field]: new Date() }, update: { [field]: new Date() } });
  return { ok: true };
}
