"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import {
  criarApresentacaoSchema,
  atualizarStatusSchema,
} from "@/lib/validations/apresentacao";
import { isAdminRole } from "@/lib/roles";
import { z } from "zod";
import { dadosSlideSchema } from "@/lib/validations/slide-componentes";
import { presetsAnimacaoPersonalizadosSchema } from "@/lib/apresentacoes/animacao/presets-personalizados";
import { gerarSlugPublico } from "@/lib/apresentacoes/publicacao";

function isAdmin(role?: string) {
  return isAdminRole(role);
}

async function podeEditarApresentacao(apresentacaoId: string, userId: number, role?: string): Promise<boolean> {
  if (isAdmin(role)) return true;
  const apresentacao = await db.apresentacao.findUnique({
    where: { id: apresentacaoId },
    select: {
      autorId: true,
      colaboradores: { where: { userId, papel: "EDITOR" }, select: { id: true } },
    },
  });
  return Boolean(apresentacao && (apresentacao.autorId === userId || apresentacao.colaboradores.length > 0));
}

const salvarPresetsSchema = z.object({
  apresentacaoId: z.string().min(1),
  presets: presetsAnimacaoPersonalizadosSchema,
});

const gerarLinkPublicoSchema = z.object({
  apresentacaoId: z.string().min(1),
  renovar: z.boolean().optional().default(false),
});

const compartilharApresentacaoSchema = z.object({
  apresentacaoId: z.string().min(1),
  destinatarioIds: z.array(z.number().int().positive()).min(1, "Selecione ao menos um usuário"),
});

export async function ListarApresentacoes(params?: { page?: number; pageSize?: number; busca?: string }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };

    const userId = Number(session.user.id);
    const page = params?.page && params.page > 0 ? params.page : 1;
    const pageSize = params?.pageSize && params.pageSize > 0 ? Math.min(Math.max(params.pageSize, 1), 100) : 20;
    const busca = params?.busca?.trim();

    // Tela inicial mostra somente as criações do próprio usuário — inclusive Admin/CEO.
    // Compartilhar (CompartilharApresentacao) é o caminho oficial para dar acesso a outra pessoa.
    const acesso = { autorId: userId };

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

export async function SalvarPresetsAnimacaoApresentacao(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    const parsed = salvarPresetsSchema.safeParse(dados);
    if (!parsed.success) return { success: false as const, error: "Presets inválidos" };

    const { apresentacaoId, presets } = parsed.data;
    const autorizado = await podeEditarApresentacao(apresentacaoId, Number(session.user.id), session.user.role);
    if (!autorizado) return { success: false as const, error: "Sem permissão para editar esta apresentação" };

    const slides = await db.slide.findMany({
      where: { apresentacaoId },
      orderBy: { ordem: "asc" },
      select: { id: true, dadosJson: true },
    });
    const slidesValidos = slides.flatMap((slide) => {
      const resultado = dadosSlideSchema.safeParse(slide.dadosJson);
      return resultado.success ? [{ slide, dados: resultado.data }] : [];
    });
    const hospedeiro = slidesValidos.find((item) => item.dados.presetsAnimacao) ?? slidesValidos[0];
    if (!hospedeiro) return { success: false as const, error: "A apresentação não possui slide válido para salvar os presets" };

    await db.slide.update({
      where: { id: hospedeiro.slide.id },
      data: { dadosJson: { ...hospedeiro.dados, presetsAnimacao: presets } as object },
    });

    revalidatePath(`/PainelAlpha/Apresentacoes/${apresentacaoId}/editor`);
    return { success: true as const, data: presets };
  } catch (error) {
    console.error("[SalvarPresetsAnimacaoApresentacao]", error);
    return { success: false as const, error: "Erro ao salvar presets" };
  }
}

export async function GerarLinkPublicoApresentacao(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    const parsed = gerarLinkPublicoSchema.safeParse(dados);
    if (!parsed.success) return { success: false as const, error: "Dados inválidos" };

    const { apresentacaoId, renovar } = parsed.data;
    const autorizado = await podeEditarApresentacao(apresentacaoId, Number(session.user.id), session.user.role);
    if (!autorizado) return { success: false as const, error: "Sem permissão para publicar esta apresentação" };

    const atual = await db.apresentacao.findUnique({
      where: { id: apresentacaoId },
      select: { slugPublico: true },
    });
    if (!atual) return { success: false as const, error: "Apresentação não encontrada" };

    const slugPublico = atual.slugPublico && !renovar ? atual.slugPublico : gerarSlugPublico();
    await db.apresentacao.update({
      where: { id: apresentacaoId },
      data: { slugPublico, status: "PUBLICADA", expiraEm: null },
    });

    revalidatePath("/PainelAlpha/Apresentacoes");
    revalidatePath(`/PainelAlpha/Apresentacoes/${apresentacaoId}/editor`);
    return { success: true as const, data: { slugPublico, caminho: `/apresentacao/${slugPublico}` } };
  } catch (error) {
    console.error("[GerarLinkPublicoApresentacao]", error);
    return { success: false as const, error: "Erro ao gerar link da apresentação" };
  }
}

/**
 * Compartilha a apresentação com um ou mais usuários do sistema — cria uma CÓPIA completa
 * (não um link/acesso compartilhado) para cada destinatário, nomeada "{título} - copia de {quem compartilhou}".
 * Só o CRIADOR original pode compartilhar (nunca Admin/colaborador) — regra explícita do usuário.
 * A cópia nasce sempre com todos os slides visíveis, independente do que o criador tinha oculto.
 */
export async function CompartilharApresentacao(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };

    const parsed = compartilharApresentacaoSchema.safeParse(dados);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.flatten().fieldErrors };
    }
    const { apresentacaoId, destinatarioIds } = parsed.data;
    const userId = Number(session.user.id);

    const original = await db.apresentacao.findUnique({
      where: { id: apresentacaoId },
      include: { slides: true },
    });
    if (!original) return { success: false as const, error: "Apresentação não encontrada" };
    if (original.autorId !== userId) {
      return { success: false as const, error: "Somente o criador pode compartilhar esta apresentação" };
    }

    const remetente = await db.usuarios.findUnique({ where: { id: userId }, select: { nome: true } });
    if (!remetente) return { success: false as const, error: "Usuário remetente não encontrado" };

    const destinatarios = await db.usuarios.findMany({
      where: { id: { in: destinatarioIds } },
      select: { id: true },
    });
    if (destinatarios.length === 0) {
      return { success: false as const, error: "Nenhum destinatário válido encontrado" };
    }

    const tituloCopia = `${original.titulo} - copia de ${remetente.nome}`;

    const copias = await db.$transaction(
      destinatarios.map((destinatario) =>
        db.apresentacao.create({
          data: {
            titulo: tituloCopia,
            clienteNome: original.clienteNome,
            autorId: destinatario.id,
            status: "DRAFT",
            temaId: original.temaId,
            slides: {
              create: original.slides.map((s) => ({
                ordem: s.ordem,
                nome: s.nome,
                transicaoEntrada: s.transicaoEntrada,
                duracaoAutoplay: s.duracaoAutoplay,
                dadosJson: s.dadosJson as object,
                oculto: false,
              })),
            },
          },
          select: { id: true, autorId: true },
        }),
      ),
    );

    revalidatePath("/PainelAlpha/Apresentacoes");
    return { success: true as const, data: { copias: copias.length } };
  } catch (error) {
    console.error("[CompartilharApresentacao]", error);
    return { success: false as const, error: "Erro ao compartilhar apresentação" };
  }
}
