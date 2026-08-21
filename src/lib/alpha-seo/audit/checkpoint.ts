import { z } from "zod";
import type { AuditedPage } from "./issues";

const queueEntrySchema = z.object({ url: z.string().url(), depth: z.number().int().nonnegative().nullable(), inSitemap: z.boolean() });
const pageSchema = z.object({
  id: z.string().min(1), url: z.string().url(), statusCode: z.number().int().nullable(), redirectUrl: z.string().url().nullable(),
  title: z.string().nullable(), metaDescription: z.string().nullable(), canonicalUrl: z.string().url().nullable(), headerCanonicalUrl: z.string().url().nullable(),
  robotsMeta: z.string().nullable(), xRobotsTag: z.string().nullable(), h1Count: z.number().int().nonnegative(), headingOrder: z.array(z.number().int().min(1).max(6)),
  wordCount: z.number().int().nonnegative(), imagesTotal: z.number().int().nonnegative(), imagesMissingAlt: z.number().int().nonnegative(),
  internalLinks: z.array(z.string().url()), externalLinkCount: z.number().int().nonnegative(), isIndexable: z.boolean(), crawlDepth: z.number().int().nonnegative().nullable(),
  inSitemap: z.boolean(), contentHash: z.string().nullable(), fetchClass: z.enum(["OK", "BLOCKED", "ERROR"]), responseTimeMs: z.number().int().nonnegative().nullable(), isHtml: z.boolean(),
});

export const auditCrawlCheckpointSchema = z.object({
  version: z.literal(1),
  queue: z.array(queueEntrySchema).max(20_000),
  seen: z.array(z.string().url()).max(10_000),
  pages: z.array(pageSchema).max(10_000),
});

export type AuditCrawlCheckpoint = z.infer<typeof auditCrawlCheckpointSchema>;
export type AuditQueueEntry = z.infer<typeof queueEntrySchema>;

export function newAuditCrawlCheckpoint(queue: AuditQueueEntry[] = []): AuditCrawlCheckpoint {
  return { version: 1, queue: dedupeQueue(queue, new Set()), seen: [], pages: [] };
}

export function parseAuditCrawlCheckpoint(value: unknown): AuditCrawlCheckpoint | undefined {
  const parsed = auditCrawlCheckpointSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function recordAuditCheckpointPage(checkpoint: AuditCrawlCheckpoint, input: {
  entry: AuditQueueEntry;
  page: AuditedPage;
  discovered: Array<{ url: string; inSitemap: boolean }>;
  redirectUrl?: string | null;
}): AuditCrawlCheckpoint {
  const seen = new Set(checkpoint.seen);
  seen.add(input.entry.url);
  const childDepth = input.entry.depth === null ? null : input.entry.depth + 1;
  const additions = input.discovered.map((item) => ({ url: item.url, depth: childDepth, inSitemap: item.inSitemap }));
  if (input.redirectUrl) additions.push({ url: input.redirectUrl, depth: input.entry.depth, inSitemap: false });
  const pages = checkpoint.pages.filter((page) => page.url !== input.page.url);
  pages.push(input.page);
  return {
    version: 1,
    queue: dedupeQueue([...checkpoint.queue, ...additions], seen),
    seen: [...seen],
    pages,
  };
}

function dedupeQueue(queue: AuditQueueEntry[], seen: Set<string>) {
  const queued = new Set<string>();
  return queue.filter((entry) => !seen.has(entry.url) && !queued.has(entry.url) && (queued.add(entry.url), true));
}
