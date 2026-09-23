import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getReceitaData } from "@/lib/cnpj/receita-federal";

const CNPJ = "33000167000101";

function resposta(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const receitaWs = { status: "OK", cnpj: CNPJ, nome: "Banco do Brasil", abertura: "12/10/1808" };
const cnpjWs = {
  razao_social: "Banco do Brasil",
  estabelecimento: { cnpj: CNPJ, data_inicio_atividade: "1808-10-12" },
};

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("normalização e fallback de ReceitaFederal", () => {
  it("preserva Simples e MEI desconhecidos da ReceitaWS sem chamar outra fonte", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resposta(receitaWs));
    vi.stubGlobal("fetch", fetchMock);
    const data = await getReceitaData(CNPJ);
    expect(data).toMatchObject({ fonteCadastro: "receitaws", optante_simples: null, optante_simei: null, regimeTributario: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aceita negação explícita sem confundi-la com ausência", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta({
      ...receitaWs, simples: { optante: "Não" }, simei: { optante: false },
    })));
    const data = await getReceitaData(CNPJ);
    expect(data).toMatchObject({ optante_simples: false, optante_simei: false, regimeTributario: "Regime Normal" });
  });

  it("usa CNPJ.ws quando ReceitaWS responde HTTP não 2xx", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(resposta({}, 503))
      .mockResolvedValueOnce(resposta(cnpjWs));
    vi.stubGlobal("fetch", fetchMock);
    const data = await getReceitaData(CNPJ);
    expect(data).toMatchObject({ fonteCadastro: "cnpj.ws", optante_simples: null, optante_simei: null, regimeTributario: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("publica.cnpj.ws");
  });

  it("usa CNPJ.ws quando ReceitaWS devolve CNPJ divergente", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(resposta({ ...receitaWs, cnpj: "11111111111111" }))
      .mockResolvedValueOnce(resposta({ ...cnpjWs, simples: { simples: "Sim", mei: "Não" } }));
    vi.stubGlobal("fetch", fetchMock);
    const data = await getReceitaData(CNPJ);
    expect(data).toMatchObject({ fonteCadastro: "cnpj.ws", optante_simples: true, optante_simei: false, regimeTributario: "Simples Nacional" });
  });

  it("falha quando ambas as fontes retornam dados sem cadastro utilizável", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta({})));
    await expect(getReceitaData(CNPJ)).rejects.toThrow();
  });
});
