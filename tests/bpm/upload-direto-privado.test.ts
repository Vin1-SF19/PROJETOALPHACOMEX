import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), acesso: vi.fn(), handleUpload: vi.fn(), head: vi.fn(), get: vi.fn(),
  historicoFind: vi.fn(), historicoCreate: vi.fn(),
}));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: mocks.acesso }));
vi.mock("@vercel/blob/client", () => ({ handleUpload: mocks.handleUpload }));
vi.mock("@vercel/blob", () => ({ head: mocks.head, get: mocks.get }));
vi.mock("@/lib/prisma", () => ({ default: { bpmCardHistorico: { findFirst: mocks.historicoFind, create: mocks.historicoCreate } } }));

import { POST as autorizarUpload } from "@/app/api/bpm/upload/direct/route";
import { POST as finalizarUpload } from "@/app/api/bpm/upload/finalize/route";

const CARD_ID = "clw0000000000000card";
const PATHNAME = `bpm/${CARD_ID}/550e8400-e29b-41d4-a716-446655440000-contrato.pdf`;
const PDF = "%PDF-1.7\n%%EOF";
const PDF_BYTES = new TextEncoder().encode(PDF);
const tokenAnterior = process.env.BLOBCRM_READ_WRITE_TOKEN;
const segredoAnterior = process.env.CRM_ANEXO_RECEIPT_SECRET;

function requestDirect(cardId = CARD_ID, pathname = PATHNAME) {
  return new NextRequest("http://localhost/api/bpm/upload/direct", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "blob.generate-client-token", payload: {
      pathname, multipart: true, clientPayload: JSON.stringify({ cardId }),
    } }),
  });
}
function requestFinalize(body: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/bpm/upload/finalize", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId: CARD_ID, pathname: PATHNAME, originalName: "contrato.pdf",
      mimeType: "application/pdf", size: PDF_BYTES.length, ...body }),
  });
}
async function finalizarSemCallback() {
  vi.useFakeTimers();
  try {
    const pending = finalizarUpload(requestFinalize());
    await vi.advanceTimersByTimeAsync(13_000);
    return await pending;
  } finally {
    vi.useRealTimers();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BLOBCRM_READ_WRITE_TOKEN = "token-privado-teste";
  process.env.CRM_ANEXO_RECEIPT_SECRET = "segredo-de-teste";
  mocks.auth.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
  mocks.acesso.mockResolvedValue({});
  mocks.historicoFind.mockResolvedValue({ id: "pendente" });
  mocks.historicoCreate.mockResolvedValue({ id: "pendente" });
  mocks.handleUpload.mockResolvedValue({ clientToken: "token-curto" });
  mocks.head.mockResolvedValue({ pathname: PATHNAME, size: PDF_BYTES.length, contentType: "application/pdf" });
  mocks.get.mockImplementation(async () => ({
    blob: { size: PDF_BYTES.length, contentType: "application/pdf" },
    stream: new ReadableStream({ start(controller) { controller.enqueue(PDF_BYTES); controller.close(); } }),
  }));
});
afterEach(() => {
  if (tokenAnterior === undefined) delete process.env.BLOBCRM_READ_WRITE_TOKEN;
  else process.env.BLOBCRM_READ_WRITE_TOKEN = tokenAnterior;
  if (segredoAnterior === undefined) delete process.env.CRM_ANEXO_RECEIPT_SECRET;
  else process.env.CRM_ANEXO_RECEIPT_SECRET = segredoAnterior;
});

it("autoriza upload multipart privado somente para usuário com acesso e limite de 90 MiB", async () => {
  mocks.historicoFind.mockResolvedValueOnce(null);
  const response = await autorizarUpload(requestDirect());
  expect(response.status).toBe(200);
  expect(mocks.acesso).toHaveBeenCalledWith(CARD_ID, 7, "COMERCIAL", "enviarArquivo");
  expect(mocks.historicoCreate).not.toHaveBeenCalled();
  const config = mocks.handleUpload.mock.calls[0][0];
  expect(config.token).toBe("token-privado-teste");
  const limites = await config.onBeforeGenerateToken(PATHNAME, JSON.stringify({ cardId: CARD_ID }));
  expect(limites.maximumSizeInBytes).toBe(90 * 1024 * 1024);
  expect(limites.allowedContentTypes).toContain("application/pdf");
  expect(limites.addRandomSuffix).toBe(false);
  expect(limites.tokenPayload).toBe(JSON.stringify({ cardId: CARD_ID, userId: 7, pathname: PATHNAME }));
  await config.onUploadCompleted({ blob: { pathname: PATHNAME }, tokenPayload: limites.tokenPayload });
  expect(mocks.historicoCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
    cardId: CARD_ID, usuarioId: 7, valorAnteriorJson: `bpm-blob:${PATHNAME}`,
  }) });
});

