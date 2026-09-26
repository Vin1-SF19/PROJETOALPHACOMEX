"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { registrarAnexoSchema } from "@/lib/validations/bpm";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";
import { executarAutomacoesCentraisDoCardAgora } from "@/lib/bpm/automacoes/orquestrador";
import { criarReferenciaAnexoBpm, extrairPathnamePrivadoAnexoBpm, validarReciboUploadAnexoBpm } from "@/lib/bpm/anexos-storage";
import { ACAO_LIMPEZA_ANEXO_PENDENTE, limparBlobAnexoPendente } from "@/lib/bpm/anexos-lifecycle";

import { carregarCamposAplicaveisCardEtapa } from "@/lib/bpm/requisitos-etapa-server";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

function erroDeUnicidadeAnexo(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "P2002";
}

export async function RegistrarAnexoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = registrarAnexoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const recibo = validarReciboUploadAnexoBpm(parsed.data.recibo);
    if (!recibo || recibo.cardId !== parsed.data.cardId) {
      return { success: false, error: "Comprovante de upload inválido ou expirado" };
    }
    const { cardId, campoId } = parsed.data;
    const { nome, tipo, tamanho } = recibo;

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "enviarArquivo");

    const resultado = await db.$transaction(async (tx) => {
      const acesso = await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "enviarArquivo", tx);
      if (campoId) {
        const card = await tx.bpmCard.findUnique({ where: { id: cardId }, select: { pipelineId: true, etapaId: true } });
        if (!card) throw new Error("CAMPO_ARQUIVO_INVALIDO");
        const perfil = acesso.isAdminGlobal || acesso.role === "ADMINISTRADOR"
          ? "ADMIN" : acesso.role === "RESPONSAVEL" ? "RESPONSAVEL" : "MEMBRO";
        const campos = await carregarCamposAplicaveisCardEtapa(cardId, card.pipelineId, card.etapaId, tx, perfil);
        const campo = campos.find((item) => item.id === campoId && (item.tipo === "arquivo" || item.tipo === "url_ou_arquivo"));
        if (!campo || !validarValoresCamposBpm([campo], { [campoId]: "" }).success) {
          throw new Error("CAMPO_ARQUIVO_INVALIDO");
        }
      }
      const referencia = criarReferenciaAnexoBpm(recibo.pathname);
      // O mesmo recibo assinado sempre descreve o mesmo pathname. Em caso de
      // retry/replay dentro da janela do recibo, devolvemos o registro original
      // sem criar uma segunda linha nem repetir o histórico.
      const existente = await tx.bpmCardAnexo.findFirst({
        where: { cardId, url: referencia },
      });
      if (existente) {
        if ((existente.campoId ?? null) !== (campoId ?? null)) throw new Error("CAMPO_ARQUIVO_INVALIDO");
        return { anexo: existente, criado: false };
      }
      const criado = await tx.bpmCardAnexo.create({
        data: {
          cardId,
          url: referencia,
          nome,
          tipo,
          tamanho,
          enviadoPorId: userId,
          campoId,
        },
      });
      if (campoId) {
        await tx.bpmCardCampoValor.upsert({
          where: { cardId_campoId: { cardId, campoId } },
          create: { cardId, campoId, valor: criado.id },
          update: { valor: criado.id },
        });
      }
      await registrarHistoricoCard(
        {
          cardId,
          acao: "ANEXO_ADICIONADO",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ nome, tamanho }),
        },
        tx,
      );
      if (campoId) {
        const campo = await tx.bpmCampo.findUnique({ where: { id: campoId }, select: { chave: true } });
        if (campo?.chave === "alpha.contrato.assinado.anexo") {
          const card = await tx.bpmCard.findUnique({ where: { id: cardId }, select: { pipelineId: true } });
          if (card) await publicarEventoBpm({
            tipo: "CARD_ATUALIZADO", entidadeTipo: "CARD", entidadeId: cardId,
            cardId, pipelineId: card.pipelineId, valorNovo: { anexoAssinadoId: criado.id },
            atorTipo: "USUARIO", atorUserId: userId,
            causationId: criado.id, idempotencyKey: `contrato-assinado-anexo:${criado.id}`,
          }, tx);
        }
      }
      return { anexo: criado, criado: true };
    });

    if (resultado.criado) {
      try {
        revalidatePath(`${ROTA_BASE}/pipeline`);
        await notificarPipelineBpm({ cardId, tipo: "ANEXO_ALTERADO" });
        if (campoId) await executarAutomacoesCentraisDoCardAgora(cardId);
      } catch (notificationError) {
        console.error("[RegistrarAnexoBpm/pos-salvamento]", notificationError);
      }
    }
    return {
      success: true,
      data: { ...resultado.anexo, url: `/api/bpm/anexos/${resultado.anexo.id}` },
    };
  } catch (error) {
    // A consulta antes do create evita retries comuns. Ainda assim, duas
    // requisições concorrentes podem chegar ao create juntas. A restrição
    // composta resolve a corrida; a perdedora devolve o mesmo anexo de modo
    // idempotente, sem criar outro histórico ou emitir outro evento realtime.
    if (erroDeUnicidadeAnexo(error) && !registrarAnexoSchema.safeParse(dados).data?.campoId) {
      try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Não autorizado" };
        const userId = Number(session.user.id);
        const parsed = registrarAnexoSchema.safeParse(dados);
        if (!parsed.success) return { success: false, error: parsed.error.flatten() };
        const recibo = validarReciboUploadAnexoBpm(parsed.data.recibo);
        if (!recibo || recibo.cardId !== parsed.data.cardId) {
          return { success: false, error: "Comprovante de upload inválido ou expirado" };
        }

        const { cardId } = parsed.data;
        await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "enviarArquivo");
        const anexo = await db.bpmCardAnexo.findUnique({
          where: {
            cardId_url: {
              cardId,
              url: criarReferenciaAnexoBpm(recibo.pathname),
            },
          },
        });
        if (anexo) {
          return {
            success: true,
            data: { ...anexo, url: `/api/bpm/anexos/${anexo.id}` },
          };
        }
      } catch (recoveryError) {
        console.error("[RegistrarAnexoBpm:P2002]", recoveryError);
        const msg = recoveryError instanceof Error && recoveryError.message === "Não autorizado"
          ? "Não autorizado"
          : "Erro ao registrar anexo";
        return { success: false, error: msg };
      }
    }
    console.error("[RegistrarAnexoBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado"
      : error instanceof Error && error.message === "CAMPO_ARQUIVO_INVALIDO"
        ? "Campo de arquivo inválido para este card"
        : "Erro ao registrar anexo";
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

    const pendenteId = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(anexo.cardId, userId, session.user.role ?? null, "excluirArquivo", tx);
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
      if (!extrairPathnamePrivadoAnexoBpm(anexo.url)) return null;
      const pendente = await tx.bpmCardHistorico.create({
        data: {
          cardId: anexo.cardId,
          acao: ACAO_LIMPEZA_ANEXO_PENDENTE,
          usuarioId: userId,
          valorAnteriorJson: anexo.url,
        },
        select: { id: true },
      });
      return pendente.id;
    });

    if (pendenteId) {
      try {
        await limparBlobAnexoPendente(pendenteId);
      } catch (error) {
        // A exclusão do metadado já foi commitada. O cron repetirá a limpeza.
        console.error("[ExcluirAnexoBpm] Blob pendente de reconciliação", { pendenteId, error });
      }
    }

    revalidatePath(`${ROTA_BASE}/pipeline`);
    await notificarPipelineBpm({ cardId: anexo.cardId, tipo: "ANEXO_ALTERADO" });
    return { success: true };
  } catch (error) {
    console.error("[ExcluirAnexoBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao excluir anexo";
    return { success: false, error: msg };
  }
}
