"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";
import { CATEGORIAS_PERMISSAO, verificarAcessoCategoria, type CategoriaPermissao } from "@/lib/commissions/permissions";

async function exigirAcesso(categoria: CategoriaPermissao) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Não autenticado" };

  const role = (session.user as { role?: string }).role ?? "";
  const resultado = await verificarAcessoCategoria(Number(session.user.id), role, categoria);
  if (!resultado.ok) return { ok: false as const, error: resultado.error ?? "Sem permissão" };

  return { ok: true as const, userId: resultado.userId! };
}

export interface UsuarioComPermissoesRow {
  id: number;
  nome: string;
  role: string;
  permissoes: Record<CategoriaPermissao, boolean>;
}

/**
 * Gestão de RBAC granular — aba "Permissões". Só usuários com role FINANCEIRO aparecem
 * aqui de forma útil (Admin/CEO sempre têm bypass total, não precisam de configuração).
 * Usuário sem nenhuma linha em `CommissionPermission` aparece com todas as categorias
 * marcadas como permitidas (fallback aberto, decisão do usuário — nunca quebra quem já usa
 * o módulo sem aviso).
 */
export async function ListarUsuariosComPermissoes() {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  try {
    const usuarios = await db.usuarios.findMany({
      where: { status: "ATIVO", role: "FINANCEIRO" },
      select: { id: true, nome: true, role: true },
      orderBy: { nome: "asc" },
    });

    const userIds = usuarios.map((u) => u.id);
    const overrides = userIds.length > 0
      ? await db.commissionPermission.findMany({ where: { userId: { in: userIds } } })
      : [];

    const overridesPorUsuario = new Map<number, Map<string, boolean>>();
    for (const o of overrides) {
      if (!overridesPorUsuario.has(o.userId)) overridesPorUsuario.set(o.userId, new Map());
      overridesPorUsuario.get(o.userId)!.set(o.categoria, o.permitido);
    }

    const data: UsuarioComPermissoesRow[] = usuarios.map((u) => {
      const overridesDoUsuario = overridesPorUsuario.get(u.id);
      const permissoes = {} as Record<CategoriaPermissao, boolean>;
      for (const categoria of CATEGORIAS_PERMISSAO) {
        permissoes[categoria] = overridesDoUsuario?.get(categoria) ?? true;
      }
      return { id: u.id, nome: u.nome, role: u.role, permissoes };
    });

    return { success: true, data } as const;
  } catch (error) {
    console.error("[ListarUsuariosComPermissoes]", error);
    return { success: false, error: "Erro interno ao listar permissões" } as const;
  }
}

const definirPermissaoSchema = z.object({
  userId: z.number().int().positive(),
  categoria: z.enum(["VISUALIZAR", "SINCRONIZAR", "PAGAR", "APROVAR", "CONFIGURAR", "EXPORTAR"]),
  permitido: z.boolean(),
});

export async function DefinirPermissao(input: z.infer<typeof definirPermissaoSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = definirPermissaoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { userId, categoria, permitido } = parsed.data;

  try {
    const usuario = await db.usuarios.findUnique({ where: { id: userId }, select: { id: true } });
    if (!usuario) return { success: false, error: "Usuário não encontrado" } as const;

    const registro = await db.commissionPermission.upsert({
      where: { userId_categoria: { userId, categoria } },
      create: { userId, categoria, permitido },
      update: { permitido },
    });

    return { success: true, data: registro } as const;
  } catch (error) {
    console.error("[DefinirPermissao]", error);
    return { success: false, error: "Erro interno ao definir permissão" } as const;
  }
}
