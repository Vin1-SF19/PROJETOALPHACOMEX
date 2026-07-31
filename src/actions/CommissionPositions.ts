"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";
import { resolverVinculoNaData } from "@/lib/commissions/vinculo-resolver";
import type { ContratoColaboradorRecord } from "@/lib/commissions/vinculo-resolver";
import { verificarAcessoCategoria, type CategoriaPermissao } from "@/lib/commissions/permissions";

async function exigirAcesso(categoria: CategoriaPermissao) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Não autenticado" };

  const role = (session.user as { role?: string }).role ?? "";
  const resultado = await verificarAcessoCategoria(Number(session.user.id), role, categoria);
  if (!resultado.ok) return { ok: false as const, error: resultado.error ?? "Sem permissão" };

  return { ok: true as const, userId: resultado.userId! };
}

const vinculoPadraoSchema = z.enum(["CLT", "PJ"]);
const naturezaRecebimentoSchema = z.enum(["COMISSAO", "PREMIO", "AMBOS"]);

/** Setores ativos — usado para popular o formulário de cargos em Configurações. */
export async function ListarSetores() {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  try {
    const setores = await db.setor.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    });
    return { success: true, data: setores } as const;
  } catch (error) {
    console.error("[ListarSetores]", error);
    return { success: false, error: "Erro interno ao listar setores" } as const;
  }
}

