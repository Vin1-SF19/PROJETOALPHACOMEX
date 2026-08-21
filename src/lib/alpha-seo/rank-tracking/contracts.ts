import { createHash } from "node:crypto";
import { z } from "zod";

export const rankDevicesSchema = z.enum(["DESKTOP", "MOBILE", "BOTH"]);
export const rankScheduleSchema = z.enum(["MANUAL", "DAILY", "WEEKLY", "MONTHLY"]);
export const rankDeviceSchema = z.enum(["DESKTOP", "MOBILE"]);

const domainSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .transform(normalizeRankDomain)
  .refine((value) => /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value), "Dominio invalido");

export const createRankConfigSchema = z.object({
  projectId: z.string().min(1).max(100),
  domain: domainSchema,
  locationCode: z.number().int().positive().default(2840),
  locationName: z.string().trim().min(1).max(200).nullable().optional(),
  languageCode: z.string().trim().min(2).max(10).default("pt"),
  devices: rankDevicesSchema.default("BOTH"),
  serpDepth: z.number().int().min(10).max(100).multipleOf(10),
  scheduleInterval: rankScheduleSchema.default("WEEKLY"),
});

export const updateRankConfigSchema = createRankConfigSchema.partial().extend({
  projectId: z.string().min(1).max(100),
  configId: z.string().min(1).max(100),
  isActive: z.boolean().optional(),
});

export const configIdSchema = z.object({
  projectId: z.string().min(1).max(100),
  configId: z.string().min(1).max(100),
});

export const rankResultsSchema = configIdSchema.extend({ comparePeriod: z.enum(["1d", "7d", "30d", "90d"]).default("7d") });

export const addRankKeywordsSchema = configIdSchema.extend({
  keywords: z.array(z.string().trim().min(1).max(200)).min(1).max(2_000),
});

export const removeRankKeywordsSchema = configIdSchema.extend({
  keywordIds: z.array(z.string().min(1).max(100)).min(1).max(2_000),
});

export const triggerRankRunSchema = configIdSchema.extend({
  keywordIds: z.array(z.string().min(1).max(100)).min(1).max(2_000).optional(),
  approvalRequestHash: z.string().length(64).optional(),
});

export const approveRankCostSchema = configIdSchema.extend({
  keywordIds: z.array(z.string().min(1).max(100)).min(1).max(2_000).optional(),
  requestHash: z.string().length(64),
});

export const rankHistorySchema = configIdSchema.extend({
  trackingKeywordId: z.string().min(1).max(100),
  device: rankDeviceSchema.optional(),
  sinceDays: z.number().int().min(1).max(730).default(365),
  limit: z.number().int().min(1).max(1_000).default(500),
});

export const rankTrendSchema = configIdSchema.extend({
  device: rankDeviceSchema.default("DESKTOP"),
  sinceDays: z.number().int().min(1).max(730).default(365),
  runLimit: z.number().int().min(1).max(52).default(12),
});

export const rankSuggestionsSchema = configIdSchema.extend({
  seed: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(200).default(50),
});

export type RankDevices = z.infer<typeof rankDevicesSchema>;
export type RankSchedule = z.infer<typeof rankScheduleSchema>;

export function rankRunRetryError(
  checkedKeywords: number,
  partialError: string | null,
): string | null {
  return checkedKeywords === 0
    ? partialError || "RANK_PROVIDER_RETURNED_NO_RESULTS"
    : null;
}
export type RankDevice = z.infer<typeof rankDeviceSchema>;

export function normalizeRankDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/^www\./, "").replace(/\.+$/, "");
}

export function normalizeRankKeyword(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function rankDevicesList(devices: RankDevices): RankDevice[] {
  return devices === "BOTH" ? ["DESKTOP", "MOBILE"] : [devices];
}

export function estimateRankCost(input: { keywordCount: number; devices: RankDevices; serpDepth: number; queued?: boolean }) {
  const units = input.keywordCount * rankDevicesList(input.devices).length;
  const pages = input.serpDepth / 10;
  const base = input.queued ? 600 : 2_000;
  const extra = input.queued ? 450 : 1_500;
  const rawMicrosUsd = units * (base + Math.max(0, pages - 1) * extra);
  return { estimatedUnits: units, estimatedMicrosUsd: Math.ceil(rawMicrosUsd * 1.2) };
}

export function rankRequestHash(input: Record<string, unknown>): string {
  const stable = Object.entries(input).sort(([a], [b]) => a.localeCompare(b));
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function computeNextRankCheckAt(schedule: Exclude<RankSchedule, "MANUAL">, anchor?: Date | null, now = new Date()): Date {
  if (!anchor) {
    const next = new Date(now);
    next.setUTCHours(4 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 60), 0, 0);
    if (schedule === "DAILY") next.setUTCDate(next.getUTCDate() + 1);
    if (schedule === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
    if (schedule === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + 1, 0);
    return next;
  }
  if (schedule === "MONTHLY") {
    let offset = 2;
    let next = monthEndFrom(anchor, offset);
    while (next <= now) next = monthEndFrom(anchor, ++offset);
    return next;
  }
  const intervalMs = (schedule === "DAILY" ? 1 : 7) * 86_400_000;
  const steps = Math.floor(Math.max(0, now.getTime() - anchor.getTime()) / intervalMs) + 1;
  return new Date(anchor.getTime() + steps * intervalMs);
}

function monthEndFrom(anchor: Date, monthOffset: number): Date {
  const result = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + monthOffset, 0));
  result.setUTCHours(anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds(), anchor.getUTCMilliseconds());
  return result;
}
