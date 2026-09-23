"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "../../../auth";
import {
  CARD_KANBAN_NATIVE_REGISTRY,
  cardKanbanComposicaoSchema,
  composicaoCardKanbanSemAlteracao,
  desserializarComposicaoCardKanban,
  serializarComposicaoCardKanban,
  type CardKanbanComposicao,
} from "@/lib/bpm/card-kanban";
import { avancarConfigVersionBpm } from "@/lib/bpm/config-version";
import { exigirAcessoBpmPipeline, exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { formatCNPJ } from "@/lib/format-cnpj";
import { paraExibicaoTelefone } from "@/lib/validations/cs-nps";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import db from "@/lib/prisma";

const idSchema = z.string().trim().min(1).max(200);

/** Valores reais de um card da etapa para a prévia do editor, inclusive campos ainda não publicados. */
export async function ObterValoresExemploCardKanban(pipelineId: string, etapaId: string, cardId: string) {
  try {
    const ids = z.tuple([idSchema, idSchema, idSchema]).safeParse([pipelineId, etapaId, cardId]);
    if (!ids.success) return { success: false as const, error: "Identificador inválido" };
    const session = await auth();
    const userId = Number(session?.user?.id);
    if (!Number.isSafeInteger(userId) || userId <= 0)
      return { success: false as const, error: "Não autorizado" };
    await exigirAcessoConfigPipeline(userId, "configurarEtapas");
    await exigirAcessoBpmPipeline(pipelineId, userId);
    const card = await db.bpmCard.findFirst({
      where: { id: cardId, pipelineId, etapaId, status: "ATIVO" },
      select: {
        empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true } },
        campoValores: {
          where: { campo: { ativo: true, etapaConfiguracoes: { some: { etapaId, visivel: true } },
            OR: [{ pipelineId }, { pipelinesAssociados: { some: { pipelineId } } }] } },
          select: { valor: true, campo: { select: { id: true, nome: true } } },
        },
      },
    });
    if (!card) return { success: false as const, error: "Card não encontrado nesta etapa" };
    const vinculos = await db.pessoaClienteVinculo.findMany({
      where: { clienteId: card.empresa.id },
      select: { pessoa: { select: { celular: true } } },
      orderBy: { pessoa: { nome: "asc" } },
    });
    const telefone = vinculos.map((vinculo) => paraExibicaoTelefone(vinculo.pessoa.celular).trim()).find(Boolean) ?? "";
    return {
      success: true as const,
      data: {
        nativos: {
          EMPRESA_NOME: { status: "ok" as const, valor: card.empresa.razaoSocial || card.empresa.nomeFantasia || "" },
          CNPJ: { status: card.empresa.cnpj ? "ok" as const : "vazio" as const, valor: formatCNPJ(card.empresa.cnpj) ?? "" },
          TELEFONE: { status: telefone ? "ok" as const : "vazio" as const, valor: telefone },
        },
        campos: Object.fromEntries(card.campoValores.map((item) => [item.campo.id,
          { status: item.valor?.trim() ? "ok" as const : "vazio" as const, valor: item.valor ?? "" }])),
        camposLabel: Object.fromEntries(card.campoValores.map((item) => [item.campo.id, item.campo.nome])),
      },
    };
  } catch (error) {
    console.error("[ObterValoresExemploCardKanban]", error);
    return { success: false as const, error: "Não foi possível carregar os valores do card" };
  }
}

function falhar(codigo: string, mensagem: string): never {
  throw new Error(`${codigo}: ${mensagem}`);
}

/**
 * Catálogo disponível para uma etapa: elementos nativos (sempre disponíveis) e
 * campos comerciais autorizados por `BpmCampoEtapaConfig.visivel` — a mesma
 * autoridade de presença/visibilidade usada pelo formulário do card aberto.
 */
