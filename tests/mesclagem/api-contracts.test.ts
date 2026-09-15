import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { criarMapeamentoInicial } from "@/lib/mesclagem/catalogo";

const mocks = vi.hoisted(() => ({
  acesso: vi.fn(),
  adquirirLimite: vi.fn(),
  auditoria: vi.fn(),
  obterArquivoHistorico: vi.fn(),
  registrarHistorico: vi.fn(),
  liberarLimite: vi.fn(),
}));

vi.mock("@/lib/mesclagem/autorizacao", () => ({
  MESCLAGEM_NO_STORE_HEADERS: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
  verificarAcessoMesclagem: mocks.acesso,
  registrarAuditoriaMesclagemBestEffort: mocks.auditoria,
}));
vi.mock("@/lib/mesclagem/rate-limit", () => ({
  obterIpMesclagem: vi.fn().mockReturnValue("127.0.0.1"),
  adquirirLimiteMesclagem: mocks.adquirirLimite,
}));
vi.mock("@/lib/mesclagem/historico", () => ({
  obterArquivoHistoricoMesclagem: mocks.obterArquivoHistorico,
  registrarHistoricoMesclagem: mocks.registrarHistorico,
}));

function requisicaoMultipart(url: string, formData: FormData): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body: formData,
    headers: {
      host: "localhost",
      origin: "http://localhost",
      "sec-fetch-site": "same-origin",
      "content-length": "2048",
    },
  });
}

