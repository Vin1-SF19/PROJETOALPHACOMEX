"use server";

import { auth } from "../../auth";
import { z } from "zod";
import { sincronizarComissoes } from "@/lib/commissions/sync-engine";

/**
 * TODO(Fase 14 — Configurações/RBAC granular): esta verificação de role hardcoded é
 * temporária. O módulo de Comissões ainda não está registrado em `modulos-registry.ts`
 * (isso é Fase 09) nem tem as permissões granulares da seção 32 do prompt original
 * (visualizar todos/próprios, criar regras, publicar, pagar, estornar, exportar, etc.).
 * Substituir por `getPermissoesEfetivas(userId)` + permissão específica assim que o RBAC
 * granular do módulo existir.
 */
const ROLES_TEMPORARIAMENTE_PERMITIDOS = ["Admin", "CEO", "FINANCEIRO"];

const sincronizarSchema = z.object({
  triggeredBy: z.enum(["manual", "scheduled"]).default("manual"),
});

export async function SincronizarComissoes(input?: { triggeredBy?: "manual" | "scheduled" }) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Não autenticado" } as const;
  }

  const roleNormalizada = (session.user as { role?: string }).role ?? "";
  if (!ROLES_TEMPORARIAMENTE_PERMITIDOS.includes(roleNormalizada)) {
    return { success: false, error: "Sem permissão" } as const;
  }

  const parsed = sincronizarSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const result = await sincronizarComissoes({
      triggeredBy: parsed.data.triggeredBy,
      triggeredById: Number(session.user.id),
    });

    return { success: true, data: result } as const;
  } catch (error) {
    console.error("[SincronizarComissoes]", error);
    return { success: false, error: "Erro interno ao sincronizar" } as const;
  }
}
