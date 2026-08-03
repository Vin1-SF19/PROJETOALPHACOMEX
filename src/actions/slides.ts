"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { dadosSlideSchema } from "@/lib/validations/slide-componentes";
import { CANVAS_PADRAO } from "@/lib/apresentacoes/canvas";

function isAdmin(role?: string) {
  return role === "Admin" || role === "CEO";
}

/** Sobe até a Apresentação dona do slide/apresentacaoId e confirma ownership (autor, colaborador ou admin). Nunca confiar só no id do slide isolado. */
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

export async function ListarSlides(apresentacaoId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };

    const userId = Number(session.user.id);
    const autorizado = await checarOwnershipApresentacao(apresentacaoId, userId, session.user.role);
    if (!autorizado) return { success: false, error: "Sem permissão", data: [] };

    const slides = await db.slide.findMany({
      where: { apresentacaoId },
      select: {
        id: true,
        ordem: true,
        nome: true,
        transicaoEntrada: true,
        duracaoAutoplay: true,
        dadosJson: true,
      },
      orderBy: { ordem: "asc" },
    });

    return { success: true, data: slides };
  } catch (error) {
    console.error("[ListarSlides]", error);
    return { success: false, data: [], error: "Erro ao buscar slides" };
  }
}

export async function ObterSlide(slideId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const userId = Number(session.user.id);
    const slide = await db.slide.findUnique({
      where: { id: slideId },
      select: {
        id: true,
        ordem: true,
        nome: true,
        transicaoEntrada: true,
        duracaoAutoplay: true,
        dadosJson: true,
        apresentacaoId: true,
      },
    });
    if (!slide) return { success: false, error: "Slide não encontrado" };

    const autorizado = await checarOwnershipApresentacao(slide.apresentacaoId, userId, session.user.role);
    if (!autorizado) return { success: false, error: "Sem permissão" };

    return { success: true, data: slide };
  } catch (error) {
    console.error("[ObterSlide]", error);
    return { success: false, error: "Erro ao buscar slide" };
  }
}

export async function CriarSlide(apresentacaoId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const userId = Number(session.user.id);
    const autorizado = await checarOwnershipApresentacao(apresentacaoId, userId, session.user.role);
    if (!autorizado) return { success: false, error: "Sem permissão" };

    const [ultimoSlide, totalSlides] = await Promise.all([
      db.slide.findFirst({ where: { apresentacaoId }, orderBy: { ordem: "desc" }, select: { ordem: true } }),
      db.slide.count({ where: { apresentacaoId } }),
    ]);

    const slide = await db.slide.create({
      data: {
        apresentacaoId,
        ordem: (ultimoSlide?.ordem ?? -1) + 1,
        nome: `Slide ${totalSlides + 1}`,
        dadosJson: { componentes: [], canvas: CANVAS_PADRAO },
      },
      select: { id: true, ordem: true, nome: true, dadosJson: true },
    });

    revalidatePath(`/PainelAlpha/Apresentacoes/${apresentacaoId}/editor`);
    return { success: true, data: slide };
  } catch (error) {
    console.error("[CriarSlide]", error);
    return { success: false, error: "Erro ao criar slide" };
  }
}

