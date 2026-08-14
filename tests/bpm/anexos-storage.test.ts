import { afterEach, describe, expect, it } from "vitest";

import {
  criarReciboUploadAnexoBpm,
  criarReferenciaAnexoBpm,
  extrairPathnamePrivadoAnexoBpm,
  extrairUrlLegadaAnexoBpm,
  recibosAnexoBpmConfigurados,
  validarReciboUploadAnexoBpm,
} from "@/lib/bpm/anexos-storage";

const segredoAnterior = process.env.CRM_ANEXO_RECEIPT_SECRET;
const tokenBlobAnterior = process.env.CRM_READ_WRITE_TOKEN;

afterEach(() => {
  if (segredoAnterior === undefined) delete process.env.CRM_ANEXO_RECEIPT_SECRET;
  else process.env.CRM_ANEXO_RECEIPT_SECRET = segredoAnterior;
  if (tokenBlobAnterior === undefined) delete process.env.CRM_READ_WRITE_TOKEN;
  else process.env.CRM_READ_WRITE_TOKEN = tokenBlobAnterior;
});

describe("recibo de upload privado do BPM", () => {
  it("vincula o recibo assinado ao card e ao pathname privado", () => {
    process.env.CRM_ANEXO_RECEIPT_SECRET = "segredo-de-teste";
    const recibo = criarReciboUploadAnexoBpm({
      cardId: "clw0000000000000card",
      pathname: "bpm/clw0000000000000card/arquivo.pdf",
      nome: "arquivo.pdf",
      tipo: "application/pdf",
      tamanho: 42,
    });

    expect(validarReciboUploadAnexoBpm(recibo)).toMatchObject({
      cardId: "clw0000000000000card",
      pathname: "bpm/clw0000000000000card/arquivo.pdf",
    });
    expect(validarReciboUploadAnexoBpm(`${recibo}alterado`)).toBeNull();
    expect(criarReferenciaAnexoBpm("bpm/card/arquivo.pdf")).toBe("bpm-blob:bpm/card/arquivo.pdf");
    expect(extrairPathnamePrivadoAnexoBpm("bpm-blob:bpm/card/arquivo.pdf")).toBe("bpm/card/arquivo.pdf");
  });

  it("aceita somente URLs legadas HTTPS do Blob e sob o prefixo BPM", () => {
    expect(extrairUrlLegadaAnexoBpm("https://x.blob.vercel-storage.com/bpm/card/arquivo.pdf")).toBeTruthy();
    expect(extrairUrlLegadaAnexoBpm("https://example.com/bpm/card/arquivo.pdf")).toBeNull();
    expect(extrairUrlLegadaAnexoBpm("https://x.blob.vercel-storage.com/outra-pasta/arquivo.pdf")).toBeNull();
  });

  it("não usa o token de escrita do Blob como segredo de recibo", () => {
    delete process.env.CRM_ANEXO_RECEIPT_SECRET;
    process.env.CRM_READ_WRITE_TOKEN = "token-do-blob-não-é-segredo-de-recibo";

    expect(recibosAnexoBpmConfigurados()).toBe(false);
    expect(() => criarReciboUploadAnexoBpm({
      cardId: "clw0000000000000card",
      pathname: "bpm/clw0000000000000card/arquivo.pdf",
      nome: "arquivo.pdf",
      tipo: "application/pdf",
      tamanho: 42,
    })).toThrow("Armazenamento de anexos não configurado");
  });
});
