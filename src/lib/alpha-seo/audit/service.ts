import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { enqueueAlphaSeoJob, toPrismaJson } from "@/lib/alpha-seo/jobs/queue";
import { safeCrawlerFetch } from "@/lib/alpha-seo/crawler/fetch";
import { analyzeAuditResponse } from "@/lib/alpha-seo/crawler/html";
import { discoverAuditUrls } from "@/lib/alpha-seo/crawler/robots";
import { isSameCrawlOrigin, resolveSafeRedirects, type DnsResolver } from "@/lib/alpha-seo/crawler/url-policy";
import { ALPHA_SEO_AUDIT_ISSUES, runMultipageAuditIssues, runPageAuditIssues, type AuditedPage, type DetectedAuditIssue } from "./issues";
import type { AuditConfig, AuditMutationMode } from "./contracts";
import { DataForSeoLighthouseProvider, type LighthouseProvider } from "@/lib/alpha-seo/lighthouse/provider";
import { selectLighthouseSample } from "@/lib/alpha-seo/lighthouse/sample";
import { acquireAlphaSeoMutex, releaseAlphaSeoMutex } from "@/lib/alpha-seo/jobs/mutex";
import { newAuditCrawlCheckpoint, recordAuditCheckpointPage, type AuditCrawlCheckpoint } from "./checkpoint";
import { storeLighthousePayload } from "@/lib/alpha-seo/lighthouse/storage";
import {
  approveAlphaSeoProviderCost,
  assertAlphaSeoProviderCostApproved,
  estimateAlphaSeoProviderRequest,
  type AlphaSeoProviderOperationAccess,
} from "@/lib/alpha-seo/dataforseo/operations";

const LIGHTHOUSE_SAMPLE_LIMIT = 10;

export function auditLighthouseCostPlan(config: AuditConfig) {
  const units = config.lighthouseStrategy === "AUTO"
    ? Math.min(config.maxPages, LIGHTHOUSE_SAMPLE_LIMIT) * 2
    : 0;
  return {
    operation: "LIGHTHOUSE",
    units,
    request: { maxPages: config.maxPages, lighthouseStrategy: config.lighthouseStrategy },
  };
}

export function estimateSiteAuditCost(access: AlphaSeoProviderOperationAccess, config: AuditConfig) {
  const plan = auditLighthouseCostPlan(config);
  return estimateAlphaSeoProviderRequest(access, plan.operation, plan.request, plan.units);
}

export async function approveSiteAuditCost(access: AlphaSeoProviderOperationAccess, config: AuditConfig) {
  const plan = auditLighthouseCostPlan(config);
  return approveAlphaSeoProviderCost(access, plan.operation, plan.request, plan.units);
}

export async function startSiteAudit(input: { projectId: string; userId: number; startUrl: string; config: AuditConfig; resolver?: DnsResolver; fetcher?: typeof fetch }) {
  const project = await db.alphaSeoProject.findFirst({ where: { id: input.projectId, status: "ACTIVE" }, select: { id: true } });
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  const costPlan = auditLighthouseCostPlan(input.config);
  if (costPlan.units > 0) {
    await assertAlphaSeoProviderCostApproved(
      { projectId: input.projectId, userId: input.userId },
      costPlan.operation,
      costPlan.request,
      costPlan.units,
    );
  }
  const lease = await acquireAlphaSeoMutex({ projectId: input.projectId, operation: "SITE_AUDIT_MUTEX", key: input.projectId });
  if (!lease) throw new Error("AUDIT_LEASE_CONFLICT");
  try {
    await recoverStaleAudits(input.projectId);
    const running = await db.alphaSeoSiteAudit.findFirst({ where: { projectId: input.projectId, status: { in: ["PENDING", "RUNNING"] } }, orderBy: { startedAt: "desc" }, select: { id: true } });
    if (running) return { ok: false as const, reason: "ALREADY_RUNNING" as const, auditId: running.id };
    const startUrl = await resolveSafeRedirects({ url: ensureUrl(input.startUrl), resolver: input.resolver, fetcher: input.fetcher });
    const auditId = randomUUID();
    const idempotencyKey = `audit:${auditId}`;
    await db.alphaSeoSiteAudit.create({
      data: { id: auditId, projectId: input.projectId, startedById: input.userId, startUrl, idempotencyKey, config: input.config, pagesTotal: input.config.maxPages, lighthouseTotal: input.config.lighthouseStrategy === "AUTO" ? 20 : 0 },
    });
    await enqueueAlphaSeoJob({ projectId: input.projectId, type: "SITE_AUDIT", idempotencyKey: `job:${idempotencyKey}`, payload: { auditId } });
    return { ok: true as const, auditId };
  } finally {
    await releaseAlphaSeoMutex(lease);
  }
}

