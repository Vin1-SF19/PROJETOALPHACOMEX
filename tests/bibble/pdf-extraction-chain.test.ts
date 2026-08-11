import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getText: vi.fn(),
  destroy: vi.fn(),
  ocr: vi.fn(),
  isOcrConfigured: vi.fn(),
}));

vi.mock("@/lib/bibble/pdfjs-polyfill", () => ({
  pdfjsWorkerReady: Promise.resolve(),
}));

vi.mock("@/lib/bibble/pdf24-ocr", () => ({
  ocrViaPdf24: mocks.ocr,
  isPdf24Configured: mocks.isOcrConfigured,
}));

vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn(function PDFParseMock() {
    return { getText: mocks.getText, destroy: mocks.destroy };
  }),
}));

import { extractTextFromBuffer } from "@/lib/bibble/tika";

describe("Bibble PDF extraction chain", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    mocks.destroy.mockResolvedValue(undefined);
    mocks.isOcrConfigured.mockReturnValue(false);
  });

  it("uses Tika first without any external service", async () => {
    fetchMock.mockResolvedValue(new Response("texto extraído pelo Tika com tamanho útil"));

    await expect(extractTextFromBuffer(
      Buffer.from("pdf sintético"),
      "application/pdf",
      "SENTINELA_NOME_PRIVADO.pdf",
    )).resolves.toEqual({
      text: "texto extraído pelo Tika com tamanho útil",
      source: "tika",
    });
    expect(mocks.getText).not.toHaveBeenCalled();
  });

  it("falls back to pdf-parse when Tika fails", async () => {
    fetchMock.mockResolvedValue(new Response("indisponível", { status: 503 }));
    mocks.getText.mockResolvedValue({ text: "texto local extraído via pdf-parse com sucesso" });

    const result = await extractTextFromBuffer(
      Buffer.from("pdf sintético"),
      "application/pdf",
      "fixture.pdf",
    );

    expect(result.source).toBe("pdf-parse");
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it("uses configured PDF24 OCR only after Tika and pdf-parse have no useful text", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("indisponível", { status: 503 }))
      .mockResolvedValueOnce(new Response("texto útil extraído do resultado de OCR"));
    mocks.getText.mockResolvedValue({ text: "curto" });
    mocks.isOcrConfigured.mockReturnValue(true);
    mocks.ocr.mockResolvedValue(Buffer.from("pdf processado"));

    const result = await extractTextFromBuffer(
      Buffer.from("pdf sintético"),
      "application/pdf",
      "fixture.pdf",
    );

    expect(result.source).toBe("pdf24-ocr");
    expect(mocks.ocr).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not put PDF names or extracted contents in extraction logs", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    fetchMock.mockResolvedValue(new Response("SENTINELA_CONTEUDO_PRIVADO com texto útil"));

    await extractTextFromBuffer(
      Buffer.from("pdf sintético"),
      "application/pdf",
      "SENTINELA_NOME_PRIVADO.pdf",
    );

    const logs = JSON.stringify(info.mock.calls);
    expect(logs).not.toContain("SENTINELA_NOME_PRIVADO");
    expect(logs).not.toContain("SENTINELA_CONTEUDO_PRIVADO");
  });
});