describe("Contratos das APIs da Mesclagem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.acesso.mockResolvedValue({ autorizado: true, userId: 77 });
    mocks.adquirirLimite.mockReturnValue({ permitido: true, liberar: mocks.liberarLimite });
    mocks.obterArquivoHistorico.mockResolvedValue({
      nome: "resultado final.xlsx",
      tamanho: 4,
      conteudo: (async function* () { yield new Uint8Array([1, 2, 3, 4]); })(),
    });
    mocks.registrarHistorico.mockResolvedValue({ id: "historico-1" });
  });

  it("bloqueia acesso anônimo antes de ler payload em todas as rotas", async () => {
    mocks.acesso.mockResolvedValue({ autorizado: false, userId: null, status: 401, code: "UNAUTHORIZED" });
    const requisicaoVazia = () => new NextRequest("http://localhost/api/mesclagem/teste", { method: "POST" });
    const [inspecionar, sugerir, previa, exportar, template] = await Promise.all([
      import("@/app/api/mesclagem/inspecionar/route"),
      import("@/app/api/mesclagem/sugerir/route"),
      import("@/app/api/mesclagem/previa/route"),
      import("@/app/api/mesclagem/exportar/route"),
      import("@/app/api/mesclagem/template/route"),
    ]);

    const respostas = await Promise.all([
      inspecionar.POST(requisicaoVazia()),
      sugerir.POST(requisicaoVazia()),
      previa.POST(requisicaoVazia()),
      exportar.POST(requisicaoVazia()),
      template.GET(),
    ]);

    expect(respostas.map((resposta) => resposta.status)).toEqual([401, 401, 401, 401, 401]);
    for (const resposta of respostas) {
      expect(resposta.headers.get("cache-control")).toContain("no-store");
      await expect(resposta.json()).resolves.toMatchObject({ success: false, code: "UNAUTHORIZED" });
    }
    expect(mocks.adquirirLimite).not.toHaveBeenCalled();
    expect(mocks.auditoria).not.toHaveBeenCalled();
  });

  it("sugestão aceita somente metadados de cabeçalho e devolve no-store", async () => {
    const { POST } = await import("@/app/api/mesclagem/sugerir/route");
    const mapeamento = criarMapeamentoInicial().map((campo) => ({ ...campo, manual: true }));
    const body = JSON.stringify({
      colunasPrincipal: [{ numero: 1, nome: "CNPJ" }],
      colunasComplementar: [{ numero: 1, nome: "CNPJ" }],
      mapeamento,
    });
    const request = new NextRequest("http://localhost/api/mesclagem/sugerir", {
      method: "POST",
      body,
      headers: {
        host: "localhost", origin: "http://localhost", "sec-fetch-site": "same-origin",
        "content-type": "application/json", "content-length": String(Buffer.byteLength(body)),
      },
    });
    const response = await POST(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(json.data.mapeamento).toHaveLength(31);
    expect(json.data.ia.status).toBe("nao_necessario");
  });

  it("exportação POST stateless reprocessa ambos os arquivos e retorna XLSX completo", async () => {
    const { POST } = await import("@/app/api/mesclagem/exportar/route");
    const linhasPrincipal = Array.from({ length: 105 }, () => "12.345.678/0001-95;Recife").join("\n");
    const principal = new File([`CNPJ;Município\n${linhasPrincipal}`], "principal.csv", { type: "text/csv" });
    const complementar = new File(["CNPJ;Cidade\n12.345.678/0001-95;Olinda"], "complementar.csv", { type: "text/csv" });
    const mapeamento = criarMapeamentoInicial().map((campo) => campo.destino === "Município"
      ? { ...campo, origem: 2, origemNome: "Cidade", manual: true }
      : { ...campo, manual: true });
    const formData = new FormData();
    formData.set("principal", principal);
    formData.set("complementar", complementar);
    formData.set("mapeamento", JSON.stringify(mapeamento));
    const response = await POST(requisicaoMultipart("http://localhost/api/mesclagem/exportar", formData));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("spreadsheetml");
    expect(response.headers.get("x-mesclagem-historico-id")).toBe("historico-1");
    expect(mocks.registrarHistorico).toHaveBeenCalledWith(expect.objectContaining({ userId: 77 }));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    const aba = workbook.worksheets[0];
    const headers = aba.getRow(1).values as unknown[];
    expect(aba.getRow(2).getCell(headers.indexOf("Município")).value).toBe("Olinda");
    expect(headers).toContain("DDD5");
    expect(aba.rowCount).toBe(106);
  });

  it("exportação stateless rejeita mapeamento fora da allowlist", async () => {
    const { POST } = await import("@/app/api/mesclagem/exportar/route");
    const formData = new FormData();
    formData.set("principal", new File(["CNPJ\n12.345.678/0001-95"], "principal.csv"));
    formData.set("complementar", new File(["CNPJ\n12.345.678/0001-95"], "complementar.csv"));
    formData.set("mapeamento", JSON.stringify([{ destino: "COLUNA_ARBITRARIA", origem: 1 }]));
    const response = await POST(requisicaoMultipart("http://localhost/api/mesclagem/exportar", formData));
    const json = await response.json();
    expect(response.status).toBe(422);
    expect(json.code).toBe("INVALID_MAPPING");
  });

  it("desativa o GET legado de exportação com 405", async () => {
    const exportar = await import("@/app/api/mesclagem/exportar/route");
    expect((await exportar.GET()).status).toBe(405);
  });

  it("download do histórico exige acesso e entrega somente o arquivo autorizado", async () => {
    const { GET } = await import("@/app/api/mesclagem/historico/[id]/arquivo/[tipo]/route");
    const response = await GET(
      new NextRequest("http://localhost/api/mesclagem/historico/historico-1/arquivo/resultado"),
      { params: Promise.resolve({ id: "historico-1", tipo: "resultado" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("resultado%20final.xlsx");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.obterArquivoHistorico).toHaveBeenCalledWith(77, "historico-1", "resultado");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3, 4]);
  });

  it("download do histórico rejeita tipo inválido sem consultar o storage", async () => {
    const { GET } = await import("@/app/api/mesclagem/historico/[id]/arquivo/[tipo]/route");
    const response = await GET(
      new NextRequest("http://localhost/api/mesclagem/historico/historico-1/arquivo/outro"),
      { params: Promise.resolve({ id: "historico-1", tipo: "outro" }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.obterArquivoHistorico).not.toHaveBeenCalled();
  });

  it("rejeita propriedades extras no schema strict de mapeamento", async () => {
    const { POST } = await import("@/app/api/mesclagem/exportar/route");
    const formData = new FormData();
    formData.set("principal", new File(["CNPJ\n12.345.678/0001-95"], "principal.csv"));
    formData.set("complementar", new File(["CNPJ\n12.345.678/0001-95"], "complementar.csv"));
    formData.set("mapeamento", JSON.stringify([{ destino: "CNPJ", origem: 1, inesperado: true }]));
    const response = await POST(requisicaoMultipart("http://localhost/api/mesclagem/exportar", formData));
    expect(response.status).toBe(422);
  });
});