export async function recoverStaleAudits(projectId?: string, now = new Date()) {
  const stale = new Date(now.getTime() - 15 * 60_000);
  return db.alphaSeoSiteAudit.updateMany({
    where: { ...(projectId ? { projectId } : {}), status: { in: ["PENDING", "RUNNING"] }, OR: [{ leaseExpiresAt: { lt: now } }, { leaseExpiresAt: null, heartbeatAt: { lt: stale } }, { leaseExpiresAt: null, heartbeatAt: null, startedAt: { lt: stale } }] },
    data: { status: "FAILED", errorCode: "STALE_LEASE", errorDetail: "Auditoria recuperada apos lease expirado", failedPhase: "worker", completedAt: now },
  });
}

export async function getSiteAuditStatus(projectId: string, auditId: string) {
  const audit = await db.alphaSeoSiteAudit.findFirst({
    where: { id: auditId, projectId },
    select: { id: true, startUrl: true, status: true, pagesCrawled: true, pagesTotal: true, lighthouseTotal: true, lighthouseCompleted: true, lighthouseFailed: true, currentPhase: true, errorCode: true, errorDetail: true, failedPhase: true, startedAt: true, completedAt: true, heartbeatAt: true },
  });
  if (!audit) throw new Error("AUDIT_NOT_FOUND");
  return audit;
}

export async function listSiteAudits(projectId: string) {
  return db.alphaSeoSiteAudit.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, startUrl: true, status: true, pagesCrawled: true, pagesTotal: true, lighthouseCompleted: true, lighthouseFailed: true, currentPhase: true, errorCode: true, startedAt: true, completedAt: true } });
}

export async function getSiteAuditResults(input: { projectId: string; auditId: string; page: number; limit: number; issueType?: string; severity?: "CRITICAL" | "WARNING" | "INFO" }) {
  const audit = await db.alphaSeoSiteAudit.findFirst({ where: { id: input.auditId, projectId: input.projectId }, select: { id: true, startUrl: true, status: true, pagesCrawled: true, pagesTotal: true, config: true, startedAt: true, completedAt: true } });
  if (!audit) throw new Error("AUDIT_NOT_FOUND");
  const skip = (input.page - 1) * input.limit;
  const [pages, pageTotal, issues, issueTotal, lighthouse] = await Promise.all([
    db.alphaSeoAuditPage.findMany({ where: { auditId: input.auditId }, orderBy: { url: "asc" }, skip, take: input.limit, select: { id: true, url: true, statusCode: true, redirectUrl: true, title: true, metaDescription: true, h1Count: true, wordCount: true, imagesTotal: true, imagesMissingAlt: true, internalLinkCount: true, externalLinkCount: true, isIndexable: true, crawlDepth: true, inSitemap: true, fetchClass: true, responseTimeMs: true } }),
    db.alphaSeoAuditPage.count({ where: { auditId: input.auditId } }),
    db.alphaSeoAuditIssue.findMany({ where: { auditId: input.auditId, ...(input.issueType ? { issueType: input.issueType } : {}), ...(input.severity ? { severity: input.severity } : {}) }, orderBy: [{ severity: "asc" }, { issueType: "asc" }], skip, take: input.limit, select: { id: true, pageId: true, pageUrl: true, issueType: true, severity: true, details: true } }),
    db.alphaSeoAuditIssue.count({ where: { auditId: input.auditId, ...(input.issueType ? { issueType: input.issueType } : {}), ...(input.severity ? { severity: input.severity } : {}) } }),
    db.alphaSeoAuditLighthouse.findMany({ where: { auditId: input.auditId }, orderBy: [{ pageId: "asc" }, { strategy: "asc" }], take: 100, select: { id: true, pageId: true, strategy: true, performanceScore: true, accessibilityScore: true, bestPracticesScore: true, seoScore: true, lcpMs: true, cls: true, inpMs: true, ttfbMs: true, errorMessage: true } }),
  ]);
  return { audit, pages, issues, lighthouse, pagination: { page: input.page, limit: input.limit, pagesTotal: pageTotal, issuesTotal: issueTotal } };
}

