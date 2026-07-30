"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";
import { sincronizarComissoes } from "@/lib/commissions/sync-engine";
import { verificarAcessoCategoria, type CategoriaPermissao } from "@/lib/commissions/permissions";

async function exigirAcesso(categoria: CategoriaPermissao) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Não autenticado" };

  const role = (session.user as { role?: string }).role ?? "";
  const resultado = await verificarAcessoCategoria(Number(session.user.id), role, categoria);
  if (!resultado.ok) return { ok: false as const, error: resultado.error ?? "Sem permissão" };

  return { ok: true as const, userId: resultado.userId! };
}

const sincronizarSchema = z.object({
  triggeredBy: z.enum(["manual", "scheduled"]).default("manual"),
});

export async function SincronizarComissoes(input?: { triggeredBy?: "manual" | "scheduled" }) {
  const acesso = await exigirAcesso("SINCRONIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = sincronizarSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const result = await sincronizarComissoes({
      triggeredBy: parsed.data.triggeredBy,
      triggeredById: acesso.userId,
    });

    return { success: true, data: result } as const;
  } catch (error) {
    console.error("[SincronizarComissoes]", error);
    return { success: false, error: "Erro interno ao sincronizar" } as const;
  }
}

/** Histórico de sincronizações — aba "Integrações" das Configurações, somente leitura. */
export async function ListarSyncRuns(input?: { page?: number; pageSize?: number }) {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const page = input?.page ?? 1;
  const pageSize = Math.min(input?.pageSize ?? 25, 100);

  try {
    const [data, total] = await Promise.all([
      db.syncRun.findMany({
        include: { erros: true },
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.syncRun.count(),
    ]);

    return {
      success: true,
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    } as const;
  } catch (error) {
    console.error("[ListarSyncRuns]", error);
    return { success: false, error: "Erro interno ao listar sincronizações" } as const;
  }
}