export async function AtualizarSlide(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    if (typeof dados !== "object" || dados === null || !("id" in dados) || !("dadosJson" in dados)) {
      return { success: false, error: "Dados inválidos" };
    }
    const { id, dadosJson, nome } = dados as { id: unknown; dadosJson: unknown; nome?: unknown };
    if (typeof id !== "string" || !id) return { success: false, error: "Dados inválidos" };

    const parsed = dadosSlideSchema.safeParse(dadosJson);
    if (!parsed.success) {
      return { success: false, error: parsed.error.flatten() };
    }

    const userId = Number(session.user.id);
    const slideAtual = await db.slide.findUnique({ where: { id }, select: { apresentacaoId: true } });
    if (!slideAtual) return { success: false, error: "Slide não encontrado" };

    const autorizado = await checarOwnershipApresentacao(slideAtual.apresentacaoId, userId, session.user.role);
    if (!autorizado) return { success: false, error: "Sem permissão" };

    await db.slide.update({
      where: { id },
      // Cast seguro: parsed.data já passou pelo Zod (dadosSlideSchema) na linha acima —
      // o Prisma exige InputJsonValue (index signature genérica) para campos Json,
      // que não é estruturalmente igual ao tipo forte ComponenteSlide[] recursivo.
      data: {
        dadosJson: parsed.data as object,
        ...(typeof nome === "string" && nome.trim() ? { nome: nome.trim() } : {}),
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[AtualizarSlide]", error);
    return { success: false, error: "Erro ao salvar slide" };
  }
}

export async function ReordenarSlides(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    if (
      typeof dados !== "object" ||
      dados === null ||
      !("apresentacaoId" in dados) ||
      !("ordemIds" in dados)
    ) {
      return { success: false, error: "Dados inválidos" };
    }
    const { apresentacaoId, ordemIds } = dados as { apresentacaoId: unknown; ordemIds: unknown };
    if (typeof apresentacaoId !== "string" || !Array.isArray(ordemIds) || !ordemIds.every((v) => typeof v === "string")) {
      return { success: false, error: "Dados inválidos" };
    }

    const userId = Number(session.user.id);
    const autorizado = await checarOwnershipApresentacao(apresentacaoId, userId, session.user.role);
    if (!autorizado) return { success: false, error: "Sem permissão" };

    await db.$transaction(
      ordemIds.map((slideId, index) =>
        db.slide.updateMany({
          where: { id: slideId, apresentacaoId },
          data: { ordem: index },
        }),
      ),
    );

    revalidatePath(`/PainelAlpha/Apresentacoes/${apresentacaoId}/editor`);
    return { success: true };
  } catch (error) {
    console.error("[ReordenarSlides]", error);
    return { success: false, error: "Erro ao reordenar slides" };
  }
}

export async function ExcluirSlide(slideId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const userId = Number(session.user.id);
    const slide = await db.slide.findUnique({ where: { id: slideId }, select: { apresentacaoId: true } });
    if (!slide) return { success: false, error: "Slide não encontrado" };

    const autorizado = await checarOwnershipApresentacao(slide.apresentacaoId, userId, session.user.role);
    if (!autorizado) return { success: false, error: "Sem permissão" };

    const totalSlides = await db.slide.count({ where: { apresentacaoId: slide.apresentacaoId } });
    if (totalSlides <= 1) {
      return { success: false, error: "A apresentação precisa ter pelo menos 1 slide." };
    }

    await db.slide.delete({ where: { id: slideId } });

    revalidatePath(`/PainelAlpha/Apresentacoes/${slide.apresentacaoId}/editor`);
    return { success: true };
  } catch (error) {
    console.error("[ExcluirSlide]", error);
    return { success: false, error: "Erro ao excluir slide" };
  }
}

export async function DuplicarSlide(slideId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const userId = Number(session.user.id);
    const original = await db.slide.findUnique({
      where: { id: slideId },
      select: { apresentacaoId: true, ordem: true, nome: true, dadosJson: true, transicaoEntrada: true, duracaoAutoplay: true },
    });
    if (!original) return { success: false, error: "Slide não encontrado" };

    const autorizado = await checarOwnershipApresentacao(original.apresentacaoId, userId, session.user.role);
    if (!autorizado) return { success: false, error: "Sem permissão" };

    // Empurra a ordem de todos os slides posteriores em +1 para abrir espaço logo após o original,
    // depois insere a cópia nessa posição — evita ordem fracionária, mantém `ordem` sempre inteiro e denso.
    const copia = await db.$transaction(async (tx) => {
      await tx.slide.updateMany({
        where: { apresentacaoId: original.apresentacaoId, ordem: { gt: original.ordem } },
        data: { ordem: { increment: 1 } },
      });

      return tx.slide.create({
        data: {
          apresentacaoId: original.apresentacaoId,
          ordem: original.ordem + 1,
          nome: `${original.nome ?? "Slide"} (cópia)`,
          transicaoEntrada: original.transicaoEntrada,
          duracaoAutoplay: original.duracaoAutoplay,
          dadosJson: original.dadosJson as object,
        },
        select: { id: true, ordem: true, nome: true, dadosJson: true },
      });
    });

    revalidatePath(`/PainelAlpha/Apresentacoes/${original.apresentacaoId}/editor`);
    return { success: true, data: copia };
  } catch (error) {
    console.error("[DuplicarSlide]", error);
    return { success: false, error: "Erro ao duplicar slide" };
  }
}
