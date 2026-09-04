"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import {
  criarCadenciaSchema,
  atualizarCadenciaSchema,
  criarPassoCadenciaSchema,
  atualizarPassoCadenciaSchema,
  reordenarPassosCadenciaSchema,
  iniciarCadenciaCardSchema,
  pausarCadenciaCardSchema,
  cancelarCadenciaCardSchema,
  reativarCadenciaCardSchema,
} from "@/lib/bpm/cadencias/schemas";
import { exigirAcessoBpmCard, exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";
const ROTA_ADMIN_CADENCIAS = `${ROTA_BASE}/admin/cadencias`;

// ─── CRUD de Cadências ───────────────────────────────────────────────────────

export async function CriarCadenciaBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCadencias");

    const parsed = criarCadenciaSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };

    const cadencia = await db.bpmCadencia.create({
      data: {
        nome: parsed.data.nome,
        descricao: parsed.data.descricao,
        pipelineId: parsed.data.pipelineId,
        etapaId: parsed.data.etapaId,
        criadoPorId: userId,
      },
    });

    revalidatePath(ROTA_ADMIN_CADENCIAS);
    return { success: true, data: cadencia };
  } catch (error) {
    console.error("[CriarCadenciaBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado — apenas administradores configuram pipelines" ? error.message : "Erro ao criar cadência";
    return { success: false, error: msg };
  }
}

export async function AtualizarCadenciaBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCadencias");

    const parsed = atualizarCadenciaSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };

    const { id, ...data } = parsed.data;
    const cadencia = await db.bpmCadencia.update({ where: { id }, data });

    revalidatePath(ROTA_ADMIN_CADENCIAS);
    return { success: true, data: cadencia };
  } catch (error) {
    console.error("[AtualizarCadenciaBpm]", error);
    return { success: false, error: "Erro ao atualizar cadência" };
  }
}

export async function AtivarDesativarCadenciaBpm(input: { id: string; ativa: boolean }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCadencias");

    const cadencia = await db.bpmCadencia.update({
      where: { id: input.id },
      data: { ativa: input.ativa },
    });

    revalidatePath(ROTA_ADMIN_CADENCIAS);
    return { success: true, data: cadencia };
  } catch (error) {
    console.error("[AtivarDesativarCadenciaBpm]", error);
    return { success: false, error: "Erro ao ativar/desativar cadência" };
  }
}

export async function ListarCadenciasBpm() {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCadencias");

    const cadencias = await db.bpmCadencia.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        passos: { orderBy: { ordem: "asc" } },
        _count: { select: { vinculos: true } },
      },
    });

    return { success: true, data: cadencias };
  } catch (error) {
    console.error("[ListarCadenciasBpm]", error);
    return { success: false, error: "Erro ao buscar cadências", data: [] };
  }
}

export async function ObterCadenciaBpm(cadenciaId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCadencias");

    const cadencia = await db.bpmCadencia.findUnique({
      where: { id: cadenciaId },
      include: {
        passos: { orderBy: { ordem: "asc" } },
        vinculos: {
          where: { status: "ATIVA" },
          include: { card: { select: { id: true, empresaId: true } } },
        },
      },
    });

    if (!cadencia) return { success: false, error: "Cadência não encontrada" };
    return { success: true, data: cadencia };
  } catch (error) {
    console.error("[ObterCadenciaBpm]", error);
    return { success: false, error: "Erro ao buscar cadência" };
  }
}

// ─── CRUD de Passos ──────────────────────────────────────────────────────────

export async function CriarPassoCadenciaBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCadencias");

    const parsed = criarPassoCadenciaSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };

    const passo = await db.bpmCadenciaPasso.create({ data: parsed.data });

    revalidatePath(ROTA_ADMIN_CADENCIAS);
    return { success: true, data: passo };
  } catch (error) {
    console.error("[CriarPassoCadenciaBpm]", error);
    return { success: false, error: "Erro ao criar passo da cadência" };
  }
}

export async function AtualizarPassoCadenciaBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCadencias");

    const parsed = atualizarPassoCadenciaSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };

    const { id, ...data } = parsed.data;
    const passo = await db.bpmCadenciaPasso.update({ where: { id }, data });

    revalidatePath(ROTA_ADMIN_CADENCIAS);
    return { success: true, data: passo };
  } catch (error) {
    console.error("[AtualizarPassoCadenciaBpm]", error);
    return { success: false, error: "Erro ao atualizar passo da cadência" };
  }
}

export async function RemoverPassoCadenciaBpm(passoId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCadencias");

    await db.bpmCadenciaPasso.delete({ where: { id: passoId } });

    revalidatePath(ROTA_ADMIN_CADENCIAS);
    return { success: true };
  } catch (error) {
    console.error("[RemoverPassoCadenciaBpm]", error);
    return { success: false, error: "Erro ao remover passo da cadência" };
  }
}

export async function ReordenarPassosCadenciaBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCadencias");

    const parsed = reordenarPassosCadenciaSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };

    const updates = parsed.data.passoIds.map((id, index) =>
      db.bpmCadenciaPasso.update({ where: { id }, data: { ordem: index + 1 } }),
    );
    await db.$transaction(updates);

    revalidatePath(ROTA_ADMIN_CADENCIAS);
    return { success: true };
  } catch (error) {
    console.error("[ReordenarPassosCadenciaBpm]", error);
    return { success: false, error: "Erro ao reordenar passos da cadência" };
  }
}

// ─── Vínculos Card × Cadência ────────────────────────────────────────────────

export async function IniciarCadenciaCardBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = iniciarCadenciaCardSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { cardId, cadenciaId } = parsed.data;

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");

    const cadencia = await db.bpmCadencia.findUnique({
      where: { id: cadenciaId },
      include: { passos: { where: { ativo: true }, orderBy: { ordem: "asc" } } },
    });
    if (!cadencia || !cadencia.ativa) return { success: false, error: "Cadência inexistente ou inativa" };
    if (cadencia.passos.length === 0) return { success: false, error: "Cadência sem passos ativos" };

    const card = await db.bpmCard.findUnique({ where: { id: cardId }, select: { id: true, pipelineId: true } });
    if (!card) return { success: false, error: "Card não encontrado" };

    const primeiroPasso = cadencia.passos[0];
    const proximaExecucao = new Date(Date.now() + primeiroPasso.intervaloDias * 86400000);
    const agora = new Date();

    const vinculo = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard", tx);
      const criado = await tx.bpmCardCadencia.upsert({
        where: { cardId_cadenciaId: { cardId, cadenciaId } },
        update: {
          status: "ATIVA",
          passoAtualOrdem: 1,
          proximaExecucaoEm: proximaExecucao,
          iniciadaEm: agora,
          concluidaEm: null,
          motivoInterrupcao: null,
        },
        create: {
          cardId,
          cadenciaId,
          status: "ATIVA",
          passoAtualOrdem: 1,
          proximaExecucaoEm: proximaExecucao,
          iniciadaEm: agora,
        },
      });
      await registrarHistoricoCard(
        {
          cardId,
          acao: "CADENCIA_INICIADA",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ cadenciaId, nomeCadencia: cadencia.nome }),
        },
        tx,
      );
      return criado;
    });

    revalidatePath(`${ROTA_BASE}/pipeline/${card.pipelineId}`);
    await notificarPipelineBpm({ pipelineId: card.pipelineId, tipo: "TAREFA_ALTERADA" });

    return { success: true, data: vinculo };
  } catch (error) {
    console.error("[IniciarCadenciaCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao iniciar cadência no card";
    return { success: false, error: msg };
  }
}

