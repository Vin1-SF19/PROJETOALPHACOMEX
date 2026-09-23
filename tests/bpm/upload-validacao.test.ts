import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { conteudoUploadCompativel } from "@/lib/bpm/upload-conteudo";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), acesso: vi.fn(), put: vi.fn(), del: vi.fn(), historico: vi.fn() }));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: mocks.acesso }));
vi.mock("@vercel/blob", () => ({ put: mocks.put, del: mocks.del }));
vi.mock("@/lib/prisma", () => ({ default: { bpmCardHistorico: { create: mocks.historico } } }));
vi.mock("@/lib/bpm/anexos-storage", () => ({ recibosAnexoBpmConfigurados: () => true, criarReciboUploadAnexoBpm: () => "recibo", criarReferenciaAnexoBpm: (pathname: string) => `bpm-blob:${pathname}` }));
import { POST } from "@/app/api/bpm/upload/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "7" } });
  mocks.acesso.mockResolvedValue({});
  mocks.put.mockResolvedValue({ pathname: "bpm/arquivo.pdf" });
  mocks.historico.mockResolvedValue({ id: "historico" });
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
  const form = new FormData(); form.set("file", new File(["%PDF-1.7\n%%EOF"], "a.pdf", { type: "application/pdf" })); form.set("cardId", "clw0000000000000card");
  const response = await POST(new NextRequest("http://localhost/api/bpm/upload", { method: "POST", body: form }));
  expect(response.status).toBe(200); expect(mocks.put).toHaveBeenCalledOnce();
});
it.each(["image/png", "image/jpeg", "image/webp", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"])("recusa conteúdo HTML rotulado %s", async (tipo) => {
  expect(await conteudoUploadCompativel(new TextEncoder().encode("<html>fake</html>").buffer, tipo)).toBe(false);
});
