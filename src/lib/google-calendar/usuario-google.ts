import db from "@/lib/prisma";

export type ResultadoUsuarioGoogleAtivo =
  | { ok: true; emailUsuario: string; conexaoId: string }
  | { ok: false; motivo: "sem_conexao" | "desativada" };

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
