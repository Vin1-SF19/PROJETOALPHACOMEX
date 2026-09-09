import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAMADO_ASSUMIDO_EVENT,
  CHAMADO_CONCLUIDO_EVENT,
  CHAMADOS_ADMIN_CHANNEL,
  NOVO_CHAMADO_EVENT,
  canalChamadosDoUsuario,
  extrairUsuarioIdDoCanalChamados,
  podeReceberNovosChamados,
} from "@/lib/chamados/notificacoes";
import {
  CALENDARIO_ALPHA_CHAMADO_ATUALIZADO_EVENT,
  canalCalendarioAlphaDoUsuario,
} from "@/lib/google-calendar/notificacoes";

const trigger = vi.fn();

vi.mock("@/lib/pusher-server.ts", () => ({
  pusherServer: { trigger },
}));

describe("notificações de chamados", () => {
  beforeEach(() => {
    trigger.mockReset();
  });

  it("normaliza os papéis autorizados a receber novos chamados", () => {
    expect(podeReceberNovosChamados("Admin")).toBe(true);
    expect(podeReceberNovosChamados(" admin ")).toBe(true);
    expect(podeReceberNovosChamados("CEO")).toBe(true);
    expect(podeReceberNovosChamados("User")).toBe(false);
  });

  it("cria e interpreta somente canais individuais válidos", () => {
    expect(canalChamadosDoUsuario(42)).toBe("private-chamados-usuario-42");
    expect(extrairUsuarioIdDoCanalChamados("private-chamados-usuario-42")).toBe(42);
    expect(extrairUsuarioIdDoCanalChamados("private-chamados-usuario-0")).toBeNull();
    expect(extrairUsuarioIdDoCanalChamados("private-chamados-usuario-42-outro")).toBeNull();
    expect(() => canalChamadosDoUsuario(0)).toThrow(/inválido/i);
  });

  it("publica novos chamados no canal administrativo", async () => {
    const { notificarNovoChamado } = await import("@/lib/chamados/notificacoes-server");
    const payload = {
      chamadoId: 15,
      titulo: "Falha no acesso",
      usuario: "Ana",
      setor: "Financeiro",
      urgencia: "ALTA",
      createdAt: "2026-07-30T12:00:00.000Z",
    };

    await expect(notificarNovoChamado(payload)).resolves.toBe(true);
    expect(trigger).toHaveBeenCalledWith(CHAMADOS_ADMIN_CHANNEL, NOVO_CHAMADO_EVENT, payload);
  });

  it("publica a conclusão somente no canal do solicitante", async () => {
    const { notificarChamadoConcluido } = await import("@/lib/chamados/notificacoes-server");
    const payload = {
      chamadoId: 15,
      titulo: "Falha no acesso",
      solucao: "Acesso normalizado.",
      createdAt: "2026-07-30T13:00:00.000Z",
    };

    await expect(notificarChamadoConcluido(42, payload)).resolves.toBe(true);
    expect(trigger).toHaveBeenCalledWith(
      "private-chamados-usuario-42",
      CHAMADO_CONCLUIDO_EVENT,
      payload,
    );
  });

  it("publica o atendimento somente no canal privado do solicitante", async () => {
    const { notificarChamadoAssumido } = await import("@/lib/chamados/notificacoes-server");
    const payload = {
      chamadoId: 15,
      titulo: "Falha no acesso",
      tecnicoNome: "Carlos Silva",
      createdAt: "2026-09-09T18:00:00.000Z",
    };

    await expect(notificarChamadoAssumido(42, payload)).resolves.toBe(true);
    expect(trigger).toHaveBeenCalledWith(
      "private-chamados-usuario-42",
      CHAMADO_ASSUMIDO_EVENT,
      payload,
    );
  });

  it("não desfaz a atribuição quando o aviso de atendimento falha", async () => {
    trigger.mockRejectedValueOnce(new Error("indisponível"));
    const { notificarChamadoAssumido } = await import("@/lib/chamados/notificacoes-server");

    await expect(notificarChamadoAssumido(42, {
      chamadoId: 15,
      titulo: "Falha no acesso",
      tecnicoNome: "Carlos Silva",
      createdAt: "2026-09-09T18:00:00.000Z",
    })).resolves.toBe(false);
  });

  it("invalida em tempo real as agendas do solicitante e do técnico", async () => {
    const { notificarAgendaChamadoAtualizada } = await import(
      "@/lib/chamados/notificacoes-server"
    );
    const payload = {
      chamadoId: 15,
      status: "EM_ATENDIMENTO" as const,
      updatedAt: "2026-09-09T17:50:00.000Z",
    };

    await expect(
      notificarAgendaChamadoAtualizada([42, 8, 42, 0], payload),
    ).resolves.toBe(true);
    expect(trigger).toHaveBeenCalledWith(
      [canalCalendarioAlphaDoUsuario(42), canalCalendarioAlphaDoUsuario(8)],
      CALENDARIO_ALPHA_CHAMADO_ATUALIZADO_EVENT,
      payload,
    );
  });

  it("não desfaz a operação quando o Pusher falha", async () => {
    trigger.mockRejectedValueOnce(new Error("indisponível"));
    const { notificarNovoChamado } = await import("@/lib/chamados/notificacoes-server");

    await expect(notificarNovoChamado({
      chamadoId: 18,
      titulo: "Erro",
      usuario: "João",
      setor: "Operacional",
      urgencia: "MEDIA",
      createdAt: "2026-07-30T14:00:00.000Z",
    })).resolves.toBe(false);
  });
});
