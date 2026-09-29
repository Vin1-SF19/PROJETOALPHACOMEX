import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import JSZip from "jszip";
import { conteudoUploadCompativel } from "@/lib/bpm/upload-conteudo";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), acesso: vi.fn(), put: vi.fn(), del: vi.fn(), historico: vi.fn(), token: vi.fn() }));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: mocks.acesso }));
vi.mock("@vercel/blob", () => ({ put: mocks.put, del: mocks.del }));
vi.mock("@/lib/prisma", () => ({ default: { bpmCardHistorico: { create: mocks.historico } } }));
vi.mock("@/lib/bpm/anexos-storage", () => ({ recibosAnexoBpmConfigurados: () => true, obterTokenBlobPrivadoAnexoBpm: mocks.token, criarReciboUploadAnexoBpm: () => "recibo", criarReferenciaAnexoBpm: (pathname: string) => `bpm-blob:${pathname}` }));
import { POST } from "@/app/api/bpm/upload/route";
const cardId = "clw0000000000000card";
function request(file: File) {
  const form = new FormData(); form.set("file", file); form.set("cardId", cardId);
  return new NextRequest("http://localhost/api/bpm/upload", { method: "POST", body: form });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "7" } });
  mocks.acesso.mockResolvedValue({});
  mocks.put.mockResolvedValue({ pathname: "bpm/arquivo.pdf" });
  mocks.historico.mockResolvedValue({ id: "historico" });
  mocks.token.mockReturnValue("token-privado-teste");
});
it.each([
  ["texto em vez de File", "arquivo", "clw0000000000000card"],
  ["card inválido", new File(["%PDF-1.7"], "a.pdf", { type: "application/pdf" }), "invalido"],
  ["MIME falsificado", new File(["<script>"], "a.pdf", { type: "application/pdf" }), "clw0000000000000card"],
])("rejeita %s antes de enviar ao storage", async (_caso, file, cardId) => {
  const form = new FormData(); form.set("file", file); form.set("cardId", cardId);
  const response = await POST(new NextRequest("http://localhost/api/bpm/upload", { method: "POST", body: form }));
  expect(response.status).toBe(400); expect(mocks.put).not.toHaveBeenCalled();
});
it("aceita PDF compatível após autorização", async () => {
  const response = await POST(request(new File(["%PDF-1.7\n%%EOF"], "a.pdf", { type: "application/pdf" })));
  expect(response.status).toBe(200); expect(mocks.put).toHaveBeenCalledOnce();
  expect(mocks.put).toHaveBeenCalledWith(expect.stringContaining(`bpm/${cardId}/`), expect.any(Blob), {
    access: "private", token: "token-privado-teste",
  });
  expect(await response.json()).toMatchObject({ success: true, file: { recibo: "recibo" } });
});
it("exige sessão e acesso ao card antes de escrever no Blob", async () => {
  mocks.auth.mockResolvedValueOnce(null);
  expect((await POST(request(new File(["%PDF-1.7"], "a.pdf", { type: "application/pdf" })))).status).toBe(401);
  mocks.acesso.mockRejectedValueOnce(new Error("Sem acesso"));
  expect((await POST(request(new File(["%PDF-1.7"], "a.pdf", { type: "application/pdf" })))).status).toBe(403);
  expect(mocks.put).not.toHaveBeenCalled();
});
it("retorna erro de configuração quando o token privado está ausente, sem usar token público", async () => {
  mocks.token.mockReturnValueOnce(null);
  const response = await POST(request(new File(["%PDF-1.7"], "a.pdf", { type: "application/pdf" })));
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ success: false, error: expect.stringContaining("Armazenamento privado") });
  expect(mocks.put).not.toHaveBeenCalled();
});
it("retorna erro útil e não registra histórico quando o provedor falha", async () => {
  mocks.put.mockRejectedValueOnce(new Error("Blob indisponível"));
  const response = await POST(request(new File(["%PDF-1.7"], "a.pdf", { type: "application/pdf" })));
  expect(response.status).toBe(502);
  expect(await response.json()).toMatchObject({ success: false, error: expect.stringContaining("armazenamento") });
  expect(mocks.historico).not.toHaveBeenCalled();
});
it("rejeita arquivo acima do limite do proxy antes de chamar o storage", async () => {
  const response = await POST(request(new File([new ArrayBuffer(4 * 1024 * 1024 + 1)], "grande.pdf", { type: "application/pdf" })));
  expect(response.status).toBe(413);
  expect(await response.json()).toMatchObject({ success: false, error: expect.stringContaining("envio direto") });
  expect(mocks.put).not.toHaveBeenCalled();
});
it("limpa o Blob se o registro de histórico falhar", async () => {
  mocks.historico.mockRejectedValueOnce(new Error("Banco indisponível"));
  const response = await POST(request(new File(["%PDF-1.7"], "a.pdf", { type: "application/pdf" })));
  expect(response.status).toBeGreaterThanOrEqual(500);
  expect(mocks.del).toHaveBeenCalledWith("bpm/arquivo.pdf", { token: "token-privado-teste" });
});
it.each([
  ["PNG", "image/png", "foto.png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])],
  ["JPG", "image/jpeg", "foto.jpg", Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0])],
  ["JPEG", "image/jpeg", "foto.jpeg", Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0])],
])("aceita %s com assinatura compatível", async (_caso, tipo, nome, bytes) => {
  const response = await POST(request(new File([bytes.buffer as ArrayBuffer], nome, { type: tipo })));
  expect(response.status).toBe(200);
  expect(mocks.put).toHaveBeenCalledOnce();
});
it("aceita DOCX com estrutura Office válida", async () => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("word/document.xml", "<document/>");
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const response = await POST(request(new File([bytes.buffer as ArrayBuffer], "contrato.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })));
  expect(response.status).toBe(200);
  expect(mocks.put).toHaveBeenCalledOnce();
});
it("recusa DOCX com nomes no diretório central e cabeçalho local adulterado", async () => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("word/document.xml", "<document/>");
  const bytes = await zip.generateAsync({ type: "uint8array" });
  bytes[0] = 0;
  expect(await conteudoUploadCompativel(bytes.buffer as ArrayBuffer,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(false);
});
it.each([
  ["PDF sem MIME", "", "contrato.pdf", "%PDF-1.7", "application/pdf"],
  ["PDF octet-stream", "application/octet-stream", "contrato.pdf", "%PDF-1.7", "application/pdf"],
  ["PNG sem MIME", "", "foto.png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"],
  ["JPG sem MIME", "", "foto.jpg", Uint8Array.from([0xff, 0xd8, 0xff]), "image/jpeg"],
  ["JPEG octet-stream", "application/octet-stream", "foto.jpeg", Uint8Array.from([0xff, 0xd8, 0xff]), "image/jpeg"],
])("infere %s pela extensão e confirma assinatura", async (_caso, tipo, nome, conteudo, esperado) => {
  const bytes = typeof conteudo === "string" ? conteudo : conteudo.buffer as ArrayBuffer;
  const response = await POST(request(new File([bytes], nome, { type: tipo })));
  expect(response.status).toBe(200);
  expect((mocks.put.mock.calls[0][1] as Blob).type).toBe(esperado);
  expect(await response.json()).toMatchObject({ file: { mimeType: esperado } });
});
it.each(["", "application/octet-stream"])("aceita DOCX com MIME %s após validar estrutura ZIP", async (tipo) => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("word/document.xml", "<document/>");
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const response = await POST(request(new File([bytes.buffer as ArrayBuffer], "contrato.docx", { type: tipo })));
  expect(response.status).toBe(200);
  expect((mocks.put.mock.calls[0][1] as Blob).type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
});
it.each([
  ["MIME explícito divergente", "application/pdf", "foto.jpg", "%PDF-1.7"],
  ["extensão disfarçada", "", "foto.jpg", "%PDF-1.7"],
  ["extensão desconhecida", "", "contrato.exe", "%PDF-1.7"],
])("recusa %s antes do Blob", async (_caso, tipo, nome, conteudo) => {
  const response = await POST(request(new File([conteudo], nome, { type: tipo })));
  expect(response.status).toBe(400);
  expect(mocks.put).not.toHaveBeenCalled();
});
it.each(["image/png", "image/jpeg", "image/webp", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"])("recusa conteúdo HTML rotulado %s", async (tipo) => {
  expect(await conteudoUploadCompativel(new TextEncoder().encode("<html>fake</html>").buffer, tipo)).toBe(false);
});