export async function removeSiteAudit(
  projectId: string,
  auditId: string,
  mode: AuditMutationMode,
) {
  if (mode === "CANCEL") {
    const cancelled = await db.alphaSeoSiteAudit.updateMany({
      where: {
        id: auditId,
        projectId,
        status: { in: ["PENDING", "RUNNING"] },
      },
      data: {
        status: "CANCELLED",
        currentPhase: "CANCELLED",
        completedAt: new Date(),
        leaseExpiresAt: null,
      },
    });
    if (cancelled.count === 1) {
      return { mode: "CANCEL" as const, cancelled: true as const };
    }
    await assertAuditMutationTarget(projectId, auditId);
    throw new Error("AUDIT_CANCEL_STATE_CONFLICT");
  }

  const deleted = await db.alphaSeoSiteAudit.deleteMany({
    where: {
      id: auditId,
      projectId,
      status: { in: ["COMPLETED", "FAILED", "CANCELLED"] },
    },
  });
  if (deleted.count === 1) {
    return { mode: "DELETE" as const, deleted: true as const };
  }
  await assertAuditMutationTarget(projectId, auditId);
  throw new Error("AUDIT_DELETE_STATE_CONFLICT");
}

async function assertAuditMutationTarget(projectId: string, auditId: string) {
  const audit = await db.alphaSeoSiteAudit.findFirst({
    where: { id: auditId, projectId },
    select: { id: true },
  });
  if (!audit) throw new Error("AUDIT_NOT_FOUND");
}

