import { expect, it } from "vitest";
import { BPM_ANEXO_MAX_BYTES, nomeSeguroUploadAnexo, obterTipoUploadAnexo, validarUploadAnexo } from "@/lib/validations/bpm";

it("aceita até 90 MiB e rejeita o primeiro byte excedente sem alocar arquivo grande", () => {
  expect(BPM_ANEXO_MAX_BYTES).toBe(90 * 1024 * 1024);
  expect(validarUploadAnexo({ name: "contrato.pdf", type: "application/pdf", size: BPM_ANEXO_MAX_BYTES })).toBeNull();
  expect(validarUploadAnexo({ name: "contrato.pdf", type: "application/pdf", size: BPM_ANEXO_MAX_BYTES + 1 })).toContain("90 MiB");
});

it.each([
  ["contrato.pdf", "application/pdf"], ["imagem.png", "image/png"],
  ["imagem.jpg", "image/jpeg"], ["imagem.jpeg", "image/jpeg"],
  ["minuta.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
])("aceita %s com MIME compatível e infere quando ausente", (name, type) => {
  expect(validarUploadAnexo({ name, type, size: 1024 })).toBeNull();
  expect(obterTipoUploadAnexo({ name, type: "" })).toBe(type);
  expect(validarUploadAnexo({ name, type: "", size: 1024 })).toBeNull();
});

it("rejeita extensão desconhecida e MIME divergente", () => {
  expect(validarUploadAnexo({ name: "script.exe", type: "application/octet-stream", size: 100 })).toContain("não permitido");
  expect(validarUploadAnexo({ name: "imagem.jpg", type: "application/pdf", size: 100 })).toContain("não permitido");
});

it("mantém a extensão de nomes longos dentro do limite do caminho direto", () => {
  const nome = `${"a".repeat(250)}.pdf`;
  expect(nomeSeguroUploadAnexo(nome)).toHaveLength(200);
  expect(nomeSeguroUploadAnexo(nome).endsWith(".pdf")).toBe(true);
});
