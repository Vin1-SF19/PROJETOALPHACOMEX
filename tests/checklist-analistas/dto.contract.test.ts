import { it, expect } from "vitest";
import { documentoDTO } from "@/lib/checklist/dto";
it("DTO documental canônico sem segredo tem mesmo contrato do Portal", () => {
  const input = {
    id: "doc",
    nome: "synthetic.pdf",
    uploadedByCliente: true,
    observacao: null,
    criadoEm: new Date(0),
    deletadoEm: null,
    deletadoPorCliente: false,
    uploadedByUsuarioId: null,
    uploadedByContaId: "conta",
    deletadoPorUsuarioId: null,
    deletadoPorContaId: null,
    storageKey: "NEVER_EXPOSE",
    senhaHash: "NEVER_EXPOSE",
  };
  const dto = JSON.parse(JSON.stringify(documentoDTO(input)));
  expect(dto).toEqual({
    id: "doc",
    nome: "synthetic.pdf",
    uploadedByCliente: true,
    observacao: null,
    criadoEm: "1970-01-01T00:00:00.000Z",
    deletadoEm: null,
    deletadoPorCliente: false,
    uploadedByUsuarioId: null,
    uploadedByContaId: "conta",
    deletadoPorUsuarioId: null,
    deletadoPorContaId: null,
    url: "/api/checklist/documentos/doc/download",
  });
  expect(JSON.stringify(dto)).not.toContain("NEVER_EXPOSE");
});
