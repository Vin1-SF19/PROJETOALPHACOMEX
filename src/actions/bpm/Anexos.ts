"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { registrarAnexoSchema } from "@/lib/validations/bpm";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { criarReferenciaAnexoBpm, validarReciboUploadAnexoBpm } from "@/lib/bpm/anexos-storage";

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
      await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "enviarArquivo", tx);
      if (campoId) {
        const campo = await tx.bpmCampo.findFirst({
          where: {
            id: campoId,
            tipo: "arquivo",
            ativo: true,
            OR: [
              { pipeline: { cards: { some: { id: cardId } } } },
              { pipelinesAssociados: { some: { pipeline: { cards: { some: { id: cardId } } } } } },
            ],
          },
          select: { id: true },
        });
        if (!campo) throw new Error("CAMPO_ARQUIVO_INVALIDO");
      }
      const referencia = criarReferenciaAnexoBpm(recibo.pathname);
      // O mesmo recibo assinado sempre descreve o mesmo pathname. Em caso de
      // retry/replay dentro da janela do recibo, devolvemos o registro original
      // sem criar uma segunda linha nem repetir o histórico.
      const existente = await tx.bpmCardAnexo.findFirst({
        where: { cardId, url: referencia },
      });
      if (existente) return { anexo: existente, criado: false };
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
      return { anexo: criado, criado: true };
    });

    if (resultado.criado) {
      revalidatePath(`${ROTA_BASE}/pipeline`);
      await notificarPipelineBpm({ cardId, tipo: "ANEXO_ALTERADO" });
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
    if (erroDeUnicidadeAnexo(error)) {
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

    await db.$transaction(async (tx) => {
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
