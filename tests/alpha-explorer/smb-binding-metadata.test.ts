import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  alphaExplorerSmbBinding: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: dbMock }));

import { reconcileSmbBindingMetadata } from "@/lib/alpha-explorer/smb/binding-metadata";

const now = new Date("2026-09-16T15:00:00.000Z");

beforeEach(() => vi.clearAllMocks());

describe("Alpha Explorer SMB binding metadata", () => {
  it("upserts only non-secret metadata after the gateway confirms a binding", async () => {
    await reconcileSmbBindingMetadata({
      targetUserId: 42,
      actorUserId: 1,
      now,
      status: {
        linked: true,
        principal: "maria",
        principalKey: "a".repeat(64),
        secretRef: "b".repeat(64),
        credentialVersion: 2,
      },
    });

    expect(dbMock.alphaExplorerSmbBinding.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 42 },
      create: expect.objectContaining({
        qnapPrincipal: "maria",
        secretRef: "b".repeat(64),
        credentialVersion: 2,
        createdById: 1,
      }),
      update: expect.objectContaining({ status: "ACTIVE", revokedAt: null, updatedById: 1 }),
    }));
    expect(JSON.stringify(dbMock.alphaExplorerSmbBinding.upsert.mock.calls)).not.toContain("password");
  });

  it("marks existing metadata as revoked when Vault no longer has a binding", async () => {
    await reconcileSmbBindingMetadata({
      targetUserId: 42,
      actorUserId: 1,
      now,
      status: { linked: false, principal: null, principalKey: null, secretRef: null, credentialVersion: 0 },
    });

    expect(dbMock.alphaExplorerSmbBinding.updateMany).toHaveBeenCalledWith({
      where: { userId: 42, status: { not: "REVOKED" } },
      data: { status: "REVOKED", revokedAt: now, updatedById: 1 },
    });
    expect(dbMock.alphaExplorerSmbBinding.upsert).not.toHaveBeenCalled();
  });

  it("fails closed when linked metadata is incomplete", async () => {
    await expect(reconcileSmbBindingMetadata({
      targetUserId: 42,
      actorUserId: 1,
      now,
      status: { linked: true, principal: "maria", principalKey: null, secretRef: null, credentialVersion: 0 },
    })).rejects.toThrow("SMB_BINDING_METADATA_INCOMPLETE");
    expect(dbMock.alphaExplorerSmbBinding.upsert).not.toHaveBeenCalled();
  });
});
