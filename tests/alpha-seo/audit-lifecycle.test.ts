import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    alphaSeoSiteAudit: {
      updateMany: mocks.updateMany,
      deleteMany: mocks.deleteMany,
      findFirst: mocks.findFirst,
    },
  },
}));

import { removeSiteAudit } from "@/lib/alpha-seo/audit/service";
import { auditMutationSchema } from "@/lib/alpha-seo/audit/contracts";

describe("Alpha SEO audit lifecycle mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exige intenção CANCEL ou DELETE no contrato de entrada", () => {
    expect(
      auditMutationSchema.safeParse({ projectId: "project-1", auditId: "audit-1" })
        .success,
    ).toBe(false);
    expect(
      auditMutationSchema.parse({
        projectId: "project-1",
        auditId: "audit-1",
        mode: "CANCEL",
      }),
    ).toEqual({ projectId: "project-1", auditId: "audit-1", mode: "CANCEL" });
  });

  it("CANCEL nunca exclui uma auditoria que já ficou terminal", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    mocks.findFirst.mockResolvedValue({ id: "audit-1" });

    await expect(
      removeSiteAudit("project-1", "audit-1", "CANCEL"),
    ).rejects.toThrow("AUDIT_CANCEL_STATE_CONFLICT");

    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "audit-1",
          projectId: "project-1",
          status: { in: ["PENDING", "RUNNING"] },
        },
      }),
    );
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("DELETE nunca cancela uma auditoria que ainda está ativa", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    mocks.findFirst.mockResolvedValue({ id: "audit-1" });

    await expect(
      removeSiteAudit("project-1", "audit-1", "DELETE"),
    ).rejects.toThrow("AUDIT_DELETE_STATE_CONFLICT");

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "audit-1",
        projectId: "project-1",
        status: { in: ["COMPLETED", "FAILED", "CANCELLED"] },
      },
    });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("mantém projectId no predicado atômico e distingue alvo inexistente", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      removeSiteAudit("project-1", "audit-other-project", "CANCEL"),
    ).rejects.toThrow("AUDIT_NOT_FOUND");

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "audit-other-project", projectId: "project-1" },
      select: { id: true },
    });
  });
});
