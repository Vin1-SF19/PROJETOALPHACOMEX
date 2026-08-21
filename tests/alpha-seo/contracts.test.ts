import { describe, expect, it } from "vitest";
import {
  alphaSeoCliResultSchema,
  makeCliResult,
} from "@/lib/alpha-seo/contracts";
import {
  alphaSeoCacheKey,
  alphaSeoIdempotencyKey,
  alphaSeoLockKey,
  estimateOperationCost,
  requireCostApproval,
} from "@/lib/alpha-seo/operation-policy";
import {
  authorizeProjectAccess,
  canProjectRole,
  redactSecrets,
} from "@/lib/alpha-seo/security";

describe("Alpha SEO Wave 1 contracts", () => {
  it("assigns stable exit codes", () => {
    expect(makeCliResult({ command: "doctor", checks: [] }).code).toBe(0);
    expect(
      makeCliResult({
        command: "doctor",
        checks: [
          { id: "dep", ok: false, kind: "dependency", message: "offline" },
        ],
      }).code,
    ).toBe(1);
    expect(
      makeCliResult({
        command: "doctor",
        checks: [{ id: "cfg", ok: false, kind: "config", message: "missing" }],
      }).code,
    ).toBe(2);
    expect(
      alphaSeoCliResultSchema.safeParse(
        makeCliResult({ command: "inventory", checks: [] }),
      ).success,
    ).toBe(true);
  });

  it("enforces OWNER/EDITOR/VIEWER project scope", async () => {
    expect(canProjectRole("OWNER", "member:manage")).toBe(true);
    expect(canProjectRole("EDITOR", "seo:execute")).toBe(true);
    expect(canProjectRole("EDITOR", "project:archive")).toBe(false);
    expect(canProjectRole("VIEWER", "seo:read")).toBe(true);
    expect(canProjectRole("VIEWER", "seo:execute")).toBe(false);

    const allowed = await authorizeProjectAccess({
      repository: {
        findAccess: async (projectId, userId) => ({
          projectId,
          userId,
          role: "VIEWER",
          active: true,
        }),
      },
      projectId: "p-1",
      userId: "u-1",
      action: "seo:read",
    });
    expect(allowed.allowed).toBe(true);
  });

  it("redacts nested credentials and authorization URLs", () => {
    const value = redactSecrets({
      token: "real-token",
      nested: {
        authorization: "Bearer abc.def",
        url: "https://example.test/callback?code=abc&state=xyz",
        safe: "visible",
      },
    });
    const serialized = JSON.stringify(value);
    expect(serialized).not.toContain("real-token");
    expect(serialized).not.toContain("abc.def");
    expect(serialized).not.toContain("code=abc");
    expect(serialized).toContain("visible");
  });

  it("estimates cost and builds stable scoped keys", () => {
    const estimate = estimateOperationCost({
      operation: "rank",
      units: 2_001,
      creditsPerUnit: 1,
    });
    expect(estimate.approvalRequired).toBe(true);
    expect(requireCostApproval(estimate)).toEqual({
      approved: false,
      reason: "APPROVAL_REQUIRED",
    });
    expect(requireCostApproval(estimate, "approval-ref")).toEqual({
      approved: true,
    });

    const a = alphaSeoIdempotencyKey("p-1", "rank", { b: 2, a: 1 });
    const b = alphaSeoIdempotencyKey("p-1", "rank", { a: 1, b: 2 });
    expect(a).toBe(b);
    expect(alphaSeoCacheKey("p-1", "serp", { q: "alpha" })).toMatch(
      /^alpha-seo:cache:p-1:serp:/,
    );
    expect(alphaSeoLockKey("p-1", "rank")).toBe("alpha-seo:lock:p-1:rank");
  });
});