export async function processSiteAudit(input: { auditId: string; workerId: string; resolver?: DnsResolver; fetcher?: typeof fetch; lighthouseProvider?: LighthouseProvider; heartbeatJob?: () => Promise<void>; checkpoint?: AuditCrawlCheckpoint; persistCheckpoint?: (checkpoint: AuditCrawlCheckpoint) => Promise<void> }) {
  const audit = await db.alphaSeoSiteAudit.findUnique({ where: { id: input.auditId }, select: { id: true, projectId: true, startedById: true, startUrl: true, config: true, status: true, leaseToken: true } });
  if (!audit) throw new Error("AUDIT_NOT_FOUND");
  if (!["PENDING", "RUNNING"].includes(audit.status)) {
    if (["COMPLETED", "CANCELLED"].includes(audit.status)) {
      return { skipped: true, terminal: true, reason: `AUDIT_${audit.status}` };
    }
    throw new Error("AUDIT_TERMINAL_FAILED");
  }
  const token = audit.leaseToken + 1;
  const now = new Date();
  const claimed = await db.alphaSeoSiteAudit.updateMany({ where: { id: audit.id, leaseToken: audit.leaseToken, OR: [{ status: "PENDING" }, { status: "RUNNING", leaseOwner: input.workerId }, { status: "RUNNING", leaseExpiresAt: { lt: now } }] }, data: { status: "RUNNING", currentPhase: "DISCOVERY", leaseOwner: input.workerId, leaseToken: token, leaseExpiresAt: new Date(Date.now() + 300_000), heartbeatAt: now } });
  if (claimed.count !== 1) {
    return { skipped: true, retryable: true, delayMs: 30_000, reason: "AUDIT_LEASE_BUSY" };
  }
  const config = parseAuditConfig(audit.config);
  const origin = new URL(audit.startUrl).origin;
  let slimPages: AuditedPage[] = input.checkpoint?.pages ? [...input.checkpoint.pages] : [];
  try {
    const discovery = await discoverAuditUrls({ origin, maxPages: config.maxPages, resolver: input.resolver, fetcher: input.fetcher, heartbeat: input.heartbeatJob });
    let checkpoint = input.checkpoint;
    if (!checkpoint) {
      const initialQueue: Array<{ url: string; depth: number | null; inSitemap: boolean }> = [];
      if (discovery.robots.isAllowed(audit.startUrl)) initialQueue.push({ url: audit.startUrl, depth: 0, inSitemap: discovery.urls.includes(audit.startUrl) });
      for (const url of discovery.urls) initialQueue.push({ url, depth: null, inSitemap: true });
      checkpoint = newAuditCrawlCheckpoint(initialQueue);
      await input.persistCheckpoint?.(checkpoint);
    }
    let queue = [...checkpoint.queue];
    const seen = new Set<string>(checkpoint.seen);
    await heartbeatAudit(audit.id, input.workerId, token, { currentPhase: "CRAWLING", pagesTotal: Math.min(config.maxPages, queue.length) });
    while (queue.length > 0 && slimPages.length < config.maxPages) {
      const entry = queue.shift()!;
      if (seen.has(entry.url) || !isSameCrawlOrigin(entry.url, origin) || !discovery.robots.isAllowed(entry.url)) continue;
      seen.add(entry.url);
      let analyzed: ReturnType<typeof analyzeAuditResponse>;
      try {
        const response = await safeCrawlerFetch({ url: entry.url, resolver: input.resolver, fetcher: input.fetcher, maxBytes: 1_048_576, timeoutMs: 15_000 });
        analyzed = analyzeAuditResponse({ ...response, pageId: auditRowId(audit.id, entry.url), origin, depth: entry.depth, inSitemap: entry.inSitemap });
      } catch (error) {
        analyzed = errorPage(audit.id, entry, error);
      }
      slimPages = slimPages.filter((page) => page.url !== analyzed.url);
      slimPages.push(analyzed);
      await persistAuditPage(audit.id, analyzed);
      await persistIssues(audit.id, runPageAuditIssues(analyzed));
      checkpoint = recordAuditCheckpointPage({ version: 1, queue, seen: [...seen], pages: slimPages }, {
        entry,
        page: analyzed,
        discovered: analyzed.internalLinks
          .filter((url) => isSameCrawlOrigin(url, origin) && discovery.robots.isAllowed(url))
          .map((url) => ({ url, inSitemap: discovery.urls.includes(url) })),
        redirectUrl: analyzed.redirectUrl && isSameCrawlOrigin(analyzed.redirectUrl, origin) && discovery.robots.isAllowed(analyzed.redirectUrl) ? analyzed.redirectUrl : null,
      });
      queue = [...checkpoint.queue];
      slimPages = [...checkpoint.pages];
      await input.persistCheckpoint?.(checkpoint);
      await heartbeatAudit(audit.id, input.workerId, token, { pagesCrawled: slimPages.length, pagesTotal: Math.min(config.maxPages, slimPages.length + queue.length) });
      await input.heartbeatJob?.();
    }
    const crawlCompleted = queue.length === 0;
    await heartbeatAudit(audit.id, input.workerId, token, { currentPhase: "FINALIZING" });
    await persistIssues(audit.id, runMultipageAuditIssues(slimPages, audit.startUrl, crawlCompleted));
    if (config.lighthouseStrategy === "AUTO") await processAuditLighthouse({ auditId: audit.id, projectId: audit.projectId, userId: audit.startedById, config, workerId: input.workerId, token, startUrl: audit.startUrl, pages: slimPages, provider: input.lighthouseProvider, heartbeatJob: input.heartbeatJob });
    const completed = await db.alphaSeoSiteAudit.updateMany({
      where: { id: audit.id, status: "RUNNING", leaseOwner: input.workerId, leaseToken: token },
      data: { status: "COMPLETED", currentPhase: "COMPLETED", pagesCrawled: slimPages.length, pagesTotal: slimPages.length, errorCode: crawlCompleted ? null : "PARTIAL_CRAWL", errorDetail: crawlCompleted ? null : "Limite de paginas atingido antes de esgotar a fronteira", completedAt: new Date(), leaseExpiresAt: null, heartbeatAt: new Date() },
    });
    if (completed.count !== 1) throw new Error("AUDIT_FENCE_LOST");
    return { skipped: false, pagesCrawled: slimPages.length, crawlCompleted };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "AUDIT_FAILED";
    const finalized = await db.alphaSeoSiteAudit.updateMany({ where: { id: audit.id, status: "RUNNING", leaseOwner: input.workerId, leaseToken: token }, data: { status: slimPages.length > 0 ? "COMPLETED" : "FAILED", errorCode: slimPages.length > 0 ? "PARTIAL_CRAWL" : "AUDIT_FAILED", errorDetail: detail.slice(0, 1_000), failedPhase: "worker", pagesCrawled: slimPages.length, completedAt: new Date(), leaseExpiresAt: null } });
    if (finalized.count !== 1) throw error;
    if (slimPages.length === 0) throw error;
    return { skipped: false, pagesCrawled: slimPages.length, crawlCompleted: false };
  }
}

