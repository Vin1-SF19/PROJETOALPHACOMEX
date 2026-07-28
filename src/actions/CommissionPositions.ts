"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";

/**
 * TODO(Fase 14 — RBAC granular, ver nota no final deste arquivo): mesma verificação de
 * role temporária documentada em `src/actions/CommissionSync.ts`.
 */
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

const vinculoPadraoSchema = z.enum(["CLT", "PJ"]);
const naturezaRecebimentoSchema = z.enum(["COMISSAO", "PREMIO", "AMBOS"]);

export async function ListarCargos() {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  try {
    const cargos = await db.cargoColaborador.findMany({
      orderBy: { nome: "asc" },
    });

    const setorIds = cargos.map((c) => c.setorId).filter((id): id is number => id !== null);
    const setores = setorIds.length > 0
      ? await db.setor.findMany({ where: { id: { in: setorIds } }, select: { id: true, nome: true } })
      : [];
    const setorPorId = new Map(setores.map((s) => [s.id, s.nome]));

    const data = cargos.map((cargo) => ({
      ...cargo,
      setorNome: cargo.setorId ? setorPorId.get(cargo.setorId) ?? null : null,
    }));

    return { success: true, data } as const;
  } catch (error) {
    console.error("[ListarCargos]", error);
    return { success: false, error: "Erro interno ao listar cargos" } as const;
  }
}

const criarCargoSchema = z.object({
  nome: z.string().min(1),
  setorId: z.number().int().positive().optional(),
  vinculoPadrao: vinculoPadraoSchema.optional(),
  naturezaRecebimento: naturezaRecebimentoSchema.optional(),
  permiteMultiplosOcupantes: z.boolean().default(true),
});

export async function CriarCargo(input: z.infer<typeof criarCargoSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = criarCargoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const existente = await db.cargoColaborador.findUnique({ where: { nome: parsed.data.nome } });
    if (existente) return { success: false, error: "Já existe um cargo com esse nome" } as const;

    const cargo = await db.cargoColaborador.create({ data: parsed.data });
    return { success: true, data: cargo } as const;
  } catch (error) {
    console.error("[CriarCargo]", error);
    return { success: false, error: "Erro interno ao criar cargo" } as const;
  }
}

const atualizarCargoSchema = z.object({
  id: z.number().int().positive(),
  setorId: z.number().int().positive().nullable().optional(),
  vinculoPadrao: vinculoPadraoSchema.nullable().optional(),
  naturezaRecebimento: naturezaRecebimentoSchema.nullable().optional(),
  permiteMultiplosOcupantes: z.boolean().optional(),
});

export async function AtualizarCargo(input: z.infer<typeof atualizarCargoSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = atualizarCargoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { id, ...data } = parsed.data;

  try {
    const existente = await db.cargoColaborador.findUnique({ where: { id } });
    if (!existente) return { success: false, error: "Cargo não encontrado" } as const;

    const atualizado = await db.cargoColaborador.update({ where: { id }, data });
    return { success: true, data: atualizado } as const;
  } catch (error) {
    console.error("[AtualizarCargo]", error);
    return { success: false, error: "Erro interno ao atualizar cargo" } as const;
  }
}

const inativarCargoSchema = z.object({ id: z.number().int().positive() });

/** Nunca DELETE físico — usa o campo `ativo` já existente em CargoColaborador. */
export async function InativarCargo(input: z.infer<typeof inativarCargoSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = inativarCargoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const existente = await db.cargoColaborador.findUnique({ where: { id: parsed.data.id } });
    if (!existente) return { success: false, error: "Cargo não encontrado" } as const;

    const atualizado = await db.cargoColaborador.update({
      where: { id: parsed.data.id },
      data: { ativo: false },
    });
    return { success: true, data: atualizado } as const;
  } catch (error) {
    console.error("[InativarCargo]", error);
    return { success: false, error: "Erro interno ao inativar cargo" } as const;
  }
}

/**
 * ─── NOTA SOBRE RBAC GRANULAR (seção 32 do prompt original) ───
 *
 * O prompt pede permissões finas por AÇÃO dentro do módulo (visualizar todos/próprios,
 * criar regras, publicar regras, ajustar, aprovar ajuste, pagar, estornar, exportar, ver
 * dados sensíveis, reprocessar integração, consultar auditoria).
 *
 * O sistema de RBAC real do projeto (`src/actions/PermissoesSetor.ts`,
 * `getPermissoesEfetivas`) opera em granularidade de MÓDULO INTEIRO por setor
 * (`SetorPermissao { setor, modulo }`, unique) + overrides individuais por usuário
 * (`UsuarioPermissaoOverride { usuarioId, modulo, acao: "ADD"|"REMOVE" }`) — não existe
 * hoje o conceito de "ação dentro de um módulo", só "tem ou não tem acesso ao módulo".
 *
 * Duas abordagens possíveis para atender a seção 32 sem inventar um sistema paralelo:
 * (a) Registrar cada ação granular como um "módulo" próprio no MODULOS_REGISTRY/
 *     SetorPermissao (ex: `comissoes.criar_regras`, `comissoes.publicar_regras`,
 *     `comissoes.pagar` como strings de módulo distintas) — reaproveita 100% da
 *     infraestrutura existente, mas "polui" o conceito de módulo com sub-permissões.
 * (b) Estender o schema com uma tabela nova de permissão granular por módulo
 *     (ex: `CommissionPermission { userId, acao }`) — mais correto semanticamente, mas
 *     é infraestrutura NOVA que precisa passar pelo Vault e não foi aprovada ainda.
 *
 * Esta fase NÃO implementa nenhuma das duas — mantém o gate temporário por role
 * (`ROLES_TEMPORARIAMENTE_PERMITIDOS`) em todas as actions do módulo. Decisão de qual
 * abordagem seguir fica para quando o usuário priorizar RBAC granular explicitamente.
 */
