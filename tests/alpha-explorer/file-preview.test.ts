import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canPreviewInline,
  createPreviewObjectUrl,
  isOfficeTemporaryFile,
  MAX_INLINE_PREVIEW_BYTES,
  nativeOfficeApplication,
  previewMimeType,
} from "@/lib/alpha-explorer/file-preview";

afterEach(() => vi.restoreAllMocks());

describe("Alpha Explorer safe file preview", () => {
  it("opens common passive formats with an explicit safe content type", () => {
    expect(previewMimeType("relatorio.PDF")).toBe("application/pdf");
    expect(previewMimeType("foto.jpg")).toBe("image/jpeg");
    expect(previewMimeType("foto.jpeg")).toBe("image/jpeg");
    expect(previewMimeType("captura.png")).toBe("image/png");
    expect(previewMimeType("dados.csv")).toBe("text/csv;charset=utf-8");
    expect(previewMimeType("reuniao.mp4")).toBe("video/mp4");
  });

  it("never previews active or unknown browser content", () => {
    expect(previewMimeType("ata.html")).toBeNull();
    expect(previewMimeType("desenho.svg")).toBeNull();
    expect(previewMimeType("planilha.xlsx")).toBeNull();
    expect(previewMimeType("sem-extensao")).toBeNull();
  });

  it("routes only modern Word and Excel documents to their native applications", () => {
    expect(nativeOfficeApplication("Contrato.DOCX")).toBe("word");
    expect(nativeOfficeApplication("Custos.XLSX")).toBe("excel");
    expect(nativeOfficeApplication("legado.doc")).toBeNull();
    expect(nativeOfficeApplication("macro.xlsm")).toBeNull();
    expect(nativeOfficeApplication("pagina.html")).toBeNull();
    expect(nativeOfficeApplication("~$Custos.xlsx")).toBeNull();
    expect(isOfficeTemporaryFile("~$Custos.xlsx")).toBe(true);
    expect(isOfficeTemporaryFile("Custos.xlsx")).toBe(false);
  });

  it("limits in-memory preview size", () => {
    expect(canPreviewInline("relatorio.pdf", MAX_INLINE_PREVIEW_BYTES)).toBe(true);
    expect(canPreviewInline("relatorio.pdf", MAX_INLINE_PREVIEW_BYTES + 1)).toBe(false);
    expect(canPreviewInline("relatorio.pdf", null)).toBe(false);
  });

  it("overrides an untrusted response MIME before creating the modal URL", async () => {
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview-safe");
    const response = new Response("<script>ignored as markup</script>", {
      headers: { "Content-Type": "text/html" },
    });

    await expect(createPreviewObjectUrl(response, "imagem.jpg")).resolves.toBe("blob:preview-safe");
    const previewBlob = createObjectUrl.mock.calls[0]?.[0];
    expect(previewBlob).toBeInstanceOf(Blob);
    if (!(previewBlob instanceof Blob)) throw new Error("Expected a Blob preview");
    expect(previewBlob.type).toBe("image/jpeg");
  });
});
