import { beforeEach, describe, expect, it, vi } from "vitest";

const calendarioMock = vi.hoisted(() => vi.fn());
const usuarioMock = vi.hoisted(() => vi.fn());
const eventoMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  default: { googleCalendarSelecionado: { findFirst: calendarioMock } },
}));
vi.mock("@/lib/google-calendar/usuario-google", () => ({
  obterUsuarioGoogleAtivoPorCalendario: usuarioMock,
}));
vi.mock("@/lib/google-calendar/client", () => ({ obterEvento: eventoMock }));

import { obterEmailReuniaoLegada } from "@/lib/bpm/email-reuniao-legado-server";

const params = { userId: 7, googleCalendarId: "primary", googleEventId: "evento-1" };

describe("recuperação de e-mail de reunião antiga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calendarioMock.mockResolvedValue({ id: "calendario-7" });
    usuarioMock.mockResolvedValue({ ok: true, userId: 7, emailUsuario: "usuario@exemplo.com" });
    eventoMock.mockResolvedValue({
      googleEventId: "evento-1",
      status: "confirmed",
      participantes: [{ email: "cliente@exemplo.com", organizador: false }],
    });
  });

  it("lê apenas a agenda do próprio usuário e recupera o convidado único", async () => {
    await expect(obterEmailReuniaoLegada(params)).resolves.toBe("cliente@exemplo.com");
    expect(calendarioMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { conexao: { userId: 7 }, googleCalendarId: "primary" },
    }));
    expect(eventoMock).toHaveBeenCalledWith({
      emailUsuario: "usuario@exemplo.com", calendarId: "primary", googleEventId: "evento-1",
    });
  });

  it("não lê o evento se a agenda pertence a outra conta", async () => {
    usuarioMock.mockResolvedValue({ ok: true, userId: 8, emailUsuario: "outro@exemplo.com" });
    await expect(obterEmailReuniaoLegada(params)).resolves.toBeNull();
    expect(eventoMock).not.toHaveBeenCalled();
  });

  it("preserva a leitura do card se o Google falhar", async () => {
    eventoMock.mockRejectedValue(new Error("Google indisponível"));
    await expect(obterEmailReuniaoLegada(params)).resolves.toBeNull();
  });
});
