"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { dadosSlideSchema } from "@/lib/validations/slide-componentes";
import { CANVAS_PADRAO } from "@/lib/apresentacoes/canvas";
import { isAdminRole } from "@/lib/roles";
import { transicaoEntradaSchema } from "@/lib/apresentacoes/transicoes/catalogo";
import { removerPresetsDoPacoteDoSlide } from "@/lib/apresentacoes/animacao/presets-personalizados";
import { removerFontesDoPacoteDoSlide } from "@/lib/apresentacoes/fontes-personalizadas";

function isAdmin(role?: string) {
  return isAdminRole(role);
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
        oculto: true,
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
        oculto: true,
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

    const ultimoSlide = await db.slide.findFirst({ where: { apresentacaoId }, orderBy: { ordem: "desc" }, select: { ordem: true } });

    // `nome` fica null de propósito (não grava "Slide N" literal) — o rótulo padrão é calculado
    // no client a partir de `ordem+1` (ver ItemSlide em SidebarSlides.tsx), então continua correto
    // sozinho depois de excluir/reordenar slides. Só vira texto fixo quando o usuário renomeia.
    const slide = await db.slide.create({
      data: {
        apresentacaoId,
        ordem: (ultimoSlide?.ordem ?? -1) + 1,
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
    const { id, dadosJson, nome, transicaoEntrada } = dados as {
      id: unknown;
      dadosJson: unknown;
      nome?: unknown;
      transicaoEntrada?: unknown;
    };
    if (typeof id !== "string" || !id) return { success: false, error: "Dados inválidos" };

    const parsed = dadosSlideSchema.safeParse(dadosJson);
    if (!parsed.success) {
      return { success: false, error: parsed.error.flatten() };
    }

    // Fase 05 — só valida/grava quando o campo é enviado; ausente = não mexe no valor
    // existente da coluna (retrocompatibilidade: chamadas antigas de AtualizarSlide não
    // enviam transicaoEntrada e nunca sobrescreviam a coluna).
    let transicaoParaGravar: string | null | undefined;
    if (transicaoEntrada !== undefined) {
      const parsedTransicao = transicaoEntradaSchema.safeParse(transicaoEntrada);
      if (!parsedTransicao.success) {
        return { success: false, error: "Transição inválida" };
      }
      transicaoParaGravar = parsedTransicao.data ?? null;
    }

    const userId = Number(session.user.id);
    const slideAtual = await db.slide.findUnique({ where: { id }, select: { apresentacaoId: true, dadosJson: true } });
    if (!slideAtual) return { success: false, error: "Slide não encontrado" };

    const autorizado = await checarOwnershipApresentacao(slideAtual.apresentacaoId, userId, session.user.role);
    if (!autorizado) return { success: false, error: "Sem permissão" };

    const dadosExistentes = dadosSlideSchema.safeParse(slideAtual.dadosJson);
    const dadosParaGravar = dadosExistentes.success
      ? {
          ...parsed.data,
          ...(parsed.data.pptxSource || !dadosExistentes.data.pptxSource ? {} : { pptxSource: dadosExistentes.data.pptxSource }),
          ...(parsed.data.presetsAnimacao || !dadosExistentes.data.presetsAnimacao
            ? {}
            : { presetsAnimacao: dadosExistentes.data.presetsAnimacao }),
          ...(parsed.data.fontesPersonalizadas || !dadosExistentes.data.fontesPersonalizadas
            ? {}
            : { fontesPersonalizadas: dadosExistentes.data.fontesPersonalizadas }),
        }
      : parsed.data;

    await db.slide.update({
      where: { id },
      // Cast seguro: parsed.data já passou pelo Zod (dadosSlideSchema) na linha acima —
      // o Prisma exige InputJsonValue (index signature genérica) para campos Json,
      // que não é estruturalmente igual ao tipo forte ComponenteSlide[] recursivo.
      data: {
        dadosJson: dadosParaGravar as object,
        ...(typeof nome === "string" && nome.trim() ? { nome: nome.trim() } : {}),
        ...(transicaoParaGravar !== undefined ? { transicaoEntrada: transicaoParaGravar } : {}),
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
    const slide = await db.slide.findUnique({ where: { id: slideId }, select: { apresentacaoId: true, dadosJson: true } });
    if (!slide) return { success: false, error: "Slide não encontrado" };

    const autorizado = await checarOwnershipApresentacao(slide.apresentacaoId, userId, session.user.role);
    if (!autorizado) return { success: false, error: "Sem permissão" };

    const totalSlides = await db.slide.count({ where: { apresentacaoId: slide.apresentacaoId } });
    if (totalSlides <= 1) {
      return { success: false, error: "A apresentação precisa ter pelo menos 1 slide." };
    }

    // Exclui e renumera `ordem` dos restantes numa transação — sem isso, a exclusão deixava
    // buracos (ex.: excluir ordem=0 de [0,1,2] deixava [1,2], não [0,1]), e como o rótulo padrão
    // do slide ("Slide N") é calculado a partir de `ordem+1` quando não há nome customizado, os
    // slides restantes não "subiam" de número — pedido explícito do usuário pra funcionar assim.
    const dadosSlideExcluido = dadosSlideSchema.safeParse(slide.dadosJson);
    const presetsDoSlideExcluido = dadosSlideExcluido.success ? dadosSlideExcluido.data.presetsAnimacao : undefined;
    const fontesDoSlideExcluido = dadosSlideExcluido.success ? dadosSlideExcluido.data.fontesPersonalizadas : undefined;

    await db.$transaction(async (tx) => {
      await tx.slide.delete({ where: { id: slideId } });
      const restantes = await tx.slide.findMany({
        where: { apresentacaoId: slide.apresentacaoId },
        orderBy: { ordem: "asc" },
        select: { id: true, dadosJson: true },
      });
      await Promise.all(restantes.map((s, index) => tx.slide.update({ where: { id: s.id }, data: { ordem: index } })));
      if ((presetsDoSlideExcluido?.length || fontesDoSlideExcluido?.length) && restantes[0]) {
        const dadosDestino = dadosSlideSchema.safeParse(restantes[0].dadosJson);
        if (dadosDestino.success) {
          const presetsParaTransferir = !dadosDestino.data.presetsAnimacao?.length ? presetsDoSlideExcluido : undefined;
          const fontesParaTransferir = !dadosDestino.data.fontesPersonalizadas?.length ? fontesDoSlideExcluido : undefined;
          if (!presetsParaTransferir?.length && !fontesParaTransferir?.length) return;
          await tx.slide.update({
            where: { id: restantes[0].id },
            data: {
              dadosJson: {
                ...dadosDestino.data,
                ...(presetsParaTransferir?.length ? { presetsAnimacao: presetsParaTransferir } : {}),
                ...(fontesParaTransferir?.length ? { fontesPersonalizadas: fontesParaTransferir } : {}),
              } as object,
            },
          });
        }
      }
    });

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
    const dadosOriginais = dadosSlideSchema.safeParse(original.dadosJson);
    const dadosDaCopia = dadosOriginais.success
      ? removerFontesDoPacoteDoSlide(removerPresetsDoPacoteDoSlide(dadosOriginais.data))
      : original.dadosJson;

    const copia = await db.$transaction(async (tx) => {
      await tx.slide.updateMany({
        where: { apresentacaoId: original.apresentacaoId, ordem: { gt: original.ordem } },
        data: { ordem: { increment: 1 } },
      });

      // Se o original não tem nome customizado, usa o rótulo padrão dele ("Slide N", pela
      // posição ANTES da cópia) como base — evita "Slide (cópia)" sem número.
      const rotuloBase = original.nome ?? `Slide ${original.ordem + 1}`;
      return tx.slide.create({
        data: {
          apresentacaoId: original.apresentacaoId,
          ordem: original.ordem + 1,
          nome: `${rotuloBase} (cópia)`,
          transicaoEntrada: original.transicaoEntrada,
          duracaoAutoplay: original.duracaoAutoplay,
          dadosJson: dadosDaCopia as object,
        },
        select: { id: true, ordem: true, nome: true, dadosJson: true, oculto: true },
      });
    });

    revalidatePath(`/PainelAlpha/Apresentacoes/${original.apresentacaoId}/editor`);
    return { success: true, data: copia };
  } catch (error) {
    console.error("[DuplicarSlide]", error);
    return { success: false, error: "Erro ao duplicar slide" };
  }
}

/** Alterna o campo `oculto` do slide (soft-hide, estilo Canva) — nunca exclui dado nenhum.
 * Slides ocultos continuam no editor, mas são filtrados do link público, export HTML e modo apresentação. */
export async function AlternarVisibilidadeSlide(slideId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const userId = Number(session.user.id);
    const slide = await db.slide.findUnique({
      where: { id: slideId },
      select: { apresentacaoId: true, oculto: true },
    });
    if (!slide) return { success: false, error: "Slide não encontrado" };

    const autorizado = await checarOwnershipApresentacao(slide.apresentacaoId, userId, session.user.role);
    if (!autorizado) return { success: false, error: "Sem permissão" };

    const atualizado = await db.slide.update({
      where: { id: slideId },
      data: { oculto: !slide.oculto },
      select: { id: true, oculto: true },
    });

    revalidatePath(`/PainelAlpha/Apresentacoes/${slide.apresentacaoId}/editor`);
    return { success: true, data: atualizado };
  } catch (error) {
    console.error("[AlternarVisibilidadeSlide]", error);
    return { success: false, error: "Erro ao alterar visibilidade do slide" };
  }
}
