import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAMADO_CONCLUIDO_EVENT,
  CHAMADOS_ADMIN_CHANNEL,
  NOVO_CHAMADO_EVENT,
  canalChamadosDoUsuario,
  extrairUsuarioIdDoCanalChamados,
  podeReceberNovosChamados,
} from "@/lib/chamados/notificacoes";

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