export async function ListarCatalogoCardKanban(pipelineId: string, etapaId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    const userId = Number(session.user.id);
    if (!Number.isSafeInteger(userId) || userId <= 0)
      return { success: false as const, error: "Não autorizado" };
    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const etapa = await db.bpmEtapa.findFirst({
      where: { id: etapaId, pipelineId },
      select: { id: true, nome: true },
    });
    if (!etapa) return { success: false as const, error: "A etapa informada não pertence ao pipeline" };

    const campos = await db.bpmCampo.findMany({
      where: {
        ativo: true,
        OR: [{ pipelineId }, { pipelinesAssociados: { some: { pipelineId } } }],
        etapaConfiguracoes: { some: { etapaId, visivel: true } },
      },
      select: { id: true, nome: true, tipo: true },
      orderBy: { nome: "asc" },
    });

    return {
      success: true as const,
      data: {
        nativos: Object.entries(CARD_KANBAN_NATIVE_REGISTRY).map(([key, definicao]) => ({
          key,
          label: definicao.label,
          description: definicao.description,
        })),
        campos: campos.map((campo) => ({
          campoId: campo.id,
          label: campo.nome,
          tipo: campo.tipo,
        })),
      },
    };
  } catch (error) {
    console.error("[ListarCatalogoCardKanban]", error);
    return { success: false as const, error: "Erro ao carregar catálogo do card" };
  }
}

export async function ObterConfiguracaoCardKanban(pipelineId: string, etapaId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    const userId = Number(session.user.id);
    if (!Number.isSafeInteger(userId) || userId <= 0)
      return { success: false as const, error: "Não autorizado" };
    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const etapa = await db.bpmEtapa.findFirst({ where: { id: etapaId, pipelineId }, select: { id: true } });
    if (!etapa) return { success: false as const, error: "A etapa informada não pertence ao pipeline" };

    const configuracao = await db.bpmEtapaCardViewConfig.findFirst({
      where: { pipelineId, etapaId },
      select: { camposJson: true, versao: true },
    });

    return {
      success: true as const,
      data: {
        composicao: configuracao ? desserializarComposicaoCardKanban(configuracao.camposJson) ?? [] : [],
        versao: configuracao?.versao ?? null,
      },
    };
  } catch (error) {
    console.error("[ObterConfiguracaoCardKanban]", error);
    return { success: false as const, error: "Erro ao carregar configuração do card" };
  }
}

const salvarConfiguracaoCardKanbanSchema = z
  .object({
    pipelineId: idSchema,
    etapaId: idSchema,
    versaoEsperada: z.number().int().positive().nullable(),
    composicao: cardKanbanComposicaoSchema,
  })
  .strict();

