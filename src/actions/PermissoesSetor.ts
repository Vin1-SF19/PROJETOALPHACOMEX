'use server';

import { auth } from '../../auth';
import { isAdminRole } from '@/lib/roles';
import { z } from 'zod';
import db from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { MODULOS_REGISTRY } from '@/lib/modulos-registry';

const KNOWN_MODULOS = new Set([
  ...(MODULOS_REGISTRY.map(m => m.permission).filter(Boolean) as string[]),
  "roadmapProduction",
]);

async function requireAdminSession() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? '';
  if (!isAdminRole(role)) throw new Error('Não autorizado');
  return session!;
}

// ── Fonte única de verdade ─────────────────────────────────────────────────────
export async function getPermissoesEfetivas(usuarioId: number): Promise<string[]> {
  const user = await db.usuarios.findUnique({
    where: { id: usuarioId },
    select: { role: true, permissoes: true },
  });
  if (!user) return [];

  if (isAdminRole(user.role)) return Array.from(KNOWN_MODULOS);

  const setorPerms = await db.setorPermissao.findMany({
    where: { setor: user.role },
    select: { modulo: true },
  });

  // If sector has no config yet, fall back to legacy permissoes column
  const base: Set<string> =
    setorPerms.length > 0
      ? new Set(setorPerms.map(p => p.modulo))
      : new Set((user.permissoes ?? '').split(',').filter(Boolean));

  const overrides = await db.usuarioPermissaoOverride.findMany({
    where: { usuarioId },
    select: { modulo: true, acao: true },
  });
  for (const o of overrides) {
    if (o.acao === 'ADD') base.add(o.modulo);
    else if (o.acao === 'REMOVE') base.delete(o.modulo);
  }

  return Array.from(base);
}

// ── Setor: listar permissões ───────────────────────────────────────────────────
export async function listarPermissoesPorSetor(setor: string): Promise<string[]> {
  const rows = await db.setorPermissao.findMany({
    where: { setor },
    select: { modulo: true },
  });
  return rows.map(r => r.modulo);
}

// ── Setor: atribuir módulos ────────────────────────────────────────────────────
const atribuirSchema = z.object({
  setor: z.string().min(1),
  modulos: z.array(z.string().refine(m => KNOWN_MODULOS.has(m), { message: 'Módulo desconhecido' })),
});

export async function atribuirModulosAoSetor(payload: unknown) {
  await requireAdminSession();

  const result = atribuirSchema.safeParse(payload);
  if (!result.success) return { success: false, error: result.error.flatten() };

  const { setor, modulos } = result.data;

  await db.$transaction([
    db.setorPermissao.deleteMany({ where: { setor } }),
    db.setorPermissao.createMany({
      data: modulos.map(m => ({ setor, modulo: m })),
    }),
  ]);

  const afetados = await db.usuarios.count({ where: { role: setor } });
  revalidatePath('/PainelAlpha/cadastro');
  return { success: true, afetados };
}

