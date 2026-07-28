"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";

/** TODO(Fase 14 — RBAC granular): ver nota em CommissionPositions.ts. */
const ROLES_TEMPORARIAMENTE_PERMITIDOS = ["Admin", "CEO", "FINANCEIRO"];

async function exigirAcesso() {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Não autenticado" };

  const role = (session.user as { role?: string }).role ?? "";
  if (!ROLES_TEMPORARIAMENTE_PERMITIDOS.includes(role)) {
    return { ok: false as const, error: "Sem permissão" };
  }

  return { ok: true as const, userId: Number(session.user.id) };
}

const criarTarifarioSchema = z.object({
  servico: z.string().min(1),
  valorCents: z.number().int().nonnegative(),
  dataInicial: z.coerce.date(),
  dataFinal: z.coerce.date().optional(),
  formasPagamentoJson: z.string().min(1),
  descontoPadraoPercentual: z.number().min(0).max(1).optional(),
  condicoesJson: z.string().optional(),
});

/**
 * Cria um tarifário. Efeito colateral esperado (não requer alteração no detector da Fase
 * 12): assim que existir um `TariffVersion` vigente para um serviço+data, a checagem
 * "SERVICO_SEM_TARIFARIO" do `divergence-detector.ts` para de disparar automaticamente
 * (ela já consulta `TariffVersion` vigente na data do evento) — comportamento correto por
 * construção, não uma integração nova a implementar.
 */
export async function CriarTarifario(input: z.infer<typeof criarTarifarioSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = criarTarifarioSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const tarifario = await db.tariffVersion.create({ data: parsed.data });
    return { success: true, data: tarifario } as const;
  } catch (error) {
    console.error("[CriarTarifario]", error);
    return { success: false, error: "Erro interno ao criar tarifário" } as const;
  }
}

const listarTarifariosSchema = z.object({ servico: z.string().optional() });

export async function ListarTarifarios(input?: z.infer<typeof listarTarifariosSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = listarTarifariosSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const tarifarios = await db.tariffVersion.findMany({
      where: parsed.data.servico ? { servico: parsed.data.servico } : undefined,
      orderBy: { dataInicial: "desc" },
    });
    return { success: true, data: tarifarios } as const;
  } catch (error) {
    console.error("[ListarTarifarios]", error);
    return { success: false, error: "Erro interno ao listar tarifários" } as const;
  }
}

const atualizarTarifarioSchema = z.object({
  id: z.string().min(1),
  valorCents: z.number().int().nonnegative().optional(),
  dataFinal: z.coerce.date().nullable().optional(),
  formasPagamentoJson: z.string().optional(),
  descontoPadraoPercentual: z.number().min(0).max(1).nullable().optional(),
  condicoesJson: z.string().nullable().optional(),
});

export async function AtualizarTarifario(input: z.infer<typeof atualizarTarifarioSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = atualizarTarifarioSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { id, ...data } = parsed.data;

  try {
    const existente = await db.tariffVersion.findUnique({ where: { id } });
    if (!existente) return { success: false, error: "Tarifário não encontrado" } as const;

    const atualizado = await db.tariffVersion.update({ where: { id }, data });
    return { success: true, data: atualizado } as const;
  } catch (error) {
    console.error("[AtualizarTarifario]", error);
    return { success: false, error: "Erro interno ao atualizar tarifário" } as const;
  }
}
