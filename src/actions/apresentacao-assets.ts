"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import db from "@/lib/prisma";

function isAdmin(role?: string) {
  return role === "Admin" || role === "CEO";
}

export async function ExcluirAssetApresentacao(assetId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    if (!assetId) return { success: false, error: "Asset inválido" };

    const userId = Number(session.user.id);
    const asset = await db.apresentacaoAsset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        url: true,
        apresentacaoId: true,
        apresentacao: {
          select: {
            autorId: true,
            colaboradores: { where: { userId, papel: { in: ["EDITOR"] } }, select: { id: true } },
            slides: { select: { dadosJson: true } },
          },
        },
      },
    });
    if (!asset) return { success: false, error: "Asset não encontrado" };

    const autorizado = isAdmin(session.user.role)
      || asset.apresentacao.autorId === userId
      || asset.apresentacao.colaboradores.length > 0;
    if (!autorizado) return { success: false, error: "Sem permissão" };

    const emUso = asset.apresentacao.slides.some((slide) => JSON.stringify(slide.dadosJson).includes(asset.url));
    if (emUso) return { success: false, error: "Este arquivo está em uso em um slide. Remova o componente antes de excluir." };

    await db.apresentacaoAsset.delete({ where: { id: asset.id } });
    await del(asset.url, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch((error: unknown) => {
      console.error("[ExcluirAssetApresentacao:blob]", error);
    });

    revalidatePath(`/PainelAlpha/Apresentacoes/${asset.apresentacaoId}/editor`);
    return { success: true };
  } catch (error) {
    console.error("[ExcluirAssetApresentacao]", error);
    return { success: false, error: "Erro ao excluir arquivo" };
  }
}
