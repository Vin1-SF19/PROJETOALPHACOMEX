import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), acesso: vi.fn(), contexto: vi.fn(), get: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: m.acesso }));
vi.mock("@/lib/bpm/contratacao-comercial-server", () => ({ carregarAcompanhamentoComercial: m.contexto }));
vi.mock("@vercel/blob", () => ({ get: m.get }));
import { GET } from "@/app/api/bpm/cards/[cardId]/contrato/route";
const chamar = () => GET(new Request("https://painel.test/api/bpm/cards/comercial/contrato"), { params: Promise.resolve({ cardId: "comercial" }) });
beforeEach(() => { vi.clearAllMocks(); m.acesso.mockResolvedValue(undefined); m.auth.mockResolvedValue({ user: { id: "7", role: "Comercial" } }); process.env.BLOBCRM_READ_WRITE_TOKEN = "token-teste"; });
it("nega sessão ausente antes de consultar contrato", async () => { m.auth.mockResolvedValue(null); expect((await chamar()).status).toBe(401); expect(m.contexto).not.toHaveBeenCalled(); });
it("nega sem permissão no card Comercial, sem consultar armazenamento", async () => { m.acesso.mockRejectedValue(new Error("Não autorizado")); expect((await chamar()).status).toBe(403); expect(m.get).not.toHaveBeenCalled(); });
it("não disponibiliza contrato ainda em conferência", async () => { m.contexto.mockResolvedValue({ documento: null }); expect((await chamar()).status).toBe(404); expect(m.get).not.toHaveBeenCalled(); });
it("transmite somente documento autorizado com cache privado, sem expor token", async () => {
  m.contexto.mockResolvedValue({ documento: { referencia: "bpm/fin/contrato.pdf", armazenamento: "privado" } });
  m.get.mockResolvedValue({ statusCode: 200, stream: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("%PDF-teste")); c.close(); } }) });
  const resposta = await chamar(); expect(resposta.status).toBe(200); expect(resposta.headers.get("cache-control")).toContain("no-store");
  expect(resposta.headers.get("content-type")).toBe("application/pdf"); expect(await resposta.text()).toBe("%PDF-teste");
  expect(m.acesso).toHaveBeenCalledWith("comercial", 7, "Comercial", "visualizar");
});
