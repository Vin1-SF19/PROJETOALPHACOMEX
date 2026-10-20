import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ auth: vi.fn(), usuario: vi.fn(), card: vi.fn(), membro: vi.fn(), remoto: vi.fn(), cliente: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("@/lib/alpha-crm/client", () => ({ callStandaloneCrm: m.remoto }));
vi.mock("@/lib/prisma", () => ({ default: {
  usuarios: { findUnique: m.usuario }, setorPermissao: { findMany: async () => [] },
  usuarioPermissaoOverride: { findMany: async () => [] }, bpmCard: { findUnique: m.card },
  bpmCardMembro: { findUnique: m.membro }, cliente: { findUnique: m.cliente },
} }));
import { GET, POST } from "@/app/api/integrations/alpha-crm/opportunities/route";
const request = () => new NextRequest("http://localhost/api/integrations/alpha-crm/opportunities", { method: "POST", body: JSON.stringify({ cardId: "card" }) });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "7", role: "Comercial" } });
  m.usuario.mockResolvedValue({ id: 7, role: "Comercial", status: "ATIVO", permissoes: "crm" });
  m.card.mockResolvedValue({ id: "card", empresaId: 3, servico: "Radar", responsavelId: 9, pipelineId: "p", status: "ATIVO", vinculosOrigem: [],
    pipeline: { setores: [{ setor: { nome: "Comercial" } }] }, etapa: { nome: "Tratativa", ehFinal: false, visibilidades: [] },
    empresa: { razaoSocial: "Empresa", nomeFantasia: null, cnpj: null } });
  m.membro.mockResolvedValue(null); m.cliente.mockResolvedValue({ id: 3 });
  m.remoto.mockResolvedValue({ status: 200, payload: { opportunities: [] } });
});
it("leitor de colega não cria oportunidade remota", async () => {
  const resposta = await POST(request());
  expect(resposta.status).toBe(403); expect(await resposta.json()).toEqual({ error: "Acesso negado ao card" });
  expect(m.remoto).not.toHaveBeenCalled();
});
it("participante com capacidade de editar mantém criação remota", async () => {
  m.membro.mockResolvedValue({ role: "PARTICIPANTE" });
  expect((await POST(request())).status).toBe(200);
  expect(m.remoto).toHaveBeenCalledWith("/api/integrations/painel-alpha/opportunities", expect.objectContaining({ method: "POST" }));
});
it("GET mantém consulta sem emitir criação remota", async () => {
  expect((await GET(new NextRequest("http://localhost/api/integrations/alpha-crm/opportunities?clienteId=3"))).status).toBe(200);
  expect(m.remoto).toHaveBeenCalledWith("/api/integrations/painel-alpha/opportunities?panelCompanyId=3");
});