async function processAuditLighthouse(input: { auditId: string; projectId: string; userId: number; config: AuditConfig; workerId: string; token: number; startUrl: string; pages: AuditedPage[]; provider?: LighthouseProvider; heartbeatJob?: () => Promise<void> }) {
  const sample = selectLighthouseSample(input.pages, input.startUrl);
  await heartbeatAudit(input.auditId, input.workerId, input.token, { currentPhase: "LIGHTHOUSE", lighthouseTotal: sample.length * 2, lighthouseCompleted: 0, lighthouseFailed: 0 });
  const costPlan = auditLighthouseCostPlan(input.config);
  const provider = input.provider ?? new DataForSeoLighthouseProvider(
    { projectId: input.projectId, userId: input.userId },
    { request: costPlan.request, units: costPlan.units },
  );
  let completed = 0; let failed = 0;
  for (const url of sample) {
    const page = input.pages.find((item) => item.url === url); if (!page) continue;
    for (const strategy of ["MOBILE", "DESKTOP"] as const) {
      await input.heartbeatJob?.();
      const result = await provider.run(url, strategy);
      const stored = result.payload === undefined ? null : await storeLighthousePayload({ auditId: input.auditId, pageId: page.id, strategy, payload: result.payload }).catch(() => null);
      await db.alphaSeoAuditLighthouse.upsert({
        where: { pageId_strategy: { pageId: page.id, strategy } },
        update: { performanceScore: result.performanceScore, accessibilityScore: result.accessibilityScore, bestPracticesScore: result.bestPracticesScore, seoScore: result.seoScore, lcpMs: result.lcpMs, cls: result.cls, inpMs: result.inpMs, ttfbMs: result.ttfbMs, errorMessage: result.errorMessage, storageKey: stored?.storageKey, payloadSizeBytes: stored?.payloadSizeBytes },
        create: { auditId: input.auditId, pageId: page.id, strategy, performanceScore: result.performanceScore, accessibilityScore: result.accessibilityScore, bestPracticesScore: result.bestPracticesScore, seoScore: result.seoScore, lcpMs: result.lcpMs, cls: result.cls, inpMs: result.inpMs, ttfbMs: result.ttfbMs, errorMessage: result.errorMessage, storageKey: stored?.storageKey, payloadSizeBytes: stored?.payloadSizeBytes },
      });
      if (result.errorMessage) failed += 1;
      else completed += 1;
      await heartbeatAudit(input.auditId, input.workerId, input.token, { lighthouseCompleted: completed, lighthouseFailed: failed });
    }
  }
}

async function heartbeatAudit(auditId: string, workerId: string, token: number, data: Prisma.AlphaSeoSiteAuditUpdateManyMutationInput) {
  const updated = await db.alphaSeoSiteAudit.updateMany({ where: { id: auditId, status: "RUNNING", leaseOwner: workerId, leaseToken: token }, data: { ...data, heartbeatAt: new Date(), leaseExpiresAt: new Date(Date.now() + 300_000) } });
  if (updated.count !== 1) throw new Error("AUDIT_FENCE_LOST");
}

