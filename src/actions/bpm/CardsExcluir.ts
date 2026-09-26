"use server";
import db from "@/lib/prisma";
import { auth } from "../../../auth";
import { revalidatePath } from "next/cache";
import { excluirCardSchema } from "@/lib/validations/bpm";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

/**
 * Arquiva um card do BPM (soft-delete) — preserva eventos, auditoria,
 * automações e vínculos; o card sai do board via filtro `status = "ATIVO"`.
 *
 * Política (RM-2026-1FFBAA, decisions.md 2026-09-22):
 * - NÃO usar exclusão física: há relações Restrict (incluindo eventos e
 *   auditoria) e Cascade no schema; dependências restritivas impedem o delete.
 * - NÃO substituir Restrict por Cascade sem justificativa registrada.
 * - O card arquivado permanece consultável em auditoria e histórico.
 *
 * Permissão: `excluirCard` — autorizada para card-roles RESPONSAVEL/ADMINISTRADOR
 * e para Admin/CEO/TI global (bypass em `checarAcessoBpmCard`).
 */
export async function ExcluirCardBpm(cardId: string) {
  let userId: number | null = null;
  let userRole: string | null = null;
  const startedAt = Date.now();
  try {
    const authStartedAt = Date.now();
    const session = await auth();
    console.info("[ExcluirCardBpm] auth", { cardId, durationMs: Date.now() - authStartedAt });
    if (!session?.user?.id) {
      return { success: false, error: "NÃO_AUTORIZADO", mensagem: "Você não tem permissão para excluir este card." };
    }
    const authenticatedUserId = Number(session.user.id);
    userId = authenticatedUserId;
    userRole = session.user.role ?? null;

    if (!excluirCardSchema.safeParse({ cardId }).success) {
      return { success: false, error: "Card inválido" };
    }

    // Verificação de permissão no servidor (nunca confiar no client)
    const permissionStartedAt = Date.now();
    await exigirAcessoBpmCard(cardId, authenticatedUserId, userRole, "excluirCard");
    console.info("[ExcluirCardBpm] permission", { cardId, durationMs: Date.now() - permissionStartedAt });

    // Obter pipelineId antes do arquivamento (para notificação/revalidação)
    const findStartedAt = Date.now();
    const cardAntes = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: { pipelineId: true },
    });
    console.info("[ExcluirCardBpm] findCard", { cardId, durationMs: Date.now() - findStartedAt });
    if (!cardAntes) return { success: false, error: "Card não encontrado" };

    // Soft-delete (arquivamento) — preserva eventos, auditoria e automações.
    // O card sai do board via filtro status = "ATIVO" nas queries de listagem.
    const txStartedAt = Date.now();
    await db.$transaction(async (tx) => {
      // Revalida a permissão dentro da mesma transação para que uma mudança
      // concorrente na visibilidade da etapa não abra uma janela TOCTOU.
      await exigirAcessoBpmCard(
        cardId,
        authenticatedUserId,
        userRole,
        "excluirCard",
        tx,
      );
      const cardAtual = await tx.bpmCard.findUnique({
        where: { id: cardId },
        select: { status: true },
      });
      if (!cardAtual) throw new Error("Card não encontrado");
      if (cardAtual.status === "ARQUIVADO") return;
      await tx.bpmCard.update({
        where: { id: cardId },
        data: { status: "ARQUIVADO" },
      });
      await tx.bpmCardHistorico.create({
        data: {
          cardId,
          acao: "CARD_ARQUIVADO",
          usuarioId: authenticatedUserId,
          valorAnteriorJson: JSON.stringify({ status: cardAtual.status }),
          valorNovoJson: JSON.stringify({ status: "ARQUIVADO" }),
        },
      });
    });
    console.info("[ExcluirCardBpm] transaction", { cardId, durationMs: Date.now() - txStartedAt });

    // Notificar em tempo real (best-effort) + revalidar cache.
    // A mutação já foi commitada; falha de transporte do Pusher não deve
    // reverter a exclusão nem reportar erro ao chamador.
    const notifyStartedAt = Date.now();
    try {
      await notificarPipelineBpm({ pipelineId: cardAntes.pipelineId, cardId, tipo: "CARD_EXCLUIDO" });
    } catch (notifyError) {
      console.error("[ExcluirCardBpm] Falha na notificação realtime (exclusão já persistida)", notifyError);
    }
    console.info("[ExcluirCardBpm] realtime", { cardId, durationMs: Date.now() - notifyStartedAt });
    revalidatePath(`${ROTA_BASE}/pipeline/${cardAntes.pipelineId}`);
    revalidatePath(ROTA_BASE);

    console.info("[ExcluirCardBpm] completed", { cardId, totalMs: Date.now() - startedAt });
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Não autorizado") {
      console.error("[ExcluirCardBpm] NÃO_AUTORIZADO", { cardId, userId, userRole });
      return { success: false, error: "NÃO_AUTORIZADO", mensagem: "Você não tem permissão para excluir este card." };
    }
    const errorCode = error && typeof error === "object" && "code" in error ? error.code : null;
    if (errorCode === "P2003" || errorCode === "P2014") {
      console.error("[ExcluirCardBpm] DEPENDENCIA_EXISTENTE", error);
      return { success: false, error: "DEPENDENCIA_EXISTENTE", mensagem: "Este card possui dependências ativas. Verifique antes de excluir." };
    }
    console.error("[ExcluirCardBpm] FALHA_TECNICA", error);
    return { success: false, error: "FALHA_TECNICA", mensagem: "Ocorreu um erro ao excluir o card. Tente novamente." };
  }
}
