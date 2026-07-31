"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";
import { verificarAcessoCategoria, type CategoriaPermissao } from "@/lib/commissions/permissions";

async function exigirAcesso(categoria: CategoriaPermissao) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Não autenticado" };

  const role = (session.user as { role?: string }).role ?? "";
  const resultado = await verificarAcessoCategoria(Number(session.user.id), role, categoria);
  if (!resultado.ok) return { ok: false as const, error: resultado.error ?? "Sem permissão" };

  return { ok: true as const, userId: resultado.userId! };
}

const tipoOverrideSchema = z.enum(["BLOQUEIO", "SUBSTITUICAO", "PERCENTUAL_ESPECIFICO", "VALOR_ESPECIFICO", "EXCLUSAO"]);

const criarEligibilityOverrideSchema = z
  .object({
    collaboratorId: z.number().int().positive().optional(),
    cargoId: z.number().int().positive().optional(),
    clienteId: z.number().int().positive().optional(),
    contratoComercialId: z.string().min(1).optional(),
    servico: z.string().min(1).optional(),
    eventType: z.string().min(1).optional(),
    dataInicial: z.coerce.date().optional(),
    dataFinal: z.coerce.date().optional(),
    tipo: tipoOverrideSchema,
    percentualEspecifico: z.number().min(0).max(1).optional(),
    valorEspecificoCents: z.number().int().nonnegative().optional(),
    justificativa: z.string().min(1, "Justificativa é obrigatória"),
    prioridade: z.number().int().default(0),
    approvalRequired: z.boolean().default(false),
  })
  .refine(
    (data) => data.collaboratorId || data.cargoId || data.clienteId || data.contratoComercialId || data.servico || data.eventType,
    { message: "Ao menos um escopo (colaborador, cargo, empresa, contrato, serviço ou evento) deve ser informado." },
  );

export async function CriarEligibilityOverride(input: z.infer<typeof criarEligibilityOverrideSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = criarEligibilityOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const override = await db.eligibilityOverride.create({
      data: { ...parsed.data, createdById: acesso.userId },
    });

    return { success: true, data: override } as const;
  } catch (error) {
    console.error("[CriarEligibilityOverride]", error);
    return { success: false, error: "Erro interno ao criar exceção" } as const;
  }
}

export async function ListarEligibilityOverrides(filtro?: { collaboratorId?: number; cargoId?: number }) {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  try {
    const overrides = await db.eligibilityOverride.findMany({
      where: {
        ...(filtro?.collaboratorId ? { collaboratorId: filtro.collaboratorId } : {}),
        ...(filtro?.cargoId ? { cargoId: filtro.cargoId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return { success: true, data: overrides } as const;
  } catch (error) {
    console.error("[ListarEligibilityOverrides]", error);
    return { success: false, error: "Erro interno ao listar exceções" } as const;
  }
}

const atualizarEligibilityOverrideSchema = z.object({
  id: z.string().min(1),
  collaboratorId: z.number().int().positive().nullable().optional(),
  cargoId: z.number().int().positive().nullable().optional(),
  clienteId: z.number().int().positive().nullable().optional(),
  contratoComercialId: z.string().min(1).nullable().optional(),
  servico: z.string().min(1).nullable().optional(),
  eventType: z.string().min(1).nullable().optional(),
  dataInicial: z.coerce.date().nullable().optional(),
  dataFinal: z.coerce.date().nullable().optional(),
  tipo: tipoOverrideSchema.optional(),
  percentualEspecifico: z.number().min(0).max(1).nullable().optional(),
  valorEspecificoCents: z.number().int().nonnegative().nullable().optional(),
  aprovadoEm: z.coerce.date().optional(),
  justificativa: z.string().min(1).optional(),
  prioridade: z.number().int().optional(),
  approvalRequired: z.boolean().optional(),
});

export async function AtualizarEligibilityOverride(input: z.infer<typeof atualizarEligibilityOverrideSchema>) {
  const parsed = atualizarEligibilityOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { id, ...data } = parsed.data;
  const camposDeEdicao = Object.keys(data).filter((campo) => campo !== "aprovadoEm");
  const acesso = await exigirAcesso(camposDeEdicao.length > 0 ? "CONFIGURAR" : "APROVAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  try {
    const existente = await db.eligibilityOverride.findUnique({ where: { id } });
    if (!existente) return { success: false, error: "Exceção não encontrada" } as const;

    const proximo = { ...existente, ...data };
    if (
      !proximo.collaboratorId &&
      !proximo.cargoId &&
      !proximo.clienteId &&
      !proximo.contratoComercialId &&
      !proximo.servico &&
      !proximo.eventType
    ) {
      return { success: false, error: "A exceção precisa manter ao menos um escopo." } as const;
    }

    const atualizado = await db.eligibilityOverride.update({
      where: { id },
      data: {
        ...data,
        ...(camposDeEdicao.length > 0 && existente.approvalRequired
          ? { aprovadoEm: null, aprovadoById: null }
          : { aprovadoById: data.aprovadoEm ? acesso.userId : undefined }),
      },
    });

    return { success: true, data: atualizado } as const;
  } catch (error) {
    console.error("[AtualizarEligibilityOverride]", error);
    return { success: false, error: "Erro interno ao atualizar exceção" } as const;
  }
}

const excluirEligibilityOverrideSchema = z.object({ id: z.string().min(1) });

export async function ExcluirEligibilityOverride(input: z.infer<typeof excluirEligibilityOverrideSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = excluirEligibilityOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const existente = await db.eligibilityOverride.findUnique({ where: { id: parsed.data.id }, select: { id: true } });
    if (!existente) return { success: false, error: "Exceção não encontrada" } as const;

    await db.eligibilityOverride.delete({ where: { id: parsed.data.id } });
    return { success: true } as const;
  } catch (error) {
    console.error("[ExcluirEligibilityOverride]", error);
    return { success: false, error: "Erro interno ao excluir exceção" } as const;
  }
}
