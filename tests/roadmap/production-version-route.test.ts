import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/version/route";

afterEach(() => vi.unstubAllEnvs());

describe("versão implantada para reconciliação do roadmap", () => {
  it("expõe o SHA da implantação de produção sem cache", async () => {
    const sha = "a".repeat(40);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", sha);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok", deployedCommitSha: sha });
  });

  it("não afirma uma versão de produção sem dados confiáveis", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "a".repeat(40));
    expect((await GET()).status).toBe(503);

    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "invalid");
    expect((await GET()).status).toBe(503);
  });
});