export async function SalvarConfiguracaoCardKanban(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    const userId = Number(session.user.id);
    if (!Number.isSafeInteger(userId) || userId <= 0)
      return { success: false as const, error: "Não autorizado" };

    const parsed = salvarConfiguracaoCardKanbanSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, error: parsed.error.flatten() };

    await exigirAcessoConfigPipeline(userId, "configurarEtapas");
    const { pipelineId, etapaId, versaoEsperada, composicao } = parsed.data;

    const resultado = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarEtapas", tx);

      const etapa = await tx.bpmEtapa.findFirst({
        where: { id: etapaId, pipelineId },
        select: { id: true, nome: true },
      });
      if (!etapa) falhar("ETAPA_FORA_PIPELINE", "A etapa informada não pertence ao pipeline.");

      const campoIds = [
        ...new Set(
          composicao.flatMap((elemento) => (elemento.kind === "CAMPO" ? [elemento.campoId] : [])),
        ),
      ];
      if (campoIds.length) {
        const campos = await tx.bpmCampo.findMany({
          where: { id: { in: campoIds } },
          select: {
            id: true,
            nome: true,
            ativo: true,
            pipelineId: true,
            etapaConfiguracoes: { where: { etapaId }, select: { visivel: true } },
            pipelinesAssociados: { where: { pipelineId }, select: { id: true } },
          },
        });
        const campoPorId = new Map(campos.map((campo) => [campo.id, campo]));
        for (const campoId of campoIds) {
          const campo = campoPorId.get(campoId);
          if (!campo) falhar("CAMPO_FORA_ETAPA", `O campo "${campoId}" não existe.`);
          if (!campo.ativo) falhar("CAMPO_FORA_ETAPA", `O campo "${campo.nome}" está inativo.`);
          if (campo.pipelineId !== pipelineId && campo.pipelinesAssociados.length === 0)
            falhar("CAMPO_FORA_ETAPA", `O campo "${campo.nome}" não pertence a este pipeline.`);
          if (!campo.etapaConfiguracoes[0]?.visivel)
            falhar(
              "CAMPO_FORA_ETAPA",
              `O campo "${campo.nome}" não está visível para a etapa "${etapa.nome}".`,
            );
        }
      }

      const anterior = await tx.bpmEtapaCardViewConfig.findFirst({
        where: { pipelineId, etapaId },
        select: { id: true, versao: true, camposJson: true },
      });

      if (anterior && versaoEsperada !== anterior.versao) {
        falhar(
          "CONFLITO_VERSAO_CARD_KANBAN",
          `A composição do card na etapa "${etapa.nome}" foi alterada por outra sessão. Recarregue antes de salvar.`,
        );
      }
      if (!anterior && versaoEsperada !== null) {
        falhar(
          "CONFLITO_VERSAO_CARD_KANBAN",
          `O estado inicial da composição da etapa "${etapa.nome}" mudou. Recarregue antes de salvar.`,
        );
      }

      const composicaoAnterior: CardKanbanComposicao = anterior
        ? (desserializarComposicaoCardKanban(anterior.camposJson) ?? [])
        : [];
      if (anterior && composicaoCardKanbanSemAlteracao(composicaoAnterior, composicao)) {
        return { versao: anterior.versao, composicao: composicaoAnterior, alterado: false };
      }

      const camposJson = serializarComposicaoCardKanban(composicao);
      let versaoFinal: number;
      if (anterior) {
        const cas = await tx.bpmEtapaCardViewConfig.updateMany({
          where: { id: anterior.id, versao: versaoEsperada ?? -1 },
          data: { camposJson, versao: { increment: 1 } },
        });
        if (cas.count !== 1)
          falhar(
            "CONFLITO_VERSAO_CARD_KANBAN",
            `A composição do card na etapa "${etapa.nome}" mudou durante o salvamento. Recarregue e tente novamente.`,
          );
        versaoFinal = anterior.versao + 1;
      } else {
        try {
          const criado = await tx.bpmEtapaCardViewConfig.create({
            data: { pipelineId, etapaId, camposJson },
            select: { versao: true },
          });
          versaoFinal = criado.versao;
        } catch (error) {
          const codigo = (error as { code?: string } | null)?.code;
          if (codigo === "P2002")
            falhar(
              "CONFLITO_VERSAO_CARD_KANBAN",
              `A composição do card na etapa "${etapa.nome}" já foi criada por outra sessão. Recarregue e tente novamente.`,
            );
          throw error;
        }
      }

      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId,
          adminId: userId,
          campoAlterado: "card_kanban_composicao",
          valorAnteriorJson: anterior ? JSON.stringify(composicaoAnterior) : null,
          valorNovoJson: camposJson,
        },
      });
      await avancarConfigVersionBpm(tx, pipelineId);

      return { versao: versaoFinal, composicao, alterado: true };
    });

    revalidatePath(`/PainelAlpha/AlphaCRM/admin/pipelines/${pipelineId}`);
    if (resultado.alterado) {
      try {
        await notificarPipelineBpm({ pipelineId, tipo: "PIPELINE_ALTERADO" });
      } catch (error) {
        console.error("[SalvarConfiguracaoCardKanban:notificacao]", error);
      }
    }
    return { success: true as const, data: resultado };
  } catch (error) {
    const mensagem =
      error instanceof Error &&
      /^(ETAPA_FORA_PIPELINE|CAMPO_FORA_ETAPA|CONFLITO_VERSAO_CARD_KANBAN):/.test(error.message)
        ? error.message
        : "Erro ao salvar composição do card";
    if (mensagem === "Erro ao salvar composição do card")
      console.error("[SalvarConfiguracaoCardKanban]", error);
    return { success: false as const, error: mensagem };
  }
}
