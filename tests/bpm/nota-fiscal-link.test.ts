import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { verificarLinkNotaFiscalAcessivel } from "@/lib/bpm/nota-fiscal-link";

describe("verificação de link externo da NF", () => {
  it("rejeita protocolos e destinos privados antes de abrir conexão", async () => {
    await expect(verificarLinkNotaFiscalAcessivel("http://exemplo.com/nf.pdf")).rejects.toThrow(/HTTPS/);
    await expect(verificarLinkNotaFiscalAcessivel("https://localhost/nf.pdf")).rejects.toThrow(/privado/);
    await expect(verificarLinkNotaFiscalAcessivel("https://127.0.0.1/nf.pdf")).rejects.toThrow(/público/);
    await expect(verificarLinkNotaFiscalAcessivel("https://192.168.1.1/nf.pdf")).rejects.toThrow(/público/);
  });
});
