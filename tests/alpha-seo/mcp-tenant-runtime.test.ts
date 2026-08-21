import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ projectFind: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../../auth", () => ({ auth: vi.fn() }));
vi.mock("@/actions/PermissoesSetor", () => ({ getPermissoesEfetivas: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: { alphaSeoProject: { findUnique: mocks.projectFind } },
}));

import {
  authorizeMcpProject,
  MCP_READ_SCOPE,
  MCP_SCOPE,
  MCP_WRITE_SCOPE,
} from "@/lib/alpha-seo/mcp/auth";
import type { AlphaSeoMcpIdentity } from "@/lib/alpha-seo/mcp/types";

function identity(overrides: Partial<AlphaSeoMcpIdentity> = {}): AlphaSeoMcpIdentity {
  return {
    kind: "api_key",
    userId: 7,
    email: "owner@example.com",
    scopes: [MCP_SCOPE, MCP_READ_SCOPE, MCP_WRITE_SCOPE],
    fixedProjectId: "project-a",
    credentialId: "key-a",
    ...overrides,
  };
}

describe("Alpha SEO MCP tenant authorization runtime", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a cross-project credential before querying tenant data", async () => {
    await expect(
      authorizeMcpProject(identity(), "project-b"),
    ).rejects.toMatchObject({ status: 403, code: "PROJECT_SCOPE_MISMATCH" });
    expect(mocks.projectFind).not.toHaveBeenCalled();
  });

  it("requires write scope before an editor mutation", async () => {
    await expect(
      authorizeMcpProject(
        identity({ scopes: [MCP_SCOPE, MCP_READ_SCOPE] }),
        "project-a",
        "EDITOR",
      ),
    ).rejects.toMatchObject({ status: 403, code: "WRITE_SCOPE_REQUIRED" });
    expect(mocks.projectFind).not.toHaveBeenCalled();
  });

  it("rejects an active project when the credential owner has no membership", async () => {
    mocks.projectFind.mockResolvedValue({
      id: "project-a",
      ownerId: 99,
      name: "A",
      domain: "example.com",
      locationCode: null,
      locationName: null,
      languageCode: null,
      market: "BR",
      status: "ACTIVE",
      members: [],
    });

    await expect(
      authorizeMcpProject(identity(), "project-a"),
    ).rejects.toMatchObject({ status: 403, code: "PROJECT_ACCESS_DENIED" });
  });
});
