import db from "@/lib/prisma";

export const STATUS_USUARIO_ATIVO = "ATIVO";

export type TokenAcessoPainel = Record<string, unknown> & {
  id?: unknown;
  acessoBloqueado?: boolean;
  statusUsuario?: string;
};

export function statusPermiteAcessoPainel(status: unknown): boolean {
  return status === STATUS_USUARIO_ATIVO;
}

export async function usuarioPodeAcessarPainel(userId: unknown): Promise<boolean> {
  const id = Number(userId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return false;
  }

  try {
    const usuario = await db.usuarios.findUnique({
      where: { id },
      select: { status: true },
    });

    return statusPermiteAcessoPainel(usuario?.status);
  } catch (error) {
    console.error("Falha ao validar o status de acesso do usuário:", error);
    return false;
  }
}

export function bloquearTokenAcesso<T extends TokenAcessoPainel>(token: T): T {
  return {
    ...token,
    sub: undefined,
    id: undefined,
    email: undefined,
    nome: undefined,
    usuario: undefined,
    role: undefined,
    permissoes: undefined,
    acessoBloqueado: true,
  };
}

export async function revalidarTokenAcesso<T extends TokenAcessoPainel>(
  token: T,
): Promise<T> {
  if (token.acessoBloqueado || !(await usuarioPodeAcessarPainel(token.id))) {
    return bloquearTokenAcesso(token);
  }

  return {
    ...token,
    statusUsuario: STATUS_USUARIO_ATIVO,
    acessoBloqueado: false,
  };
}
