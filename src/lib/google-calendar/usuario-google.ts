import db from "@/lib/prisma";

export type ResultadoUsuarioGoogleAtivo =
  | { ok: true; emailUsuario: string; conexaoId: string }
  | { ok: false; motivo: "sem_conexao" | "desativada" };

export type ResultadoUsuarioGooglePorCalendario =
  | {
      ok: true;
      emailUsuario: string;
      userId: number;
      conexaoId: string;
      calendarioId: string;
      googleCalendarId: string;
    }
  | {
      ok: false;
      motivo:
        | "calendario_inexistente"
        | "sem_email"
        | "usuario_inativo"
        | "conexao_desativada";
    };

/**
 * Resolve o e-mail Google (Workspace) a impersonar para `userId` — SEMPRE lido de `usuarios.email`
 * no servidor, nunca aceito como parâmetro vindo do cliente (evita impersonar outro colaborador).
 * Exige que o usuário tenha ativado o Calendário Alpha (`GoogleCalendarConexao.status === "ATIVA"`).
 */
export async function obterUsuarioGoogleAtivo(userId: number): Promise<ResultadoUsuarioGoogleAtivo> {
  const [usuario, conexao] = await Promise.all([
    db.usuarios.findUnique({ where: { id: userId }, select: { email: true } }),
    db.googleCalendarConexao.findUnique({ where: { userId }, select: { id: true, status: true } }),
  ]);

  if (!conexao || !usuario?.email) return { ok: false, motivo: "sem_conexao" };
  if (conexao.status !== "ATIVA") return { ok: false, motivo: "desativada" };

  return { ok: true, emailUsuario: usuario.email, conexaoId: conexao.id };
}

/**
 * Resolve o subject DWD a partir do calendário local. Este é o caminho seguro
 * para worker/maintenance: nenhum e-mail, userId ou subject externo participa
 * da resolução.
 */
export async function obterUsuarioGoogleAtivoPorCalendario(
  calendarioId: string,
): Promise<ResultadoUsuarioGooglePorCalendario> {
  const calendario = await db.googleCalendarSelecionado.findUnique({
    where: { id: calendarioId },
    select: {
      id: true,
      googleCalendarId: true,
      conexao: {
        select: {
          id: true,
          status: true,
          user: {
            select: {
              id: true,
              email: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!calendario) return { ok: false, motivo: "calendario_inexistente" };
  if (calendario.conexao.status !== "ATIVA") {
    return { ok: false, motivo: "conexao_desativada" };
  }
  if (calendario.conexao.user.status !== "ATIVO") {
    return { ok: false, motivo: "usuario_inativo" };
  }
  const emailUsuario = calendario.conexao.user.email?.trim();
  if (!emailUsuario) return { ok: false, motivo: "sem_email" };

  return {
    ok: true,
    emailUsuario,
    userId: calendario.conexao.user.id,
    conexaoId: calendario.conexao.id,
    calendarioId: calendario.id,
    googleCalendarId: calendario.googleCalendarId,
  };
}