async function localizarCardDoVinculo(vinculoId: string) {
  const vinculo = await db.bpmCardCadencia.findUnique({ where: { id: vinculoId }, select: { cardId: true } });
  if (!vinculo) throw new Error("Vínculo não encontrado");
  return vinculo.cardId;
}

export async function PausarCadenciaCardBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = pausarCadenciaCardSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };

    const cardId = await localizarCardDoVinculo(parsed.data.vinculoId);
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");

    const vinculo = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard", tx);
      const atualizado = await tx.bpmCardCadencia.update({
        where: { id: parsed.data.vinculoId },
        data: { status: "PAUSADA", motivoInterrupcao: parsed.data.motivo ?? null },
      });
      await registrarHistoricoCard(
        {
          cardId,
          acao: "CADENCIA_PAUSADA",
          usuarioId: userId,
          valorNovoJson: parsed.data.motivo ? JSON.stringify({ motivo: parsed.data.motivo }) : undefined,
        },
        tx,
      );
      return atualizado;
    });

    revalidatePath(ROTA_BASE);
    return { success: true, data: vinculo };
  } catch (error) {
    console.error("[PausarCadenciaCardBpm]", error);
    const msg = error instanceof Error && (error.message === "Não autorizado" || error.message === "Vínculo não encontrado") ? error.message : "Erro ao pausar cadência";
    return { success: false, error: msg };
  }
}

export async function CancelarCadenciaCardBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = cancelarCadenciaCardSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };

    const cardId = await localizarCardDoVinculo(parsed.data.vinculoId);
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");

    const vinculo = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard", tx);
      const atualizado = await tx.bpmCardCadencia.update({
        where: { id: parsed.data.vinculoId },
        data: { status: "CANCELADA", motivoInterrupcao: parsed.data.motivo ?? null, concluidaEm: new Date() },
      });
      await registrarHistoricoCard(
        {
          cardId,
          acao: "CADENCIA_CANCELADA",
          usuarioId: userId,
          valorNovoJson: parsed.data.motivo ? JSON.stringify({ motivo: parsed.data.motivo }) : undefined,
        },
        tx,
      );
      return atualizado;
    });

    revalidatePath(ROTA_BASE);
    return { success: true, data: vinculo };
  } catch (error) {
    console.error("[CancelarCadenciaCardBpm]", error);
    const msg = error instanceof Error && (error.message === "Não autorizado" || error.message === "Vínculo não encontrado") ? error.message : "Erro ao cancelar cadência";
    return { success: false, error: msg };
  }
}

export async function ReativarCadenciaCardBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = reativarCadenciaCardSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };

    const cardId = await localizarCardDoVinculo(parsed.data.vinculoId);
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");

    const vinculo = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard", tx);
      const atualizado = await tx.bpmCardCadencia.update({
        where: { id: parsed.data.vinculoId },
        data: { status: "ATIVA", motivoInterrupcao: null },
      });
      await registrarHistoricoCard({ cardId, acao: "CADENCIA_REATIVADA", usuarioId: userId }, tx);
      return atualizado;
    });

    revalidatePath(ROTA_BASE);
    return { success: true, data: vinculo };
  } catch (error) {
    console.error("[ReativarCadenciaCardBpm]", error);
    const msg = error instanceof Error && (error.message === "Não autorizado" || error.message === "Vínculo não encontrado") ? error.message : "Erro ao reativar cadência";
    return { success: false, error: msg };
  }
}

export async function ListarCadenciasDoCardBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "visualizar");

    const vinculos = await db.bpmCardCadencia.findMany({
      where: { cardId },
      include: {
        cadencia: {
          include: {
            passos: { where: { ativo: true }, orderBy: { ordem: "asc" } },
          },
        },
        execucoes: { orderBy: { createdAt: "desc" }, take: 20 },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: vinculos };
  } catch (error) {
    console.error("[ListarCadenciasDoCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao buscar cadências do card";
    return { success: false, error: msg, data: [] };
  }
}
