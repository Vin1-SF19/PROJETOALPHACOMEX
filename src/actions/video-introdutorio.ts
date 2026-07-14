"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "../../auth";
import { isAdminRole } from "@/lib/onyx/ownership";
import { MODULOS_REGISTRY } from "@/lib/modulos-registry";

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

const ativarSchema = z.object({
  modulo: z.string().min(1),
  videoId: z.string().cuid(),
});

const buscarVideosSchema = z.object({
  moduloNome: z.string().optional(),
  cursoNome: z.string().optional(),
  videoNome: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

export type BuscarVideosAlphaSkillsInput = z.infer<typeof buscarVideosSchema>;

export interface VideoIntrodutorioConfigView {
  videoId: string;
  videoTitulo: string;
  videoUrl: string;
  videoThumbUrl: string | null;
  ativadoEm: Date;
  expirado: boolean;
}

/**
 * Retorna a config de vídeo introdutório do módulo informado.
 * Sem restrição de role — qualquer usuário autenticado pode consultar; a
 * visibilidade do botão para Admin vs. não-Admin é decidida pelo componente
 * que consome este dado (ver decisions.md, 2026-07-14), nunca aqui.
 */
export async function obterVideoIntrodutorioConfig(modulo: string) {
  try {
    const config = await db.videoIntrodutorioConfig.findUnique({
      where: { modulo },
      include: {
        video: {
          select: { id: true, titulo: true, url: true, thumbUrl: true },
        },
      },
    });

    if (!config || !config.video || !config.ativadoEm) {
      return { success: true, data: null as VideoIntrodutorioConfigView | null };
    }

    const expirado = Date.now() - config.ativadoEm.getTime() > SETE_DIAS_MS;

    const data: VideoIntrodutorioConfigView = {
      videoId: config.video.id,
      videoTitulo: config.video.titulo,
      videoUrl: config.video.url,
      videoThumbUrl: config.video.thumbUrl,
      ativadoEm: config.ativadoEm,
      expirado,
    };

    return { success: true, data };
  } catch (error) {
    console.error("[obterVideoIntrodutorioConfig]", error);
    return { success: false, error: "Erro ao buscar configuração de vídeo introdutório", data: null };
  }
}

/**
 * Busca combinada de vídeos do Alpha Skills, cruzando a hierarquia
 * videos -> ModuloVideo -> modulos -> CursoModulo -> Curso.
 * Só Admin/CEO pode chamar (seleção de vídeo para ativar é ação administrativa).
 */
export async function buscarVideosAlphaSkills(filtros: BuscarVideosAlphaSkillsInput) {
  try {
    const session = await auth();
    if (!session?.user?.id || !isAdminRole(session.user.role ?? "")) {
      return { success: false, error: "Sem permissão", data: [] };
    }

    const parsed = buscarVideosSchema.safeParse(filtros);
    if (!parsed.success) {
      return { success: false, error: "Dados inválidos", data: [] };
    }
    const { moduloNome, cursoNome, videoNome, page, pageSize } = parsed.data;

    const condicoes: Array<Record<string, unknown>> = [];

    if (videoNome) {
      condicoes.push({ titulo: { contains: videoNome } });
    }

    if (moduloNome || cursoNome) {
      condicoes.push({
        modulo: {
          some: {
            modulo: {
              ...(moduloNome ? { nome: { contains: moduloNome } } : {}),
              ...(cursoNome
                ? { cursos: { some: { curso: { nome: { contains: cursoNome } } } } }
                : {}),
            },
          },
        },
      });
    }

    const where = condicoes.length > 0 ? { AND: condicoes } : {};

    const [videosEncontrados, total] = await Promise.all([
      db.videos.findMany({
        where,
        select: {
          id: true,
          titulo: true,
          thumbUrl: true,
          url: true,
          modulo: {
            select: {
              modulo: {
                select: {
                  nome: true,
                  cursos: {
                    select: { curso: { select: { nome: true } } },
                  },
                },
              },
            },
          },
        },
        orderBy: { titulo: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.videos.count({ where }),
    ]);

    const data = videosEncontrados.map((v) => ({
      id: v.id,
      titulo: v.titulo,
      thumbUrl: v.thumbUrl,
      url: v.url,
      modulos: v.modulo.map((m) => m.modulo.nome),
      cursos: v.modulo.flatMap((m) => m.modulo.cursos.map((c) => c.curso.nome)),
    }));

    return {
      success: true,
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  } catch (error) {
    console.error("[buscarVideosAlphaSkills]", error);
    return { success: false, error: "Erro ao buscar vídeos", data: [] };
  }
}

/**
 * Ativa (ou reconfigura) o vídeo introdutório de um módulo. Upsert: 1 registro
 * por módulo, sempre representando o estado atual (não histórico).
 * Só Admin/CEO.
 */
export async function ativarVideoIntrodutorio(modulo: string, videoId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || !isAdminRole(session.user.role ?? "")) {
      return { success: false, error: "Sem permissão" };
    }

    const parsed = ativarSchema.safeParse({ modulo, videoId });
    if (!parsed.success) {
      return { success: false, error: "Dados inválidos" };
    }

    const userId = Number(session.user.id);
    const agora = new Date();

    await db.videoIntrodutorioConfig.upsert({
      where: { modulo: parsed.data.modulo },
      update: {
        videoId: parsed.data.videoId,
        ativadoEm: agora,
        ativadoPorId: userId,
      },
      create: {
        modulo: parsed.data.modulo,
        videoId: parsed.data.videoId,
        ativadoEm: agora,
        ativadoPorId: userId,
      },
    });

    revalidatePath(caminhoDoModulo(parsed.data.modulo));
    return { success: true };
  } catch (error) {
    console.error("[ativarVideoIntrodutorio]", error);
    return { success: false, error: "Erro ao ativar vídeo introdutório" };
  }
}

/**
 * Desativa manualmente (Admin encerra antes dos 7 dias). Soft: mantém
 * `videoId` (para o Admin ver qual estava selecionado), só limpa `ativadoEm`.
 * Só Admin/CEO.
 */
export async function desativarVideoIntrodutorio(modulo: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || !isAdminRole(session.user.role ?? "")) {
      return { success: false, error: "Sem permissão" };
    }

    const moduloParsed = z.string().min(1).safeParse(modulo);
    if (!moduloParsed.success) {
      return { success: false, error: "Módulo inválido" };
    }

    await db.videoIntrodutorioConfig.update({
      where: { modulo: moduloParsed.data },
      data: { ativadoEm: null },
    });

    revalidatePath(caminhoDoModulo(moduloParsed.data));
    return { success: true };
  } catch (error) {
    console.error("[desativarVideoIntrodutorio]", error);
    return { success: false, error: "Erro ao desativar vídeo introdutório" };
  }
}

/**
 * Resolve o path real da página do módulo via MODULOS_REGISTRY (fonte única
 * de verdade dos hrefs — não seguem um padrão previsível de capitalização,
 * ex: "tarefasComercial" -> "/PainelAlpha/PainelTarefas/PainelTarefaC").
 * Se o id não estiver no registry (módulo ainda não cadastrado, ou erro de
 * digitação do chamador), cai em revalidatePath("/PainelAlpha") — mais amplo,
 * mas nunca falha silenciosamente por falta de path.
 */
function caminhoDoModulo(modulo: string): string {
  const item = MODULOS_REGISTRY.find((m) => m.id === modulo);
  return item?.href ?? "/PainelAlpha";
}