async function persistAuditPage(auditId: string, page: ReturnType<typeof analyzeAuditResponse>) {
  await db.alphaSeoAuditPage.upsert({
    where: { auditId_url: { auditId, url: page.url } },
    update: pageData(page), create: { id: page.id, auditId, url: page.url, ...pageData(page) },
  });
}

function pageData(page: ReturnType<typeof analyzeAuditResponse>) {
  return {
    statusCode: page.statusCode, redirectUrl: page.redirectUrl, title: page.title, metaDescription: page.metaDescription,
    canonicalUrl: page.canonicalUrl, robotsMeta: page.robotsMeta, ogTitle: page.ogTitle, ogDescription: page.ogDescription, ogImage: page.ogImage,
    h1Count: page.h1Count, h2Count: page.headings.h2, h3Count: page.headings.h3, h4Count: page.headings.h4, h5Count: page.headings.h5, h6Count: page.headings.h6,
    headingOrder: page.headingOrder, wordCount: page.wordCount, imagesTotal: page.imagesTotal, imagesMissingAlt: page.imagesMissingAlt,
    images: page.images, internalLinkCount: page.internalLinks.length, externalLinkCount: page.externalLinkCount,
    hasStructuredData: page.hasStructuredData, hreflangTags: page.hreflangTags, isIndexable: page.isIndexable,
    xRobotsTag: page.xRobotsTag, headerCanonicalUrl: page.headerCanonicalUrl, crawlDepth: page.crawlDepth, inSitemap: page.inSitemap,
    contentHash: page.contentHash, fetchClass: page.fetchClass, responseTimeMs: page.responseTimeMs,
  } satisfies Prisma.AlphaSeoAuditPageUncheckedUpdateInput;
}

async function persistIssues(auditId: string, issues: DetectedAuditIssue[]) {
  if (issues.length === 0) return;
  await Promise.all(issues.map((issue) => db.alphaSeoAuditIssue.upsert({
    where: { id: issueRowId(auditId, issue) }, update: {},
    create: { id: issueRowId(auditId, issue), auditId, pageId: issue.pageId, pageUrl: issue.pageUrl, issueType: issue.issueType, severity: ALPHA_SEO_AUDIT_ISSUES[issue.issueType], details: issue.details ? toPrismaJson(issue.details) : undefined },
  })));
}

function parseAuditConfig(value: Prisma.JsonValue): AuditConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AUDIT_CONFIG_INVALID");
  const maxPages = value.maxPages; const lighthouseStrategy = value.lighthouseStrategy;
  if (typeof maxPages !== "number" || maxPages < 10 || maxPages > 10_000 || (lighthouseStrategy !== "AUTO" && lighthouseStrategy !== "NONE")) throw new Error("AUDIT_CONFIG_INVALID");
  return { maxPages, lighthouseStrategy };
}

function errorPage(auditId: string, entry: { url: string; depth: number | null; inSitemap: boolean }, error: unknown): ReturnType<typeof analyzeAuditResponse> {
  const detail = error instanceof Error ? error.message : "CRAWL_FAILED";
  return { id: auditRowId(auditId, entry.url), url: entry.url, statusCode: 0, redirectUrl: null, title: null, metaDescription: null, canonicalUrl: null, headerCanonicalUrl: null, robotsMeta: null, xRobotsTag: null, h1Count: 0, headingOrder: [], wordCount: 0, imagesTotal: 0, imagesMissingAlt: 0, internalLinks: [], externalLinkCount: 0, isIndexable: false, crawlDepth: entry.depth, inSitemap: entry.inSitemap, contentHash: null, fetchClass: "ERROR", responseTimeMs: null, isHtml: false, images: [], headings: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 }, hasStructuredData: false, hreflangTags: [], ogTitle: null, ogDescription: detail.slice(0, 300), ogImage: null };
}

function auditRowId(auditId: string, url: string) { return createHash("sha256").update(`${auditId}\0${url}`).digest("hex").slice(0, 32); }
function issueRowId(auditId: string, issue: DetectedAuditIssue) { return createHash("sha256").update(`${auditId}\0${issue.pageUrl}\0${issue.issueType}\0${JSON.stringify(issue.details ?? {})}`).digest("hex").slice(0, 32); }
function ensureUrl(raw: string) { return /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`; }
