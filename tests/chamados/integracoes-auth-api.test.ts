import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), ator: vi.fn(), chamado: vi.fn(), authorize: vi.fn(), criar: vi.fn(), notificar: vi.fn() }));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: { chamados: { findUnique: mocks.chamado } } }));
vi.mock("@/lib/chamados/acesso", async (original) => ({ ...await original<typeof import("@/lib/chamados/acesso")>(), obterAtorChamados: mocks.ator }));
vi.mock("@/lib/pusher-server.ts", () => ({ pusherServer: { authorizeChannel: mocks.authorize } }));
vi.mock("@/lib/bpm/ownership", () => ({ checarAcessoRealtimeBpmPipeline: vi.fn() }));
vi.mock("@/lib/chamados/criacao", () => ({ criarChamadoMultissetorial: mocks.criar, ErroCriacaoChamado: class extends Error {} }));
vi.mock("@/lib/chamados/notificacoes-server", () => ({ notificarNovoChamado: mocks.notificar }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { POST as pusherAuth } from "@/app/api/pusher/auth/route";
import { POST as abrirViaApi } from "@/app/api/ChatBot/AbrirChamado/route";

const financeiro = { id: 42, nome: "Ana", role: "Financeiro", setorId: 3, setorNome: "Financeiro", visaoGlobal: false, gerenciaCategorias: false };
const chamadoFinanceiro = { id: 15, usuarioId: 5, tecnicoId: 6, tecnicoSolicitadoId: null, status: "EM_ATENDIMENTO", setorDestinoId: 3, setorDestino: { id: 3, nome: "Financeiro", ativo: true, isBase: false } };
function canalRequest(channel: string) {
  const body = new FormData();
  body.set("socket_id", "123.456"); body.set("channel_name", channel);
  return new Request("http://localhost/api/pusher/auth", { method: "POST", body });
}
function chamadoRequest(body: unknown) {
  return new Request("http://localhost/api/ChatBot/AbrirChamado", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}

describe("fronteiras multissetoriais das integrações", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "42", nome: "Sessão desatualizada", role: "Admin" } });
    mocks.ator.mockResolvedValue(financeiro);
    mocks.chamado.mockResolvedValue(chamadoFinanceiro);
    mocks.authorize.mockReturnValue({ auth: "assinatura" });
    mocks.notificar.mockResolvedValue(true);
  });

  it("autoriza a leitura privada do próprio setor e nega chamado de outro setor", async () => {
    expect((await pusherAuth(canalRequest("private-chat-chamado-15"))).status).toBe(200);
    mocks.ator.mockResolvedValue({ ...financeiro, setorId: 4, setorNome: "Comercial", role: "Comercial" });
    expect((await pusherAuth(canalRequest("private-chat-chamado-15"))).status).toBe(403);
    expect(mocks.authorize).toHaveBeenCalledTimes(1);
  });

  it("preserva leitura global e ownership sem conceder acesso a inativos", async () => {
    mocks.ator.mockResolvedValue({ ...financeiro, setorId: 8, setorNome: "TI", role: "TI", visaoGlobal: true });
    expect((await pusherAuth(canalRequest("private-chat-chamado-15"))).status).toBe(200);
    mocks.ator.mockResolvedValue({ ...financeiro, setorId: 4 });
    mocks.chamado.mockResolvedValue({ ...chamadoFinanceiro, usuarioId: 42 });
    expect((await pusherAuth(canalRequest("private-chat-chamado-15"))).status).toBe(200);
    mocks.ator.mockResolvedValue(null);
    expect((await pusherAuth(canalRequest("private-chat-chamado-15"))).status).toBe(403);
  });

  it("não usa role antiga da sessão para o canal global e exige usuário ativo no canal próprio", async () => {
    expect((await pusherAuth(canalRequest("private-admin-chamados"))).status).toBe(403);
    expect((await pusherAuth(canalRequest("private-chamados-usuario-43"))).status).toBe(403);
    expect((await pusherAuth(canalRequest("private-chamados-usuario-42"))).status).toBe(200);
    mocks.ator.mockResolvedValue(null);
    expect((await pusherAuth(canalRequest("private-chamados-usuario-42"))).status).toBe(403);
  });

  it.each(["private-chat-chamado-0", "private-chat-chamado-15-injetado", "chat-chamado-15"])("nega canal inválido/legado %s", async (channel) => {
    expect((await pusherAuth(canalRequest(channel))).status).toBe(403);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });

  it("rejeita payload antigo sem destino e campos de identidade forjados antes da criação", async () => {
    for (const body of [
      { titulo: "Falha", descricao: "Falha no sistema", prioridade: "MEDIA", categoria: "Hardware" },
      { titulo: "Falha", descricao: "Falha no sistema", prioridade: "MEDIA", setorDestinoId: 3, categoriaId: 9, usuarioId: 999 },
    ]) expect((await abrirViaApi(chamadoRequest(body))).status).toBe(400);
    expect(mocks.criar).not.toHaveBeenCalled();
  });

  it("delega abertura ao serviço canônico e usa identidade persistida na notificação", async () => {
    mocks.criar.mockResolvedValue({ id: 100, titulo: "Pagamento", prioridade: "ALTA", setorDestinoId: 3, setorDestinoNome: "Financeiro", tecnicoSolicitadoId: null, createdAt: new Date("2026-10-15T12:00:00Z"), autor: { id: 42, nome: "Ana", role: "Comercial" } });
    const response = await abrirViaApi(chamadoRequest({ titulo: "Pagamento", descricao: "Reembolso pendente", prioridade: "ALTA", setorDestinoId: 3, categoriaId: 9 }));
    expect(response.status).toBe(200);
    expect(mocks.criar).toHaveBeenCalledWith(42, expect.objectContaining({ setorDestinoId: 3, categoriaId: 9, descricao: "Reembolso pendente", tecnicoSolicitadoId: null, dataDesejadaConclusao: null }), { origemBibble: true });
    expect(mocks.notificar).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 42, usuario: "Ana", setorOrigem: "Comercial", setorDestinoId: 3, setorDestinoNome: "Financeiro" }));
  });
});
