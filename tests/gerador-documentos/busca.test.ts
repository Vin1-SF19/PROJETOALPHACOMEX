import { describe, expect, it } from "vitest";
import { filtrarDocumentosPorBusca } from "@/lib/gerador-documentos/busca";

const documentos = [
  { titulo: "Contrato de Prestação de Serviços", cliente: { razaoSocial: "Alpha Comex LTDA", nomeFantasia: "Alpha" } },
  { titulo: "Termo de Confidencialidade", cliente: { razaoSocial: "Beta Importadora", nomeFantasia: null } },
  { titulo: "Contrato Genérico", cliente: null },
];

describe("filtrarDocumentosPorBusca", () => {
  it("retorna todos os documentos quando a busca está vazia", () => {
    expect(filtrarDocumentosPorBusca(documentos, "")).toEqual(documentos);
    expect(filtrarDocumentosPorBusca(documentos, "   ")).toEqual(documentos);
  });

  it("filtra por título (case-insensitive)", () => {
    const resultado = filtrarDocumentosPorBusca(documentos, "confidencialidade");
    expect(resultado).toEqual([documentos[1]]);
  });

  it("filtra por nome do contratante (razão social)", () => {
    const resultado = filtrarDocumentosPorBusca(documentos, "beta");
    expect(resultado).toEqual([documentos[1]]);
  });

  it("filtra por nome fantasia do contratante", () => {
    const resultado = filtrarDocumentosPorBusca(documentos, "alpha");
    expect(resultado).toEqual([documentos[0]]);
  });

  it("não quebra quando o documento não tem cliente vinculado", () => {
    const resultado = filtrarDocumentosPorBusca(documentos, "genérico");
    expect(resultado).toEqual([documentos[2]]);
  });

  it("retorna vazio quando nada corresponde", () => {
    expect(filtrarDocumentosPorBusca(documentos, "inexistente")).toEqual([]);
  });
});
