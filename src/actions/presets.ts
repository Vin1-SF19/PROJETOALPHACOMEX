"use server";

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createPresetAction(dados: { nome: string; videosIds: string[]; usuariosIds: string[]; perguntas?: unknown[] }) {
  try {
    const { nome, videosIds, usuariosIds } = dados;
    const idsNumericos = usuariosIds.map((id: string) => Number(id));

    const usuariosJaVinculados = await db.usuarios.findMany({
      where: {
        id: { in: idsNumericos },
        presets: {
          some: {}
        }
      },
      select: { nome: true, usuario: true }
    });

    if (usuariosJaVinculados.length > 0) {
      const nomes = usuariosJaVinculados.map(u => u.nome || u.usuario).join(", ");
      return {
        success: false,
        error: `O(s) colaborador(es) [${nomes}] já fazem parte de um preset ativo. Remova-os para prosseguir.`
      };
    }

    const novo = await db.preset.create({
      data: {
        nome,
        videos: { connect: videosIds.map((id: string) => ({ id })) },
        usuarios: { connect: idsNumericos.map((id: number) => ({ id })) },
      },
      include: { videos: true, usuarios: true }
    });

    return { success: true, data: novo };
  } catch (error) {
    return { success: false, error: "Erro ao processar criação no Banco Alpha." };
  }
}

export async function getPresets() {
  try {
    const presets = await db.preset.findMany({
      include: {
        videos: {
          select: {
            id: true,
            titulo: true,
            thumbUrl: true,
            setor: true
          }
        },
        usuarios: {
          select: {
            id: true,
            usuario: true,
            email: true
          }
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return presets;
  } catch (error) {
    console.error("Erro ao buscar presets:", error);
    return [];
  }
}

export async function deletarPresetAction(id: string) {
  try {
    await db.preset.delete({
      where: { id }
    });
    revalidatePath('/PainelAlpha/AlphaSchools/presets');
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar:", error);
    return { success: false, error: "Falha ao remover o preset do sistema." };
  }
}