export async function ListarCargos() {
  const acesso = await exigirAcesso("VISUALIZAR");
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

    const usuarios = await db.usuarios.findMany({
      where: { status: "ATIVO", cargo: { not: null } },
      select: { cargo: true, role: true },
    });
    const rolesPorCargo = new Map<string, Set<string>>();
    for (const usuario of usuarios) {
      const cargoNormalizado = usuario.cargo?.trim().toLocaleLowerCase("pt-BR");
      const role = usuario.role?.trim();
      if (!cargoNormalizado || !role) continue;
      if (!rolesPorCargo.has(cargoNormalizado)) rolesPorCargo.set(cargoNormalizado, new Set());
      rolesPorCargo.get(cargoNormalizado)!.add(role);
    }

    const data = cargos.map((cargo) => ({
      ...cargo,
      setoresPorRole: [...(rolesPorCargo.get(cargo.nome.trim().toLocaleLowerCase("pt-BR")) ?? [])].sort(),
      setorNome:
        [...(rolesPorCargo.get(cargo.nome.trim().toLocaleLowerCase("pt-BR")) ?? [])].sort().join(" / ") ||
        (cargo.setorId ? setorPorId.get(cargo.setorId) ?? null : null),
      setorOrigem: rolesPorCargo.has(cargo.nome.trim().toLocaleLowerCase("pt-BR")) ? "USUARIOS_ROLE" : cargo.setorId ? "CARGO" : null,
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
  const acesso = await exigirAcesso("CONFIGURAR");
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
  nome: z.string().min(1).optional(),
  setorId: z.number().int().positive().nullable().optional(),
  vinculoPadrao: vinculoPadraoSchema.nullable().optional(),
  naturezaRecebimento: naturezaRecebimentoSchema.nullable().optional(),
  permiteMultiplosOcupantes: z.boolean().optional(),
});

export async function AtualizarCargo(input: z.infer<typeof atualizarCargoSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = atualizarCargoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { id, ...data } = parsed.data;

  try {
    const existente = await db.cargoColaborador.findUnique({ where: { id } });
    if (!existente) return { success: false, error: "Cargo não encontrado" } as const;

    if (data.nome && data.nome !== existente.nome) {
      const nomeEmUso = await db.cargoColaborador.findUnique({ where: { nome: data.nome } });
      if (nomeEmUso) return { success: false, error: "Já existe um cargo com esse nome" } as const;

      const ocupantes = await db.usuarios.count({ where: { cargo: existente.nome } });
      if (ocupantes > 0) {
        return {
          success: false,
          error: "Este cargo possui colaboradores vinculados. Ajuste o nome pela Gestão de Colaboradores para não quebrar os vínculos existentes.",
        } as const;
      }
    }

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
  return AlterarStatusCargo({ ...input, ativo: false });
}

const alterarStatusCargoSchema = inativarCargoSchema.extend({ ativo: z.boolean() });

export async function AlterarStatusCargo(input: z.infer<typeof alterarStatusCargoSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = alterarStatusCargoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const existente = await db.cargoColaborador.findUnique({ where: { id: parsed.data.id } });
    if (!existente) return { success: false, error: "Cargo não encontrado" } as const;

    const atualizado = await db.cargoColaborador.update({
      where: { id: parsed.data.id },
      data: { ativo: parsed.data.ativo },
    });
    return { success: true, data: atualizado } as const;
  } catch (error) {
    console.error("[AlterarStatusCargo]", error);
    return { success: false, error: `Erro interno ao ${parsed.data.ativo ? "reativar" : "inativar"} cargo` } as const;
  }
}

export async function ReativarCargo(input: z.infer<typeof inativarCargoSchema>) {
  return AlterarStatusCargo({ ...input, ativo: true });
}

export interface ColaboradorComissaoRow {
  id: number;
  nome: string;
  cargo: string | null;
  setorNome: string | null;
  vinculo: "CLT" | "PJ" | null;
  vinculoDivergente: string | null;
}

/**
 * Painel de consulta (somente leitura) para a aba "Colaboradores" — mostra cargo/setor/
 * vínculo relevante para o cálculo de comissão. Edição de cadastro continua no módulo
 * Gestão de Colaboradores (fora deste módulo, decisão do usuário). Vínculo é resolvido
 * NA DATA DE HOJE via `ContratoColaborador` — hoje essa tabela está vazia em produção
 * (0 linhas confirmadas), então a maioria aparecerá como "sem vínculo cadastrado", o que
 * é esperado, não um bug.
 */
export async function ListarColaboradoresParaComissoes() {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  try {
    const usuarios = await db.usuarios.findMany({
      where: { status: "ATIVO" },
      select: { id: true, nome: true, cargo: true, role: true },
      orderBy: { nome: "asc" },
    });

    const cargoNomes = [...new Set(usuarios.map((u) => u.cargo).filter((c): c is string => !!c))];
    const cargos = cargoNomes.length > 0
      ? await db.cargoColaborador.findMany({ where: { nome: { in: cargoNomes } }, select: { nome: true, setorId: true } })
      : [];
    const setorIdPorCargo = new Map(cargos.map((c) => [c.nome, c.setorId]));

    const setorIds = [...new Set(cargos.map((c) => c.setorId).filter((id): id is number => id !== null))];
    const setores = setorIds.length > 0
      ? await db.setor.findMany({ where: { id: { in: setorIds } }, select: { id: true, nome: true } })
      : [];
    const setorNomePorId = new Map(setores.map((s) => [s.id, s.nome]));

    const data: ColaboradorComissaoRow[] = [];
    const hoje = new Date();

    for (const usuario of usuarios) {
      const contratos = await db.contratoColaborador.findMany({
        where: { usuarioId: usuario.id },
        select: { id: true, usuarioId: true, tipo: true, dataInicio: true, dataFim: true },
      });

      const resolucao = resolverVinculoNaData(contratos as ContratoColaboradorRecord[], usuario.id, hoje);
      const setorId = usuario.cargo ? setorIdPorCargo.get(usuario.cargo) ?? null : null;
      const setorNome = usuario.role?.trim() || (setorId ? setorNomePorId.get(setorId) ?? null : null);

      data.push({
        id: usuario.id,
        nome: usuario.nome,
        cargo: usuario.cargo,
        setorNome,
        vinculo: resolucao.status === "RESOLVIDO" ? resolucao.vinculo : null,
        vinculoDivergente: resolucao.status !== "RESOLVIDO" ? resolucao.status : null,
      });
    }

    return { success: true, data } as const;
  } catch (error) {
    console.error("[ListarColaboradoresParaComissoes]", error);
    return { success: false, error: "Erro interno ao listar colaboradores" } as const;
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