it("preserva o corpo integral do callback para a assinatura verificada pelo SDK", async () => {
  const blob = {
    pathname: PATHNAME,
    url: `https://example.private.blob.vercel-storage.com/${PATHNAME}`,
    contentType: "application/pdf",
    size: PDF_BYTES.length,
    uploadedAt: "2026-09-29T00:00:00.000Z",
  };
  const callback = { type: "blob.upload-completed", payload: { blob, tokenPayload: "payload-assinado" } };
  const response = await autorizarUpload(new NextRequest("http://localhost/api/bpm/upload/direct", {
    method: "POST", headers: { "Content-Type": "application/json", "x-vercel-signature": "assinatura" },
    body: JSON.stringify(callback),
  }));
  expect(response.status).toBe(200);
  expect(mocks.handleUpload.mock.calls[0][0].body).toEqual(callback);
  expect(mocks.auth).not.toHaveBeenCalled();
});

it("nega sessão ausente, card alheio e caminho fora do card antes de emitir token", async () => {
  mocks.auth.mockResolvedValueOnce(null);
  expect((await autorizarUpload(requestDirect())).status).toBe(401);
  mocks.acesso.mockRejectedValueOnce(new Error("sem acesso"));
  expect((await autorizarUpload(requestDirect())).status).toBe(403);
  expect((await autorizarUpload(requestDirect("clw000000000000outro"))).status).toBe(400);
  expect(mocks.handleUpload).not.toHaveBeenCalled();
});

it("finaliza apenas upload próprio e presente no Blob privado, gerando recibo", async () => {
  const response = await finalizarUpload(requestFinalize());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, file: {
    originalName: "contrato.pdf", mimeType: "application/pdf", size: PDF_BYTES.length,
    recibo: expect.any(String),
  } });
  expect(mocks.historicoFind).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
    cardId: CARD_ID, usuarioId: 7, valorAnteriorJson: `bpm-blob:${PATHNAME}`,
  }) }));
  expect(mocks.head).toHaveBeenCalledWith(PATHNAME, { token: "token-privado-teste" });
  expect(mocks.get).toHaveBeenCalledWith(PATHNAME, { access: "private", token: "token-privado-teste", useCache: false });
});

it("não assina arquivo alheio, adulterado ou maior que 90 MiB", async () => {
  mocks.historicoFind.mockResolvedValue(null);
  expect((await finalizarSemCallback()).status).toBe(409);
  expect(mocks.head).not.toHaveBeenCalled();
  mocks.historicoFind.mockResolvedValue({ id: "pendente" });
  expect((await finalizarUpload(requestFinalize({ size: 90 * 1024 * 1024 + 1 }))).status).toBe(400);
  expect((await finalizarUpload(requestFinalize({ pathname: `bpm/clw000000000000outro/550e8400-e29b-41d4-a716-446655440000-contrato.pdf` }))).status).toBe(400);
  mocks.head.mockResolvedValueOnce({ pathname: PATHNAME, size: PDF_BYTES.length, contentType: "image/png" });
  expect((await finalizarUpload(requestFinalize())).status).toBe(400);
});

it("token emitido para Blob pré-existente não autoriza finalize sem callback autenticado", async () => {
  mocks.historicoFind.mockResolvedValue(null);
  expect((await autorizarUpload(requestDirect())).status).toBe(200);
  expect(mocks.historicoCreate).not.toHaveBeenCalled();
  expect((await finalizarSemCallback()).status).toBe(409);
  expect(mocks.head).not.toHaveBeenCalled();
});

it("recusa conteúdo com assinatura falsa mesmo que metadata declare PDF", async () => {
  mocks.get.mockResolvedValueOnce({
    blob: { size: PDF_BYTES.length, contentType: "application/pdf" },
    stream: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("<script>fake</script>")); controller.close(); } }),
  });
  expect((await finalizarUpload(requestFinalize())).status).toBe(400);
});
