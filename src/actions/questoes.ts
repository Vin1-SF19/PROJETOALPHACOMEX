'use server';

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";


export async function createTagAction(nome: string) {
  try {
    const novaTag = await db.tagQuestao.create({
      data: { nome: nome.toUpperCase() }
    });
    return { success: true, data: novaTag };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: "Esta categoria já existe." };
    }
    return { success: false, error: "Erro ao criar categoria." };
  }
}

export async function getTagsAction() {
  try {
    const tags = await db.tagQuestao.findMany({
      include: {
        perguntas: true,
        _count: {
          select: { perguntas: true }
        }
      },
      orderBy: { nome: 'asc' }
    });
    return tags;
  } catch (error) {
    console.error("Erro ao buscar tags:", error);
    return [];
  }
}

export async function createPerguntaAction(dados: {
  enunciado: string;
  tipo: 'OBJETIVA' | 'DESCRITIVA';
  opcoes: string[];
  respostaCorreta: string;
  tagId: string;
}) {
  try {
    await db.pergunta.create({
      data: {
        enunciado: dados.enunciado,
        tipo: dados.tipo,
        opcoes: JSON.stringify(dados.opcoes),
        respostaCorreta: dados.respostaCorreta,
        tagId: dados.tagId
      }
    });
    revalidatePath('/PainelAlpha/AlphaSchools/presets');
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false };
  }
}

export async function deletePerguntaAction(id: string) {
  try {
    await db.pergunta.delete({ where: { id } });
    revalidatePath('/PainelAlpha/AlphaSchools/presets');
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function updatePerguntaAction(dados: {
  id: string;
  enunciado: string;
  tipo: string;
  opcoes: string[];
  respostaCorreta: string;
}) {
  try {
    await db.pergunta.update({
      where: { id: dados.id },
      data: {
        enunciado: dados.enunciado,
        tipo: dados.tipo,
        opcoes: JSON.stringify(dados.opcoes),
        respostaCorreta: dados.respostaCorreta,
      }
    });
    revalidatePath('/PainelAlpha/AlphaSchools');
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function vincularTagsAoPresetAction(presetId: string, tagIds: string[]) {
  try {
    await db.preset.update({
      where: { id: presetId },
      data: {
        tags: {
          set: tagIds.map(id => ({ id }))
        }
      }
    });

    revalidatePath('/PainelAlpha/AlphaSchools');
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false };
  }
}

export async function getPresetCompletoAction(presetId: string) {
  try {
    if (!presetId) return null;

    const preset = await db.preset.findUnique({
      where: { id: presetId },
      include: {
        videos: {
          orderBy: {
            ordem: 'asc' 
          }
        },
        tags: {
          include: { perguntas: true }
        },
        ResultadoProva: true, 
        usuarios: { select: { id: true, usuario: true, nome: true } }
      }
    });

    return preset;
  } catch (error) {
    console.error("Erro ao buscar preset completo:", error);
    return null;
  }
}

export async function salvarConfiguracoesCompletasAction(
  presetId: string,
  videoIds: string[],
  usuarioIds: string[],
  tagIds: string[]
) {
  try {
    const idsNumericos = usuarioIds.map(id => Number(id));

    const usuariosOcupados = await db.usuarios.findMany({
      where: {
        id: { in: idsNumericos },
        presets: { some: { id: { not: presetId } } }
      },
      select: { nome: true }
    });

    if (usuariosOcupados.length > 0) {
      const nomes = usuariosOcupados.map(u => u.nome).join(", ");
      return { success: false, error: `BLOQUEIO: O(s) usuário(s) [${nomes}] já pertencem a outro preset.` };
    }

    await db.$transaction([
      db.preset.update({
        where: { id: presetId },
        data: {
          tags: { set: tagIds.map(id => ({ id })) },
          usuarios: { set: idsNumericos.map(id => ({ id })) },
          videos: { set: videoIds.map(id => ({ id })) },
        }
      }),
      
      ...videoIds.map((id, index) => 
        db.videos.update({
          where: { id: id },
          data: { ordem: index } 
        })
      )
    ]);

    revalidatePath('/PainelAlpha/AlphaSchools/presets');
    revalidatePath('/PainelAlpha/AlphaSchools');
    
    return { success: true };

  } catch (error) {
    console.error(error);
    return { success: false, error: "Falha catastrófica na sincronização Alpha." };
  }
}

const todosUsuarios = await db.usuarios.findMany({
  select: {
    id: true,
    usuario: true,
    email: true,
  }
});

export async function buscarTodosUsuariosAction() {
  try {
    return await db.usuarios.findMany({
      select: { id: true, usuario: true, email: true },
      orderBy: { usuario: 'asc' }
    });
  } catch (error) {
    return [];
  }
}

export async function marcarVideoConcluidoAction(userId: string | number, videoId: string) {
  try {
      const userIdFinal = Number(userId);

      if (isNaN(userIdFinal)) {
          return { error: "ID de usuário inválido" };
      }

      await db.progressoVideo.upsert({
          where: {
              userId_videoId: { 
                  userId: userIdFinal, 
                  videoId: videoId 
              }
          },
          update: { 
              concluido: true,
              updatedAt: new Date()
          },
          create: {
              userId: userIdFinal,
              videoId: videoId,
              concluido: true
          }
      });

      revalidatePath('/PainelAlpha');
      return { success: true };
  } catch (error) {
      console.error("Erro Alpha Database:", error);
      return { error: "Erro ao sincronizar progresso com o servidor" };
  }
}

export async function salvarResultadoProva(dados: {
  userId: number;
  presetId: string;
  nota: number;
  aprovado: boolean;
}) {
  try {
      const resultadoExistente = await db.resultadoProva.findFirst({
          where: {
              userId: Number(dados.userId),
              presetId: dados.presetId
          }
      });

      if (resultadoExistente) {
          await db.resultadoProva.update({
              where: { id: resultadoExistente.id },
              data: {
                  nota: dados.nota > resultadoExistente.nota ? dados.nota : resultadoExistente.nota,
                  aprovado: dados.aprovado || resultadoExistente.aprovado,
                  tentativas: resultadoExistente.tentativas + 1
              }
          });
      } else {
          await db.resultadoProva.create({
              data: {
                  userId: Number(dados.userId),
                  presetId: dados.presetId,
                  nota: dados.nota,
                  aprovado: dados.aprovado,
                  tentativas: 1
              }
          });
      }

      revalidatePath('/PainelAlpha');
      return { success: true };
  } catch (error) {
      console.error("Erro Action Prova:", error);
      return { error: "Falha ao salvar resultado da prova." };
  }
}

export async function buscarProgressosUsuario(userId: number, videoIds: string[]) {
  try {
      const progressos = await db.progressoVideo.findMany({
          where: {
              userId: Number(userId),
              videoId: { in: videoIds },
              concluido: true
          },
          select: { videoId: true }
      });
      return progressos.map(p => p.videoId);
  } catch (error) {
      return [];
  }
}
