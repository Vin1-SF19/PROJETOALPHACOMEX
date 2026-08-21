import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cacheFind: vi.fn(),
  runFind: vi.fn(),
  approvalFind: vi.fn(),
  acquireMutex: vi.fn(),
  releaseMutex: vi.fn(),
  providerLive: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  default: {
    alphaSeoProviderCache: { findUnique: mocks.cacheFind },
    alphaSeoExternalOperationRun: { findUnique: mocks.runFind },
    alphaSeoCostApproval: { findUnique: mocks.approvalFind },
  },
}));
vi.mock("@/lib/alpha-seo/jobs/mutex", () => ({
  acquireAlphaSeoMutex: mocks.acquireMutex,
  releaseAlphaSeoMutex: mocks.releaseMutex,
}));
vi.mock("@/lib/alpha-seo/dataforseo/client", () => ({
  createAlphaSeoDataForSeoClient: () => ({ live: mocks.providerLive }),
}));

import { executeAlphaSeoDataForSeo } from "@/lib/alpha-seo/dataforseo/operations";

describe("Alpha SEO paid operation runtime governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cacheFind.mockResolvedValue(null);
    mocks.runFind.mockResolvedValue(null);
  });

  it("blocks an above-threshold request before lock or provider without approval", async () => {
    mocks.approvalFind.mockResolvedValue(null);

    await expect(
      executeAlphaSeoDataForSeo({
        access: { projectId: "project-a", userId: 7 },
        operation: "SAVED_KEYWORD_METRICS",
        path: "keywords_data/google_ads/search_volume/live",
        payload: { keywords: Array.from({ length: 201 }, (_, index) => `k-${index}`) },
        units: 201,
        parse: () => [],
      }),
    ).rejects.toMatchObject({ name: "AlphaSeoCostApprovalRequired" });

    expect(mocks.approvalFind).toHaveBeenCalledWith({
      where: {
        projectId_userId_operation_requestHash: {
          projectId: "project-a",
          userId: 7,
          operation: "SAVED_KEYWORD_METRICS",
          requestHash: expect.any(String),
        },
      },
      select: {
        expiresAt: true,
        estimatedUnits: true,
        estimatedMicrosUsd: true,
      },
    });
    expect(mocks.acquireMutex).not.toHaveBeenCalled();
    expect(mocks.providerLive).not.toHaveBeenCalled();
  });

  it("returns a completed idempotent run without a second provider call", async () => {
    mocks.runFind.mockResolvedValue({
      id: "run-existing",
      status: "COMPLETED",
      result: { rows: ["cached"] },
      actualMicrosUsd: 42_000,
    });

    await expect(
      executeAlphaSeoDataForSeo({
        access: { projectId: "project-a", userId: 7 },
        operation: "DOMAIN_OVERVIEW",
        path: "dataforseo_labs/google/domain_rank_overview/live",
        payload: { target: "example.com" },
        parse: () => ({ rows: [] }),
      }),
    ).resolves.toEqual({
      data: { rows: ["cached"] },
      cached: true,
      runId: "run-existing",
      costUsd: 0.042,
    });

    expect(mocks.approvalFind).not.toHaveBeenCalled();
    expect(mocks.acquireMutex).not.toHaveBeenCalled();
    expect(mocks.providerLive).not.toHaveBeenCalled();
  });
});
