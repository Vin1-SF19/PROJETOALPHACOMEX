import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const exigirAcessoBpmCardMock = vi.hoisted(() => vi.fn());
const iniciarLigacaoCallixMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn() },
  pessoaClienteVinculo: { findMany: vi.fn() },
  usuarios: { findUnique: vi.fn() },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: exigirAcessoBpmCardMock,
  isAdminRole: vi.fn().mockReturnValue(false),
}));
// `server-only` não está instalado como dependência real (Next.js o fornece em
// runtime) — Cards.ts importa `realtime-server.ts`, que o usa; sem mock, o Vitest
// falha ao resolver o pacote antes de qualquer teste rodar.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/callix/click-to-call", () => ({
  iniciarLigacaoCallix: iniciarLigacaoCallixMock,
  normalizarTelefoneCallix: (telefone: string) => {
    const normalizado = telefone.replace(/\D/g, "");
    return normalizado.length >= 8 && normalizado.length <= 15 ? normalizado : null;
  },
}));

import { IniciarLigacaoTelefoneCardBpm, ListarTelefonesCardBpm } from "@/actions/bpm/Cards";

describe("ListarTelefonesCardBpm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigirAcessoBpmCardMock.mockResolvedValue({ autorizado: true });
    iniciarLigacaoCallixMock.mockResolvedValue({ success: true, data: { id: "call-1", message: "Chamada enviada." } });
  });

  it("bloqueia a consulta sem sessão autenticada", async () => {
    authMock.mockResolvedValue(null);

    const resultado = await ListarTelefonesCardBpm("card-1");

    expect(resultado).toEqual({ success: false, error: "Não autorizado", data: [] });
    expect(exigirAcessoBpmCardMock).not.toHaveBeenCalled();
    expect(prismaMock.pessoaClienteVinculo.findMany).not.toHaveBeenCalled();
  });

  it("exige acesso de visualização ao card", async () => {
    authMock.mockResolvedValue({ user: { id: "42", role: "User" } });
    exigirAcessoBpmCardMock.mockRejectedValue(new Error("Não autorizado"));

    const resultado = await ListarTelefonesCardBpm("card-1");

    expect(exigirAcessoBpmCardMock).toHaveBeenCalledWith("card-1", 42, "User", "visualizar");
    expect(resultado).toEqual({ success: false, error: "Não autorizado", data: [] });
    expect(prismaMock.pessoaClienteVinculo.findMany).not.toHaveBeenCalled();
  });

  it("busca Pessoas vinculadas ao Cliente (PessoaClienteVinculo) e remove telefones vazios", async () => {
    authMock.mockResolvedValue({ user: { id: "42", role: "User" } });
    prismaMock.bpmCard.findUnique.mockResolvedValue({ empresaId: 17 });
    prismaMock.pessoaClienteVinculo.findMany.mockResolvedValue([
      { pessoa: { id: 1, nome: "Ana", celular: " (11) 99999-0000 " } },
      { pessoa: { id: 2, nome: "Bruno", celular: "   " } },
    ]);

    const resultado = await ListarTelefonesCardBpm("card-1");

    expect(prismaMock.pessoaClienteVinculo.findMany).toHaveBeenCalledWith({
      where: { clienteId: 17 },
      select: { pessoa: { select: { id: true, nome: true, celular: true } } },
      orderBy: { pessoa: { nome: "asc" } },
    });
    expect(resultado).toEqual({
      success: true,
      data: [{ id: 1, nome: "Ana", telefone: "(11) 99999-0000" }],
    });
  });

  it("inicia na Callix somente um telefone vinculado ao card autorizado", async () => {
    authMock.mockResolvedValue({ user: { id: "42", role: "User" } });
    prismaMock.bpmCard.findUnique.mockResolvedValue({ empresaId: 17 });
    prismaMock.pessoaClienteVinculo.findMany.mockResolvedValue([
      { pessoa: { celular: "(11) 99999-0000" } },
    ]);
    prismaMock.usuarios.findUnique.mockResolvedValue({
      role: "COMERCIAL", callixHabilitado: true, callixUserId: "agente-123",
    });

    const resultado = await IniciarLigacaoTelefoneCardBpm("card-1", "(11) 99999-0000");

    expect(iniciarLigacaoCallixMock).toHaveBeenCalledWith("11999990000", "agente-123");
    expect(resultado).toEqual({ success: true, data: { id: "call-1", message: "Chamada enviada." } });
  });

  it("não permite iniciar chamada para telefone que não pertence ao card", async () => {
    authMock.mockResolvedValue({ user: { id: "42", role: "User" } });
    prismaMock.bpmCard.findUnique.mockResolvedValue({ empresaId: 17 });
    prismaMock.pessoaClienteVinculo.findMany.mockResolvedValue([
      { pessoa: { celular: "(11) 99999-0000" } },
    ]);

    const resultado = await IniciarLigacaoTelefoneCardBpm("card-1", "(11) 98888-0000");

    expect(resultado).toEqual({ success: false, error: "Telefone não vinculado a este card." });
    expect(iniciarLigacaoCallixMock).not.toHaveBeenCalled();
  });

  it("permite a Callix para qualquer usuário habilitado, inclusive fora do role COMERCIAL", async () => {
    authMock.mockResolvedValue({ user: { id: "42", role: "COMERCIAL" } });
    prismaMock.bpmCard.findUnique.mockResolvedValue({ empresaId: 17 });
    prismaMock.pessoaClienteVinculo.findMany.mockResolvedValue([
      { pessoa: { celular: "(11) 99999-0000" } },
    ]);
    prismaMock.usuarios.findUnique.mockResolvedValue({
      callixHabilitado: true, callixUserId: "agente-lider",
    });

    const resultado = await IniciarLigacaoTelefoneCardBpm("card-1", "(11) 99999-0000");

    expect(resultado).toEqual({
      success: true,
      data: { id: "call-1", message: "Chamada enviada." },
    });
    expect(iniciarLigacaoCallixMock).toHaveBeenCalledWith("11999990000", "agente-lider");
  });
});
