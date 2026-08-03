"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import {
  criarApresentacaoSchema,
  atualizarStatusSchema,
} from "@/lib/validations/apresentacao";
import { isAdminRole } from "@/lib/roles";

function isAdmin(role?: string) {
  return isAdminRole(role);
}

export async function ListarApresentacoes(params?: { page?: number; pageSize?: number; busca?: string }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };

    const userId = Number(session.user.id);
    const page = params?.page && params.page > 0 ? params.page : 1;
    const pageSize = params?.pageSize && params.pageSize > 0 ? Math.min(Math.max(params.pageSize, 1), 100) : 20;
    const busca = params?.busca?.trim();

    const acesso = isAdmin(session.user.role)
      ? {}
      : {
          OR: [
            { autorId: userId },
            { colaboradores: { some: { userId } } },
          ],
        };

    const where = busca
      ? {
          AND: [
            acesso,
            {
              OR: [
                { titulo: { contains: busca } },
                { clienteNome: { contains: busca } },
              ],
            },
          ],
        }
      : acesso;

    const [dados, total] = await Promise.all([
      db.apresentacao.findMany({
        where,
        select: {
          id: true,
          titulo: true,
          clienteNome: true,
          status: true,
          thumbnailUrl: true,
          slugPublico: true,
          createdAt: true,
          updatedAt: true,
          autor: { select: { id: true, nome: true } },
          _count: { select: { slides: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.apresentacao.count({ where }),
    ]);

    return {
      success: true,
      data: dados,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      error: null,
    };
  } catch (error) {
    console.error("[ListarApresentacoes]", error);
    return { success: false, data: [], error: "Erro ao buscar apresentações" };
  }
}

export async function CriarApresentacao(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const parsed = criarApresentacaoSchema.safeParse(dados);
    if (!parsed.success) {
      return { success: false, error: parsed.error.flatten().fieldErrors };
    }
    const input = parsed.data;
    const userId = Number(session.user.id);

    const apresentacao = await db.apresentacao.create({
      data: {
        titulo: input.titulo,
        clienteNome: input.clienteNome || null,
        autorId: userId,
        status: "DRAFT",
        slides: {
          create: {
            ordem: 0,
            nome: "Slide 1",
            dadosJson: { componentes: [] },
          },
        },
      },
      select: { id: true },
    });

    revalidatePath("/PainelAlpha/Apresentacoes");
    return { success: true, data: apresentacao };
  } catch (error) {
    console.error("[CriarApresentacao]", error);
    return { success: false, error: "Erro ao criar apresentação" };
  }
}

export async function DuplicarApresentacao(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const userId = Number(session.user.id);
    const original = await db.apresentacao.findUnique({
      where: { id },
      include: { slides: true },
    });
    if (!original) return { success: false, error: "Apresentação não encontrada" };
    if (original.autorId !== userId && !isAdmin(session.user.role)) {
      return { success: false, error: "Sem permissão" };
    }

    const copia = await db.apresentacao.create({
      data: {
        titulo: `${original.titulo} (cópia)`,
        clienteNome: original.clienteNome,
        autorId: userId,
        status: "DRAFT",
        temaId: original.temaId,
        slides: {
          create: original.slides.map((s) => ({
            ordem: s.ordem,
            nome: s.nome,
            transicaoEntrada: s.transicaoEntrada,
            duracaoAutoplay: s.duracaoAutoplay,
            dadosJson: s.dadosJson as object,
          })),
        },
      },
      select: { id: true },
    });

    revalidatePath("/PainelAlpha/Apresentacoes");
    return { success: true, data: copia };
  } catch (error) {
    console.error("[DuplicarApresentacao]", error);
    return { success: false, error: "Erro ao duplicar apresentação" };
  }
}

export async function ExcluirApresentacao(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const userId = Number(session.user.id);
    const apresentacao = await db.apresentacao.findUnique({
      where: { id },
      select: { autorId: true },
    });
    if (!apresentacao) return { success: false, error: "Apresentação não encontrada" };
    if (apresentacao.autorId !== userId && !isAdmin(session.user.role)) {
      return { success: false, error: "Sem permissão" };
    }

    await db.apresentacao.delete({ where: { id } });

    revalidatePath("/PainelAlpha/Apresentacoes");
    return { success: true };
  } catch (error) {
    console.error("[ExcluirApresentacao]", error);
    return { success: false, error: "Erro ao excluir apresentação" };
  }
}

export async function AtualizarStatusApresentacao(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const parsed = atualizarStatusSchema.safeParse(dados);
    if (!parsed.success) {
      return { success: false, error: parsed.error.flatten().fieldErrors };
    }
    const { id, status } = parsed.data;
    const userId = Number(session.user.id);

    const apresentacao = await db.apresentacao.findUnique({
      where: { id },
      select: { autorId: true },
    });
    if (!apresentacao) return { success: false, error: "Apresentação não encontrada" };
    if (apresentacao.autorId !== userId && !isAdmin(session.user.role)) {
      return { success: false, error: "Sem permissão" };
    }

    await db.apresentacao.update({ where: { id }, data: { status } });

    revalidatePath("/PainelAlpha/Apresentacoes");
    return { success: true };
  } catch (error) {
    console.error("[AtualizarStatusApresentacao]", error);
    return { success: false, error: "Erro ao atualizar status" };
  }
}
