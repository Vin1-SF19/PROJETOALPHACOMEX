"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { criarTemaSchema, atualizarTemaSchema, aplicarTemaSchema } from "@/lib/validations/apresentacao-tema";

function isAdmin(role?: string) {
  return role === "Admin" || role === "CEO";
}

async function checarOwnershipApresentacao(apresentacaoId: string, userId: number, role?: string) {
  if (isAdmin(role)) return true;
  const apresentacao = await db.apresentacao.findUnique({
    where: { id: apresentacaoId },
    select: {
      autorId: true,
      colaboradores: { where: { userId }, select: { id: true } },
    },
  });
  if (!apresentacao) return false;
  return apresentacao.autorId === userId || apresentacao.colaboradores.length > 0;
}

export async function ListarTemas() {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };

    const userId = Number(session.user.id);

    const temas = await db.apresentacaoTema.findMany({
      where: {
        OR: [{ isTemplate: true }, { criadoPorId: userId }],
      },
      select: {
        id: true,
        nome: true,
        corPrimaria: true,
        corSecundaria: true,
        corAccent: true,
        radius: true,
        fontePrimaria: true,
        fonteSecundaria: true,
        tokensJson: true,
        isTemplate: true,
        criadoPorId: true,
      },
      orderBy: [{ isTemplate: "desc" }, { nome: "asc" }],
      take: 100, // cinto de segurança — sem paginação real por volume esperado ser pequeno (templates do sistema + temas próprios do usuário)
    });

    return { success: true, data: temas };
  } catch (error) {
    console.error("[ListarTemas]", error);
    return { success: false, data: [], error: "Erro ao buscar temas" };
  }
}

export async function CriarTema(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const parsed = criarTemaSchema.safeParse(dados);
    if (!parsed.success) {
      return { success: false, error: parsed.error.flatten().fieldErrors };
    }
    const input = parsed.data;
    const userId = Number(session.user.id);

    const tema = await db.apresentacaoTema.create({
      data: {
        nome: input.nome,
        corPrimaria: input.corPrimaria,
        corSecundaria: input.corSecundaria,
        corAccent: input.corAccent,
        radius: input.radius || null,
        fontePrimaria: input.fontePrimaria || null,
        fonteSecundaria: input.fonteSecundaria || null,
        tokensJson: input.tokensJson as object, // já validado por criarTemaSchema — Prisma Json exige InputJsonValue, incompatível estruturalmente com Record<string, unknown>
        isTemplate: false,
        criadoPorId: userId,
      },
      select: { id: true },
    });

    revalidatePath("/PainelAlpha/Apresentacoes");
    return { success: true, data: tema };
  } catch (error) {
    console.error("[CriarTema]", error);
    return { success: false, error: "Erro ao criar tema" };
  }
}

export async function AtualizarTema(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const parsed = atualizarTemaSchema.safeParse(dados);
    if (!parsed.success) {
      return { success: false, error: parsed.error.flatten().fieldErrors };
    }
    const { id, ...campos } = parsed.data;
    const userId = Number(session.user.id);

    const temaAtual = await db.apresentacaoTema.findUnique({
      where: { id },
      select: { criadoPorId: true, isTemplate: true },
    });
    if (!temaAtual) return { success: false, error: "Tema não encontrado" };

    // Templates do sistema (isTemplate: true) só podem ser editados por Admin/CEO.
    // Temas próprios só podem ser editados pelo dono.
    const podeEditar = temaAtual.isTemplate ? isAdmin(session.user.role) : temaAtual.criadoPorId === userId;
    if (!podeEditar) return { success: false, error: "Sem permissão" };

    await db.apresentacaoTema.update({
      where: { id },
      data: {
        ...(campos.nome !== undefined ? { nome: campos.nome } : {}),
        ...(campos.corPrimaria !== undefined ? { corPrimaria: campos.corPrimaria } : {}),
        ...(campos.corSecundaria !== undefined ? { corSecundaria: campos.corSecundaria } : {}),
        ...(campos.corAccent !== undefined ? { corAccent: campos.corAccent } : {}),
        ...(campos.radius !== undefined ? { radius: campos.radius || null } : {}),
        ...(campos.fontePrimaria !== undefined ? { fontePrimaria: campos.fontePrimaria || null } : {}),
        ...(campos.fonteSecundaria !== undefined ? { fonteSecundaria: campos.fonteSecundaria || null } : {}),
        ...(campos.tokensJson !== undefined ? { tokensJson: campos.tokensJson as object } : {}),
      },
    });

    revalidatePath("/PainelAlpha/Apresentacoes");
    return { success: true };
  } catch (error) {
    console.error("[AtualizarTema]", error);
    return { success: false, error: "Erro ao atualizar tema" };
  }
}

export async function AplicarTema(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const parsed = aplicarTemaSchema.safeParse(dados);
    if (!parsed.success) {
      return { success: false, error: parsed.error.flatten().fieldErrors };
    }
    const { apresentacaoId, temaId } = parsed.data;
    const userId = Number(session.user.id);

    const autorizado = await checarOwnershipApresentacao(apresentacaoId, userId, session.user.role);
    if (!autorizado) return { success: false, error: "Sem permissão" };

    if (temaId) {
      const tema = await db.apresentacaoTema.findUnique({ where: { id: temaId }, select: { id: true } });
      if (!tema) return { success: false, error: "Tema não encontrado" };
    }

    await db.apresentacao.update({
      where: { id: apresentacaoId },
      data: { temaId },
    });

    revalidatePath(`/PainelAlpha/Apresentacoes/${apresentacaoId}/editor`);
    return { success: true };
  } catch (error) {
    console.error("[AplicarTema]", error);
    return { success: false, error: "Erro ao aplicar tema" };
  }
}