// ── Override: listar efetivos de um user ──────────────────────────────────────
export async function listarOverridesDeUser(usuarioId: number) {
  return db.usuarioPermissaoOverride.findMany({
    where: { usuarioId },
    select: { id: true, modulo: true, acao: true, motivo: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Override: adicionar ───────────────────────────────────────────────────────
const overrideSchema = z.object({
  usuarioId: z.number().int().positive(),
  modulo: z.string().refine(m => KNOWN_MODULOS.has(m), { message: 'Módulo desconhecido' }),
  acao: z.enum(['ADD', 'REMOVE']),
  motivo: z.string().optional(),
});

export async function adicionarOverride(payload: unknown) {
  const session = await requireAdminSession();
  const adminId = Number((session.user as { id?: string })?.id ?? 0);

  const result = overrideSchema.safeParse(payload);
  if (!result.success) return { success: false, error: result.error.flatten() };

  const { usuarioId, modulo, acao, motivo } = result.data;

  await db.usuarioPermissaoOverride.upsert({
    where: { usuarioId_modulo: { usuarioId, modulo } },
    create: { usuarioId, modulo, acao, motivo, criadoPor: adminId },
    update: { acao, motivo, criadoPor: adminId },
  });

  revalidatePath('/PainelAlpha/cadastro');
  return { success: true };
}

// ── Override: remover ─────────────────────────────────────────────────────────
export async function removerOverride(overrideId: number) {
  await requireAdminSession();
  await db.usuarioPermissaoOverride.delete({ where: { id: overrideId } });
  revalidatePath('/PainelAlpha/cadastro');
  return { success: true };
}

// ── Override: resetar user pro padrão do setor ───────────────────────────────
export async function resetarUserParaSetor(usuarioId: number) {
  await requireAdminSession();
  await db.usuarioPermissaoOverride.deleteMany({ where: { usuarioId } });
  revalidatePath('/PainelAlpha/cadastro');
  return { success: true };
}

// ── Listar users com permissões efetivas ──────────────────────────────────────
export async function listarUsersParaGestao() {
  const users = await db.usuarios.findMany({
    select: {
      id: true,
      nome: true,
      usuario: true,
      email: true,
      role: true,
      imagemUrl: true,
      status: true,
      permissaoOverrides: { select: { modulo: true, acao: true } },
    },
    orderBy: { nome: 'asc' },
  });
  return users;
}

// ── Listar usuários e seus acessos a um módulo específico ────────────────────
export async function listarAcessoModulo(modulo: string) {
  await requireAdminSession();
  return db.usuarios.findMany({
    select: {
      id: true,
      nome: true,
      usuario: true,
      role: true,
      imagemUrl: true,
      status: true,
      permissaoOverrides: {
        where: { modulo },
        select: { id: true, acao: true },
      },
    },
    orderBy: [{ role: 'asc' }, { nome: 'asc' }],
  });
}

// ── Toggle de acesso de um usuário a um módulo ────────────────────────────────
export async function toggleAcessoModulo(usuarioId: number, modulo: string) {
  const session = await requireAdminSession();
  const adminId = Number((session.user as { id?: string })?.id ?? 0);

  if (!KNOWN_MODULOS.has(modulo)) return { success: false as const, error: 'Módulo desconhecido' };

  const existing = await db.usuarioPermissaoOverride.findUnique({
    where: { usuarioId_modulo: { usuarioId, modulo } },
  });

  if (existing?.acao === 'ADD') {
    await db.usuarioPermissaoOverride.delete({ where: { id: existing.id } });
    revalidatePath('/PainelAlpha/AlphaSkills/Gerenciamento');
    revalidatePath('/PainelAlpha/Roadmap');
    return { success: true as const, hasAccess: false };
  }

  await db.usuarioPermissaoOverride.upsert({
    where: { usuarioId_modulo: { usuarioId, modulo } },
    create: { usuarioId, modulo, acao: 'ADD', criadoPor: adminId },
    update: { acao: 'ADD', criadoPor: adminId },
  });
  revalidatePath('/PainelAlpha/AlphaSkills/Gerenciamento');
  revalidatePath('/PainelAlpha/Roadmap');
  return { success: true as const, hasAccess: true };
}

// ── Listar módulos efetivos de um user específico ────────────────────────────
export async function listarModulosEfetivosDeUser(usuarioId: number) {
  const user = await db.usuarios.findUnique({
    where: { id: usuarioId },
    select: { role: true, permissaoOverrides: { select: { modulo: true, acao: true, id: true, motivo: true } } },
  });
  if (!user) return { setorModulos: [], overrides: [], efetivos: [] };

  const setorPerms = await db.setorPermissao.findMany({
    where: { setor: user.role },
    select: { modulo: true },
  });
  const setorModulos = setorPerms.map(p => p.modulo);
  const efetivos = await getPermissoesEfetivas(usuarioId);

  return {
    setorModulos,
    overrides: user.permissaoOverrides,
    efetivos,
  };
}
