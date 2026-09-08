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
  alternarCadenciaSchema,
  configurarCadenciaEtapaSchema,
  cadenciaIdSchema,
  passoCadenciaIdSchema,
  cardCadenciaIdSchema,
} from "@/lib/bpm/cadencias/schemas";
import { exigirAcessoBpmCard, exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import {
  CADENCIA_MANUAL_DESABILITADA,
  validarEscopoCadenciaBpm,
} from "@/lib/bpm/cadencias/ativacao-automatica";

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

    const cadencia = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarCadencias", tx);
      await validarEscopoCadenciaBpm(parsed.data, tx);
      return tx.bpmCadencia.create({
        data: {
          nome: parsed.data.nome,
          descricao: parsed.data.descricao,
          pipelineId: parsed.data.pipelineId,
          etapaId: parsed.data.etapaId,
          ativa: parsed.data.ativa,
          criadoPorId: userId,
        },
      });
    }, { isolationLevel: "Serializable" });

    revalidatePath(ROTA_ADMIN_CADENCIAS);
    return { success: true, data: cadencia };
  } catch (error) {
    console.error("[CriarCadenciaBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado — apenas administradores configuram pipelines"
      ? error.message
      : error instanceof Error && error.message === "CADENCIA_ESCOPO_OBRIGATORIO"
        ? "Selecione o pipeline e a coluna da cadência."
        : error instanceof Error && error.message === "CADENCIA_ETAPA_FORA_PIPELINE"
          ? "A etapa selecionada não pertence ao pipeline informado."
          : error instanceof Error && error.message === "CADENCIA_ETAPA_AMBIGUA"
            ? "Esta coluna já possui uma cadência ativa. Selecione-a no editor do pipeline ou desative-a antes de criar outra."
          : "Erro ao criar cadência";
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
    const cadencia = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarCadencias", tx);
      const atual = await tx.bpmCadencia.findUnique({
        where: { id },
        select: { pipelineId: true, etapaId: true, ativa: true },
      });
      if (!atual) throw new Error("CADENCIA_NAO_ENCONTRADA");
      const pipelineId = data.pipelineId === undefined ? atual.pipelineId : data.pipelineId;
      const etapaId = data.etapaId === undefined ? atual.etapaId : data.etapaId;
      await validarEscopoCadenciaBpm({ pipelineId, etapaId }, tx);
      return tx.bpmCadencia.update({ where: { id }, data });
    }, { isolationLevel: "Serializable" });

    revalidatePath(ROTA_ADMIN_CADENCIAS);
    return { success: true, data: cadencia };
  } catch (error) {
    console.error("[AtualizarCadenciaBpm]", error);
    const msg = error instanceof Error && error.message === "CADENCIA_ESCOPO_OBRIGATORIO"
      ? "Selecione o pipeline e a coluna da cadência."
      : error instanceof Error && error.message === "CADENCIA_ETAPA_FORA_PIPELINE"
        ? "A etapa selecionada não pertence ao pipeline informado."
        : error instanceof Error && error.message === "CADENCIA_ETAPA_AMBIGUA"
          ? "Esta coluna já possui outra cadência ativa."
        : error instanceof Error && error.message === "CADENCIA_NAO_ENCONTRADA"
          ? "Cadência não encontrada."
          : "Erro ao atualizar cadência";
    return { success: false, error: msg };
  }
}

export async function AtivarDesativarCadenciaBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCadencias");
    const parsed = alternarCadenciaSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };

    const cadencia = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarCadencias", tx);
      const atual = await tx.bpmCadencia.findUnique({
        where: { id: parsed.data.id },
        select: { id: true, pipelineId: true, etapaId: true },
      });
      if (!atual) throw new Error("CADENCIA_NAO_ENCONTRADA");
      if (parsed.data.ativa) await validarEscopoCadenciaBpm(atual, tx);
      return tx.bpmCadencia.update({
        where: { id: parsed.data.id },
        data: { ativa: parsed.data.ativa },
      });
    }, { isolationLevel: "Serializable" });

    revalidatePath(ROTA_ADMIN_CADENCIAS);
    return { success: true, data: cadencia };
  } catch (error) {
    console.error("[AtivarDesativarCadenciaBpm]", error);
    const msg = error instanceof Error && error.message === "CADENCIA_ESCOPO_OBRIGATORIO"
      ? "Associe a cadência a uma coluna antes de ativá-la."
      : error instanceof Error && error.message === "CADENCIA_ETAPA_AMBIGUA"
        ? "Esta coluna já possui outra cadência ativa."
        : "Erro ao ativar/desativar cadência";
    return { success: false, error: msg };
  }
}

export async function ConfigurarCadenciaEtapaBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCadencias");
    const parsed = configurarCadenciaEtapaSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };

    const { pipelineId, etapaId, cadenciaId } = parsed.data;
    const resultado = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarCadencias", tx);
      await validarEscopoCadenciaBpm({ pipelineId, etapaId }, tx);
      const selecionada = cadenciaId
        ? await tx.bpmCadencia.findUnique({
            where: { id: cadenciaId },
            select: { id: true, pipelineId: true, etapaId: true },
          })
        : null;
      if (cadenciaId && !selecionada) throw new Error("CADENCIA_NAO_ENCONTRADA");
      if (selecionada?.pipelineId && selecionada.pipelineId !== pipelineId) {
        throw new Error("CADENCIA_FORA_PIPELINE");
      }

      if (!selecionada) {
        await tx.bpmCadencia.updateMany({
          where: { pipelineId, etapaId, ativa: true },
          data: { ativa: false },
        });
        return { cadenciaId: null };
      }
      const cadencia = await tx.bpmCadencia.update({
        where: { id: selecionada.id },
        data: { pipelineId, etapaId, ativa: true },
      });
      return { cadenciaId: cadencia.id };
    }, { isolationLevel: "Serializable" });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    revalidatePath(ROTA_ADMIN_CADENCIAS);
    return { success: true, data: resultado };
  } catch (error) {
    console.error("[ConfigurarCadenciaEtapaBpm]", error);
    const msg = error instanceof Error && error.message === "CADENCIA_FORA_PIPELINE"
      ? "A cadência selecionada pertence a outro pipeline."
      : error instanceof Error && error.message === "CADENCIA_NAO_ENCONTRADA"
        ? "Cadência não encontrada."
        : error instanceof Error && error.message === "CADENCIA_ETAPA_FORA_PIPELINE"
          ? "A coluna não pertence ao pipeline informado."
          : "Erro ao configurar a cadência da coluna";
    return { success: false, error: msg };
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
        pipeline: { select: { id: true, nome: true } },
        etapa: { select: { id: true, nome: true } },
        passos: { orderBy: { ordem: "asc" } },
        _count: { select: { vinculos: true } },
      },
      take: 200,
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
    const parsedId = cadenciaIdSchema.safeParse(cadenciaId);
    if (!parsedId.success) return { success: false, error: "Cadência inválida" };

    const cadencia = await db.bpmCadencia.findUnique({
      where: { id: parsedId.data },
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

    const passo = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarCadencias", tx);
      const cadencia = await tx.bpmCadencia.findUnique({
        where: { id: parsed.data.cadenciaId },
        select: { id: true },
      });
      if (!cadencia) throw new Error("CADENCIA_NAO_ENCONTRADA");
      return tx.bpmCadenciaPasso.create({ data: parsed.data });
    });

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
    const passo = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarCadencias", tx);
      const atual = await tx.bpmCadenciaPasso.findUnique({ where: { id }, select: { id: true } });
      if (!atual) throw new Error("PASSO_NAO_ENCONTRADO");
      return tx.bpmCadenciaPasso.update({ where: { id }, data });
    });

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
    const parsedId = passoCadenciaIdSchema.safeParse(passoId);
    if (!parsedId.success) return { success: false, error: "Passo inválido" };

    await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarCadencias", tx);
      const atual = await tx.bpmCadenciaPasso.findUnique({ where: { id: parsedId.data }, select: { id: true } });
      if (!atual) throw new Error("PASSO_NAO_ENCONTRADO");
      await tx.bpmCadenciaPasso.delete({ where: { id: parsedId.data } });
    });

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

    await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarCadencias", tx);
      const passos = await tx.bpmCadenciaPasso.findMany({
        where: { id: { in: parsed.data.passoIds }, cadenciaId: parsed.data.cadenciaId },
        select: { id: true },
      });
      if (passos.length !== parsed.data.passoIds.length) throw new Error("PASSOS_FORA_CADENCIA");
      await Promise.all(parsed.data.passoIds.map((id, index) =>
        tx.bpmCadenciaPasso.update({ where: { id }, data: { ordem: index + 1 } }),
      ));
    });

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
    const { cardId } = parsed.data;

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");
    return { success: false, error: CADENCIA_MANUAL_DESABILITADA };
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
    return { success: false, error: CADENCIA_MANUAL_DESABILITADA };
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

    const resultado = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard", tx);
      const atualizacao = await tx.bpmCardCadencia.updateMany({
        where: { id: parsed.data.vinculoId, status: { in: ["ATIVA", "PAUSADA"] } },
        data: { status: "CANCELADA", motivoInterrupcao: parsed.data.motivo ?? null, concluidaEm: new Date() },
      });
      const atualizado = await tx.bpmCardCadencia.findUnique({
        where: { id: parsed.data.vinculoId },
        include: { card: { select: { pipelineId: true } } },
      });
      if (!atualizado) throw new Error("Vínculo não encontrado");
      if (atualizacao.count !== 1) return { vinculo: atualizado, alterado: false };
      await registrarHistoricoCard(
        {
          cardId,
          acao: "CADENCIA_CANCELADA",
          usuarioId: userId,
          valorNovoJson: parsed.data.motivo ? JSON.stringify({ motivo: parsed.data.motivo }) : undefined,
        },
        tx,
      );
      return { vinculo: atualizado, alterado: true };
    });

    revalidatePath(ROTA_BASE);
    if (resultado.alterado) {
      await notificarPipelineBpm({
        pipelineId: resultado.vinculo.card.pipelineId,
        cardId,
        tipo: "CARD_ATUALIZADO",
      });
    }
    return { success: true, data: resultado.vinculo };
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
    return { success: false, error: CADENCIA_MANUAL_DESABILITADA };
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
    const parsedId = cardCadenciaIdSchema.safeParse(cardId);
    if (!parsedId.success) return { success: false, error: "Card inválido", data: [] };
    await exigirAcessoBpmCard(parsedId.data, userId, session.user.role ?? null, "visualizar");

    const vinculos = await db.bpmCardCadencia.findMany({
      where: { cardId: parsedId.data },
      include: {
        cadencia: {
          include: {
            pipeline: { select: { id: true, nome: true } },
            etapa: { select: { id: true, nome: true } },
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
