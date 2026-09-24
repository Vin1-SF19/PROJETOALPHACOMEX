import db from "@/lib/prisma";
import { obterEvento } from "@/lib/google-calendar/client";
import { obterUsuarioGoogleAtivoPorCalendario } from "@/lib/google-calendar/usuario-google";
import { selecionarEmailConvidadoUnico } from "@/lib/bpm/email-reuniao";

/** Lê um evento antigo somente pela agenda conectada do próprio usuário. */
export async function obterEmailReuniaoLegada(params: {
  userId: number;
  googleCalendarId: string;
  googleEventId: string;
}): Promise<string | null> {
  try {
    const calendario = await db.googleCalendarSelecionado.findFirst({
      where: {
        conexao: { userId: params.userId },
        googleCalendarId: params.googleCalendarId,
      },
      select: { id: true },
    });
    if (!calendario) return null;

    const usuario = await obterUsuarioGoogleAtivoPorCalendario(calendario.id);
    if (!usuario.ok || usuario.userId !== params.userId) return null;

    const evento = await obterEvento({
      emailUsuario: usuario.emailUsuario,
      calendarId: params.googleCalendarId,
      googleEventId: params.googleEventId,
    });
    if (evento.status === "cancelled" || evento.googleEventId !== params.googleEventId) return null;
    return selecionarEmailConvidadoUnico(evento.participantes);
  } catch {
    return null;
  }
}
