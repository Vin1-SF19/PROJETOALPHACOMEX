import "server-only";

import { auth } from "../../../auth";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import {
  alphaSeoProjectActionSchema,
  alphaSeoProjectRoleSchema,
  canProjectRole,
  type AlphaSeoProjectAction,
  type AlphaSeoProjectRole,
} from "@/lib/alpha-seo/security";

export const ALPHA_SEO_PERMISSION = "alphaSeo";

export class AlphaSeoAccessError extends Error {
  constructor(
    public readonly code:
      | "UNAUTHENTICATED"
      | "MODULE_ACCESS_DENIED"
      | "PROJECT_ACCESS_DENIED"
      | "PROJECT_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "AlphaSeoAccessError";
  }
}

export interface AlphaSeoModuleAccess {
  userId: number;
  email: string;
  globalRole: string;
  isAdmin: boolean;
}

export interface AlphaSeoProjectAccess extends AlphaSeoModuleAccess {
  projectId: string;
  projectRole: AlphaSeoProjectRole;
  /** Alias estável para consumidores de backend já divididos por domínio. */
  role: AlphaSeoProjectRole;
  projectStatus: string;
}

export interface RequireAlphaSeoProjectAccessInput {
  projectId: string;
  /** Se informado por um fluxo interno, precisa coincidir com a sessão. Nunca autoriza por si só. */
  userId?: number;
  action?: AlphaSeoProjectAction;
  minimumRole?: AlphaSeoProjectRole;
  allowArchived?: boolean;
}

function parseSessionUserId(value: string | undefined): number {
  const userId = Number(value);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new AlphaSeoAccessError("UNAUTHENTICATED", "Sessão inválida");
  }
  return userId;
}

export async function requireAlphaSeoModuleAccess(): Promise<AlphaSeoModuleAccess> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AlphaSeoAccessError("UNAUTHENTICATED", "Não autenticado");
  }

  const userId = parseSessionUserId(session.user.id);
  const currentUser = await db.usuarios.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, status: true },
  });
  if (!currentUser || currentUser.status !== "ATIVO") {
    throw new AlphaSeoAccessError("UNAUTHENTICATED", "Usuário inativo ou inexistente");
  }

  const isAdmin = isAdminRole(currentUser.role);
  if (!isAdmin) {
    const permissions = await getPermissoesEfetivas(userId);
    if (!permissions.includes(ALPHA_SEO_PERMISSION)) {
      throw new AlphaSeoAccessError(
        "MODULE_ACCESS_DENIED",
        "Sem permissão para acessar o Alpha SEO",
      );
    }
  }

  return {
    userId,
    email: currentUser.email,
    globalRole: currentUser.role,
    isAdmin,
  };
}

const ROLE_LEVEL: Readonly<Record<AlphaSeoProjectRole, number>> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

export async function requireAlphaSeoProjectAccess(
  input: RequireAlphaSeoProjectAccessInput,
): Promise<AlphaSeoProjectAccess>;
/** Compatibilidade interna: novos consumidores devem preferir o objeto tipado. */
export async function requireAlphaSeoProjectAccess(
  projectId: string,
  action?: AlphaSeoProjectAction,
  options?: { allowArchived?: boolean },
): Promise<AlphaSeoProjectAccess>;
export async function requireAlphaSeoProjectAccess(
  inputOrProjectId: RequireAlphaSeoProjectAccessInput | string,
  positionalAction: AlphaSeoProjectAction = "project:read",
  positionalOptions: { allowArchived?: boolean } = {},
): Promise<AlphaSeoProjectAccess> {
  const input: RequireAlphaSeoProjectAccessInput =
    typeof inputOrProjectId === "string"
      ? { projectId: inputOrProjectId, action: positionalAction, ...positionalOptions }
      : inputOrProjectId;
  const projectId = input.projectId;
  const action = input.action ?? "project:read";
  const options = { allowArchived: input.allowArchived ?? false };
  const parsedProjectId = projectId.trim();
  if (!parsedProjectId) {
    throw new AlphaSeoAccessError("PROJECT_NOT_FOUND", "Projeto não encontrado");
  }
  const parsedAction = alphaSeoProjectActionSchema.parse(action);
  const moduleAccess = await requireAlphaSeoModuleAccess();
  if (input.userId !== undefined && input.userId !== moduleAccess.userId) {
    throw new AlphaSeoAccessError("PROJECT_ACCESS_DENIED", "Identidade divergente da sessão");
  }

  const project = await db.alphaSeoProject.findUnique({
    where: { id: parsedProjectId },
    select: {
      id: true,
      ownerId: true,
      status: true,
      members: {
        where: { userId: moduleAccess.userId },
        select: { role: true, active: true },
        take: 1,
      },
    },
  });
  if (!project) {
    throw new AlphaSeoAccessError("PROJECT_NOT_FOUND", "Projeto não encontrado");
  }
  if (!options.allowArchived && project.status !== "ACTIVE") {
    throw new AlphaSeoAccessError("PROJECT_NOT_FOUND", "Projeto não encontrado");
  }

  let projectRole: AlphaSeoProjectRole;
  if (moduleAccess.isAdmin || project.ownerId === moduleAccess.userId) {
    projectRole = "OWNER";
  } else {
    const membership = project.members[0];
    const role = alphaSeoProjectRoleSchema.safeParse(membership?.role);
    if (!membership?.active || !role.success) {
      throw new AlphaSeoAccessError("PROJECT_ACCESS_DENIED", "Sem acesso ao projeto");
    }
    projectRole = role.data;
  }

  if (!canProjectRole(projectRole, parsedAction)) {
    throw new AlphaSeoAccessError(
      "PROJECT_ACCESS_DENIED",
      "Seu papel não permite esta operação",
    );
  }
  if (input.minimumRole && ROLE_LEVEL[projectRole] < ROLE_LEVEL[input.minimumRole]) {
    throw new AlphaSeoAccessError(
      "PROJECT_ACCESS_DENIED",
      "Seu papel não permite esta operação",
    );
  }

  return {
    ...moduleAccess,
    projectId: project.id,
    projectRole,
    role: projectRole,
    projectStatus: project.status,
  };
}

export function alphaSeoAccessErrorMessage(error: unknown): string {
  if (error instanceof AlphaSeoAccessError) return error.message;
  return "Erro interno do Alpha SEO";
}
