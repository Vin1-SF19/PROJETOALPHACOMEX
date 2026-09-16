import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, findMany, readEffectiveModulePermissions } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  readEffectiveModulePermissions: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: { usuarios: { findUnique }, alphaExplorerAcl: { findMany } },
}));
vi.mock("@/lib/permissions/effective", () => ({ readEffectiveModulePermissions }));

import { resolveExplorerAuthorization } from "@/lib/alpha-explorer/authorization";
import { evaluateExplorerCapability } from "@/lib/alpha-explorer/capabilities";

describe("Alpha Explorer authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
    readEffectiveModulePermissions.mockResolvedValue(["exploradorArquivos"]);
  });

  it("nega usuário ausente ou inativo", async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ role: "User", cargo: null, status: "INATIVO" });
    await expect(resolveExplorerAuthorization(123)).resolves.toMatchObject({ active: false, moduleAllowed: false });
    await expect(resolveExplorerAuthorization(124)).resolves.toMatchObject({ active: false, moduleAllowed: false });
  });

  it("admin recebe capacidades globais", async () => {
    findUnique.mockResolvedValue({ role: "Admin", cargo: null, status: "ATIVO" });
    readEffectiveModulePermissions.mockResolvedValue([]);
    const authorization = await resolveExplorerAuthorization(1);
    expect(evaluateExplorerCapability(authorization.grants, "financeiro/2026", "manage_permissions").allowed).toBe(true);
  });

  it("usuário comum recebe ownership e ACLs válidas, ignorando ACL corrompida", async () => {
    findUnique.mockResolvedValue({ role: "FINANCEIRO", cargo: "ANALISTA", status: "ATIVO" });
    findMany.mockResolvedValue([
      { id: "acl-1", subjectType: "ROLE", prefix: "financeiro", capabilitiesJson: '["list","read"]' },
      { id: "acl-bad", subjectType: "ROLE", prefix: "rh", capabilitiesJson: "not-json" },
    ]);
    const authorization = await resolveExplorerAuthorization(123);
    expect(evaluateExplorerCapability(authorization.grants, "usuarios/123/docs", "upload").allowed).toBe(true);
    expect(evaluateExplorerCapability(authorization.grants, "financeiro/notas", "read").allowed).toBe(true);
    expect(evaluateExplorerCapability(authorization.grants, "rh/folha", "read").allowed).toBe(false);
    expect(evaluateExplorerCapability(authorization.grants, "usuarios/124", "read").allowed).toBe(false);
  });

  it("nega módulo quando permissão efetiva está ausente", async () => {
    findUnique.mockResolvedValue({ role: "User", cargo: null, status: "ATIVO" });
    readEffectiveModulePermissions.mockResolvedValue([]);
    await expect(resolveExplorerAuthorization(123)).resolves.toMatchObject({ active: true, moduleAllowed: false, grants: [] });
  });
});
