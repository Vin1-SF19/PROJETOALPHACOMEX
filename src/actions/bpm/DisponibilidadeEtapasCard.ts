"use server";

import { randomUUID } from "node:crypto";
import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { avaliarTransicaoBpm } from "@/lib/bpm/transicao-command";
import { ObterRequisitosTransicaoBpm } from "./Cards";

export type DisponibilidadeEtapaCard = {
  etapaId: string;
  pendencias: string[];
  oculta: boolean;
};

const ERROS_DESTINO_INACESSIVEL = new Set([
  "UNAUTHORIZED",
  "UNAUTHORIZED_DESTINATION",
  "REQUESTER_NOT_ALLOWED",
  "INVALID_DESTINATION",
  "TRANSITION_NOT_DEFINED",
  "TRANSITION_DISABLED",
  "STAGE_EXIT_BLOCKED",
]);

export async function ObterDisponibilidadeEtapasCardBpm(cardId: string, etapaIds: string[]) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    if (!Array.isArray(etapaIds) || etapaIds.length > 30 || etapaIds.some((id) => typeof id !== "string")) {
      return { success: false as const, error: "Destinos inválidos" };
    }
    const userId = Number(session.user.id);
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "visualizar");
    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: {
        etapaId: true,
        etapa: {
          select: {
            transicoesEtapaOrigem: {
              where: { permitida: true, origem: { in: ["MANUAL", "AMBOS"] } },
              select: { etapaDestinoId: true },
            },
          },
        },
      },
    });
    if (!card) return { success: false as const, error: "Card não encontrado" };

    const permitidos = new Set(card.etapa.transicoesEtapaOrigem.map((transicao) => transicao.etapaDestinoId));
    const destinos = [...new Set(etapaIds)].filter((id) => id !== card.etapaId && permitidos.has(id));
    const data: DisponibilidadeEtapaCard[] = await Promise.all(destinos.map(async (etapaId) => {
      const [previa, validacao] = await Promise.all([
        ObterRequisitosTransicaoBpm(cardId, etapaId),
        avaliarTransicaoBpm({
          cardId,
          etapaOrigemEsperadaId: card.etapaId,
          etapaDestinoId: etapaId,
          idempotencyKey: randomUUID(),
          ator: { tipo: "MANUAL", userId, userRole: session.user.role ?? null },
        }),
      ]);

      if (!validacao.success && ERROS_DESTINO_INACESSIVEL.has(validacao.code)) {
        return { etapaId, pendencias: [], oculta: true };
      }
      const pendencias = previa.success && previa.data
        ? [
            ...previa.data.faltantes.map((campo) => campo.nome),
            ...previa.data.guardas,
          ]
        : [typeof previa.error === "string" ? previa.error : "Não foi possível verificar os requisitos desta etapa."];

      // A atribuição do lead é resolvida no diálogo já existente durante a movimentação.
      if (!validacao.success && validacao.code !== "ASSIGNMENT_REQUIRED") {
        if (validacao.code === "REQUIREMENTS_PENDING" && validacao.pendencias?.length) {
          pendencias.push(...validacao.pendencias);
        } else {
          pendencias.push(validacao.error);
        }
      }
      return { etapaId, pendencias: [...new Set(pendencias.filter(Boolean))], oculta: false };
    }));
    return { success: true as const, data };
  } catch (error) {
    console.error("[ObterDisponibilidadeEtapasCardBpm]", error);
    return { success: false as const, error: "Não foi possível verificar as etapas disponíveis." };
  }
}
