import db from "@/lib/prisma";
import { cache } from "react";

export const STATUS_USUARIO_ATIVO = "ATIVO";

export type TokenAcessoPainel = Record<string, unknown> & {
  id?: unknown;
  acessoBloqueado?: boolean;
  statusUsuario?: string;
  authSessionVersion?: unknown;
};

export function statusPermiteAcessoPainel(status: unknown): boolean {
  return status === STATUS_USUARIO_ATIVO;
}

type EstadoAcessoPainel = {
  status: string;
  authSessionVersion: number;
};

// Compartilha a leitura entre auth() do root, layout e página somente durante
// a renderização atual. Uma nova requisição sempre revalida o token no banco.
const obterEstadoAcessoPainel = cache(async (userId: unknown): Promise<EstadoAcessoPainel | null> => {
  const id = Number(userId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }

  try {
    const usuario = await db.usuarios.findUnique({
      where: { id },
      select: { status: true, authSessionVersion: true },
    });

    return usuario;
  } catch (error) {
    console.error("Falha ao validar o status de acesso do usuário:", error);
    return null;
  }
});

export async function usuarioPodeAcessarPainel(userId: unknown): Promise<boolean> {
  const estado = await obterEstadoAcessoPainel(userId);
  return statusPermiteAcessoPainel(estado?.status);
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
    authSessionVersion: undefined,
    acessoBloqueado: true,
  };
}

export async function revalidarTokenAcesso<T extends TokenAcessoPainel>(
  token: T,
): Promise<T> {
  if (token.acessoBloqueado) {
    return bloquearTokenAcesso(token);
  }

  const estado = await obterEstadoAcessoPainel(token.id);
  const tokenVersion = Number(token.authSessionVersion ?? 0);
  if (
    !estado ||
    !statusPermiteAcessoPainel(estado.status) ||
    !Number.isSafeInteger(tokenVersion) ||
    tokenVersion !== estado.authSessionVersion
  ) return bloquearTokenAcesso(token);

  return {
    ...token,
    statusUsuario: STATUS_USUARIO_ATIVO,
    authSessionVersion: estado.authSessionVersion,
    acessoBloqueado: false,
  };
}
