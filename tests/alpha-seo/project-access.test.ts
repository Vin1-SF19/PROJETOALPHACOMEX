import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const authMock = vi.fn();
const findUserMock = vi.fn();
const findProjectMock = vi.fn();
const permissionsMock = vi.fn();

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ default: { usuarios: { findUnique: findUserMock }, alphaSeoProject: { findUnique: findProjectMock } } }));
vi.mock("@/actions/PermissoesSetor", () => ({ getPermissoesEfetivas: permissionsMock }));

describe("Alpha SEO project access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "10" } });
    findUserMock.mockResolvedValue({ id: 10, email: "user@example.com", role: "User", status: "ATIVO" });
    permissionsMock.mockResolvedValue(["alphaSeo"]);
  });
  it("blocks a client-supplied identity that differs from the session", async () => {
    const { requireAlphaSeoProjectAccess } = await import("@/lib/alpha-seo/project-access");
    await expect(requireAlphaSeoProjectAccess({ projectId: "project-a", userId: 11 })).rejects.toMatchObject({ code: "PROJECT_ACCESS_DENIED" });
    expect(findProjectMock).not.toHaveBeenCalled();
  });
  it("blocks cross-project access without an active membership", async () => {
    findProjectMock.mockResolvedValue({ id: "project-b", ownerId: 99, status: "ACTIVE", members: [] });
    const { requireAlphaSeoProjectAccess } = await import("@/lib/alpha-seo/project-access");
    await expect(requireAlphaSeoProjectAccess({ projectId: "project-b", action: "seo:read" })).rejects.toMatchObject({ code: "PROJECT_ACCESS_DENIED" });
  });
  it("enforces minimum project role", async () => {
    findProjectMock.mockResolvedValue({ id: "project-a", ownerId: 99, status: "ACTIVE", members: [{ role: "VIEWER", active: true }] });
    const { requireAlphaSeoProjectAccess } = await import("@/lib/alpha-seo/project-access");
    await expect(requireAlphaSeoProjectAccess({ projectId: "project-a", minimumRole: "EDITOR" })).rejects.toMatchObject({ code: "PROJECT_ACCESS_DENIED" });
  });
  it("combina ownership e busca com AND na listagem de projetos", () => {
    const source = readFileSync("src/lib/alpha-seo/projects/service.ts", "utf8");
    expect(source).toMatch(/const ownership:[\s\S]*const search:[\s\S]*AND: \[ownership, search\]/);
  });
});
