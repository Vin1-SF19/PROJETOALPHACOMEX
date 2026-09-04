import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { converterParaHtml } from "@/lib/gerador-documentos/html";

// Mock do fetch global (Tika server)
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("converterParaHtml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retorna HTML estruturado quando o Tika responde com sucesso", async () => {
    const htmlEsperado = `<html><body><p>Contrato de prestação de serviços</p><table><tr><td>Item</td></tr></table></body></html>`;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlEsperado,
    });

    const buffer = Buffer.from("fake pdf content");
    const resultado = await converterParaHtml(buffer, "application/pdf", "contrato.pdf");

    expect(resultado).toBe(htmlEsperado);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Verifica que o header Accept foi text/html
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/tika");
    expect(options.headers.Accept).toBe("text/html");
    expect(options.method).toBe("PUT");
  });

  it("lança erro quando o Tika retorna status não-ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const buffer = Buffer.from("fake content");
    await expect(converterParaHtml(buffer, "application/pdf", "doc.pdf")).rejects.toThrow("Tika (HTML) retornou 500");
  });

  it("lança erro quando o Tika retorna conteúdo vazio", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "   ",
    });

    const buffer = Buffer.from("fake content");
    await expect(converterParaHtml(buffer, "text/plain", "vazio.txt")).rejects.toThrow("conteúdo vazio");
  });

  it("lança erro em caso de timeout (AbortError)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("The operation was aborted"));

    const buffer = Buffer.from("fake content");
    await expect(converterParaHtml(buffer, "application/pdf", "timeout.pdf")).rejects.toThrow();
  });

  it("envia o buffer correto no body da requisição", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "<p>ok</p>",
    });

    const conteudo = "conteúdo do documento";
    const buffer = Buffer.from(conteudo, "utf-8");
    await converterParaHtml(buffer, "text/plain", "doc.txt");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.body).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(options.body)).toBe(conteudo);
  });
});
