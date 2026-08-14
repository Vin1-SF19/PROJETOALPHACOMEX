"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { criarVinculoCardSchema } from "@/lib/validations/bpm";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

/**
 * Cria vínculo entre dois cards (D-027): apenas rastreabilidade e histórico
 * cruzado, sem sincronização automática de estado entre os cards.
 */
export async function CriarVinculoCardBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = criarVinculoCardSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { cardOrigemId, cardDestinoId } = parsed.data;

    if (cardOrigemId === cardDestinoId) {
      return { success: false, error: "Um card não pode se vincular a si mesmo" };
    }

    await exigirAcessoBpmCard(cardOrigemId, userId, session.user.role ?? null, "editarCard");
    await exigirAcessoBpmCard(cardDestinoId, userId, session.user.role ?? null, "editarCard");

    const vinculo = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(cardOrigemId, userId, session.user.role ?? null, "editarCard", tx);
      await exigirAcessoBpmCard(cardDestinoId, userId, session.user.role ?? null, "editarCard", tx);
      const criado = await tx.bpmCardVinculo.create({ data: { cardOrigemId, cardDestinoId } });
      await registrarHistoricoCard(
        {
          cardId: cardOrigemId,
          acao: "VINCULO_CRIADO",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ cardDestinoId }),
        },
        tx,
      );
      await registrarHistoricoCard(
        {
          cardId: cardDestinoId,
          acao: "VINCULO_CRIADO",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ cardOrigemId }),
        },
        tx,
      );
      return criado;
    });

    revalidatePath(`${ROTA_BASE}/pipeline`);
    await Promise.all([
      notificarPipelineBpm({ cardId: cardOrigemId, tipo: "VINCULO_CRIADO" }),
      notificarPipelineBpm({ cardId: cardDestinoId, tipo: "VINCULO_CRIADO" }),
    ]);
    return { success: true, data: vinculo };
  } catch (error) {
    console.error("[CriarVinculoCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao criar vínculo";
    return { success: false, error: msg };
  }
}

/** Histórico cruzado (D-027): agrega o histórico do card e de todos os cards vinculados a ele. */
export async function ObterHistoricoCruzadoBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "visualizarHistorico");

    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      include: {
        vinculosOrigem: { select: { cardDestinoId: true } },
        vinculosDestino: { select: { cardOrigemId: true } },
      },
    });
    if (!card) return { success: false, error: "Card não encontrado", data: [] };

    const cardIdsRelacionados = [
      cardId,
      ...card.vinculosOrigem.map((v) => v.cardDestinoId),
      ...card.vinculosDestino.map((v) => v.cardOrigemId),
    ];

    const acessosRelacionados = await Promise.all(
      cardIdsRelacionados.map(async (id) => {
        try {
          await exigirAcessoBpmCard(id, userId, session.user.role ?? null, "visualizarHistorico");
          return id;
        } catch {
          return null;
        }
      }),
    );
    const cardIdsVisiveis = acessosRelacionados.filter((id): id is string => Boolean(id));
    const historico = await db.bpmCardHistorico.findMany({
      where: { cardId: { in: cardIdsVisiveis } },
      include: {
        card: {
          select: {
            id: true,
            pipeline: { select: { nome: true } },
            empresa: { select: { razaoSocial: true } },
          },
        },
        usuario: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return { success: true, data: historico };
  } catch (error) {
    console.error("[ObterHistoricoCruzadoBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao buscar histórico cruzado";
    return { success: false, error: msg, data: [] };
  }
}
