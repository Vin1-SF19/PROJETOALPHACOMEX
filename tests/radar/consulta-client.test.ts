import { afterEach, describe, expect, it, vi } from "vitest";
import { consultarRadar } from "@/lib/radar/consulta";

describe("cliente RADAR CSV do servidor", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("consulta a rota CSV do ialpha com a raiz e mantém o token server-side", async () => {
    vi.stubEnv("CONSULTA_RADAR_TOKEN", "token-de-teste");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      cnpj: "33000167",
      data: {
        found: true,
        cnpj: "33000167000101",
        cnpjBase: "33000167",
        razaoSocial: "EMPRESA TESTE LTDA",
        modalidade: "ILIMITADA",
        situacao: "HABILITADA",
        dataAtualizacaoPublicada: "08/10/2026 16h13",
        consultadoEm: "2026-10-22T12:00:00.000Z",
      },
      raw: "",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await consultarRadar("33.000.167/0001-01");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://consulta-radar.alpha-comex.com/consultar/33000167?fonte=csv");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer token-de-teste");
    expect(result).toMatchObject({
      cnpj: "33000167",
      razaoSocial: "EMPRESA TESTE LTDA",
      modalidade: "ILIMITADA",
      dataAtualizacaoPublicada: "08/10/2026 16h13",
    });
  });
});
