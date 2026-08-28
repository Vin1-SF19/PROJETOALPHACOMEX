"use server";

// Links Externos — gaveta "Sistema Externo" na sidebar. Admin/CEO/TI cadastram
// via modal; visibilidade por link é controlada por `visivelPara` (role/setor).

import db from "@/lib/prisma";
import { auth } from "../../auth";
import { isAdminRole } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { LinkExternoSchema, type LinkExternoInput } from "@/lib/validations/link-externo";

interface LinkExternoCtx {
  userId: number;
  role: string;
  isAdmin: boolean;
}

async function getCtx(): Promise<LinkExternoCtx | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = (session.user as { role?: string }).role ?? "";
  return { userId, role, isAdmin: isAdminRole(role) };
}

export interface LinkExternoVisivel {
  id: string;
  label: string;
  url: string;
  iconName: string;
}

/** Lista os links visíveis para o usuário autenticado — filtro de visibilidade é sempre no server. */
export async function ListarLinksExternosVisiveis(): Promise<LinkExternoVisivel[]> {
  const ctx = await getCtx();
  if (!ctx) return [];

  const links = await db.linkExterno.findMany({
    where: { ativo: true },
    select: { id: true, label: true, url: true, iconName: true, visivelPara: true },
    orderBy: { ordem: "asc" },
  });

  const visiveis = ctx.isAdmin
    ? links
    : links.filter((link) => link.visivelPara === "TODOS" || link.visivelPara.split(",").map((r) => r.trim()).includes(ctx.role));

  return visiveis.map((link) => ({ id: link.id, label: link.label, url: link.url, iconName: link.iconName }));
}

/** Lista todos os links ativos e inativos, com metadados completos — só para a UI de gestão (Admin/CEO/TI). */
export async function ListarLinksExternosGestao() {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return { success: false as const, error: "Sem permissão" };

  const links = await db.linkExterno.findMany({
    orderBy: { ordem: "asc" },
  });

  return { success: true as const, links };
}

export async function CriarLinkExterno(input: LinkExternoInput) {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return { success: false as const, error: "Sem permissão" };

  const parsed = LinkExternoSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const totalAtual = await db.linkExterno.count();

  const link = await db.linkExterno.create({
    data: { ...parsed.data, ordem: totalAtual, criadoPorId: ctx.userId },
  });

  revalidatePath("/PainelAlpha");
  return { success: true as const, link };
}

export async function AtualizarLinkExterno(id: string, input: LinkExternoInput) {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return { success: false as const, error: "Sem permissão" };

  const parsed = LinkExternoSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const existente = await db.linkExterno.findUnique({ where: { id }, select: { id: true } });
  if (!existente) return { success: false as const, error: "Link não encontrado" };

  const link = await db.linkExterno.update({
    where: { id },
    data: parsed.data,
  });

  revalidatePath("/PainelAlpha");
  return { success: true as const, link };
}

export async function ExcluirLinkExterno(id: string) {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return { success: false as const, error: "Sem permissão" };

  const existente = await db.linkExterno.findUnique({ where: { id }, select: { id: true } });
  if (!existente) return { success: false as const, error: "Link não encontrado" };

  await db.linkExterno.delete({ where: { id } });

  revalidatePath("/PainelAlpha");
  return { success: true as const };
}

