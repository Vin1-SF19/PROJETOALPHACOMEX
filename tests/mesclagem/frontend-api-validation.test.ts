import { afterEach, describe, expect, it, vi } from "vitest";
import { inspecionarArquivo, prepararPrevia, sugerirMapeamento } from "@/app/PainelAlpha/Mesclagem/api-mesclagem";

function responder(data: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  })));
}

describe("Cliente da Mesclagem — validação runtime", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejeita inspeção com shape incompleto", async () => {
    responder({ success: true, data: { nomeArquivo: "dados.xlsx" } });
    await expect(inspecionarArquivo(new File(["x"], "dados.xlsx"))).rejects.toThrow("resposta inesperada");
  });

  it("rejeita sugestão com campos extras ou observabilidade inválida", async () => {
    responder({ success: true, data: { mapeamento: [], ia: { status: "inventado" }, extra: true } });
    await expect(sugerirMapeamento({ colunasPrincipal: [], colunasComplementar: [] })).rejects.toThrow("resposta inesperada");
  });

  it("rejeita prévia sem resultado e mapeamento validados", async () => {
    responder({ success: true, data: { principal: {}, complementar: {}, resultado: null } });
    const arquivo = new File(["x"], "dados.xlsx");
    await expect(prepararPrevia({ principal: arquivo, complementar: arquivo })).rejects.toThrow("resposta inesperada");
  });
});
