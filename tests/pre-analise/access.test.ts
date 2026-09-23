import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), permissions: vi.fn(), limit: vi.fn() }));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/permissions/effective", () => ({ readEffectiveModulePermissions: mocks.permissions }));
vi.mock("@/lib/auth/rate-limit", () => ({ consumeAuthRateLimit: mocks.limit }));

import { requirePreAnaliseAccess } from "@/lib/pre-analise/access";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: `user-${Math.random()}`, role: "COMERCIAL" } });
  mocks.permissions.mockResolvedValue(["analise"]);
  mocks.limit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
});

describe("controle de acesso das consultas", () => {
  it("nega sessão ausente", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await requirePreAnaliseAccess("tributario"))?.status).toBe(401);
    expect(mocks.permissions).not.toHaveBeenCalled();
  });

  it("nega sessão marcada como bloqueada", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "999", role: "ADMIN" }, acessoBloqueado: true });
    expect((await requirePreAnaliseAccess("tributario"))?.status).toBe(401);
  });

  it("nega escopo tributário sem permissão", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "958234", role: "COMERCIAL" } });
    mocks.permissions.mockResolvedValue([]);
    expect((await requirePreAnaliseAccess("tributario"))?.status).toBe(403);
  });

  it("nega role TV inclusive no escopo cadastral", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "958235", role: "TV" } });
    expect((await requirePreAnaliseAccess("cadastro"))?.status).toBe(403);
  });

  it("limita frequência no escopo tributário", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "958236", role: "ADMIN" } });
    mocks.limit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 42 });
    const denied = await requirePreAnaliseAccess("tributario");
    expect(denied?.status).toBe(429);
    expect(denied?.headers.get("Retry-After")).toBe("42");
    expect(mocks.limit).toHaveBeenCalledWith("pre_analise_tributario", "958236");
  });

  it("falha fechado quando o contador compartilhado fica indisponível", async () => {
    mocks.limit.mockRejectedValueOnce(new Error("database unavailable"));
    expect((await requirePreAnaliseAccess("cadastro"))?.status).toBe(503);
  });
});
