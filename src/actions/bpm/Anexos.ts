"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { registrarAnexoSchema } from "@/lib/validations/bpm";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { registrarHistoricoCard } from "./Cards";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

export async function RegistrarAnexoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = registrarAnexoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { cardId, url, nome, tipo, tamanho } = parsed.data;

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "enviarArquivo");

    const anexo = await db.$transaction(async (tx) => {
      const criado = await tx.bpmCardAnexo.create({
        data: { cardId, url, nome, tipo, tamanho, enviadoPorId: userId },
      });
      await registrarHistoricoCard(
        {
          cardId,
          acao: "ANEXO_ADICIONADO",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ nome, tamanho }),
        },
        tx,
      );
      return criado;
    });

    revalidatePath(`${ROTA_BASE}/pipeline`);
    await notificarPipelineBpm({ cardId, tipo: "ANEXO_ALTERADO" });
    return { success: true, data: anexo };
  } catch (error) {
    console.error("[RegistrarAnexoBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao registrar anexo";
    return { success: false, error: msg };
  }
}

export async function ExcluirAnexoBpm(anexoId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const anexo = await db.bpmCardAnexo.findUnique({ where: { id: anexoId } });
    if (!anexo) return { success: false, error: "Anexo não encontrado" };

    await exigirAcessoBpmCard(anexo.cardId, userId, session.user.role ?? null, "excluirArquivo");

    await db.$transaction(async (tx) => {
      await tx.bpmCardAnexo.delete({ where: { id: anexoId } });
      await registrarHistoricoCard(
        {
          cardId: anexo.cardId,
          acao: "ANEXO_EXCLUIDO",
          usuarioId: userId,
          valorAnteriorJson: JSON.stringify({ nome: anexo.nome }),
        },
        tx,
      );
    });

    revalidatePath(`${ROTA_BASE}/pipeline`);
    await notificarPipelineBpm({ cardId: anexo.cardId, tipo: "ANEXO_ALTERADO" });
    return { success: true };
  } catch (error) {
    console.error("[ExcluirAnexoBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao excluir anexo";
    return { success: false, error: msg };
  }
}
