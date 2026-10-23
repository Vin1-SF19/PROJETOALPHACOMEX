"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { checarAcessoBpmCard } from "@/lib/bpm/ownership";
import { bpmCardIdSchema, etapaIdCardSchema } from "@/lib/validations/bpm";
import { encaminhamentoManualSchema, ErroEncaminhamentoManual } from "@/lib/bpm/encaminhamento-manual";
import { obterCatalogoEncaminhamentoManual, obterResponsaveisEncaminhamentoManual, encaminharCardManualmente } from "@/lib/bpm/encaminhamento-manual-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

async function usuarioAtual() {
  const usuarioId = Number((await auth())?.user?.id);
  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) throw new ErroEncaminhamentoManual("Não autorizado.");
  return usuarioId;
}
function mensagem(error: unknown) {
  return error instanceof ErroEncaminhamentoManual ? error.message : error instanceof z.ZodError
    ? "Revise os dados do encaminhamento." : "Não foi possível concluir o encaminhamento manual.";
}
export async function ObterOpcoesEncaminhamentoManualBpm(cardIdInput: string) {
  try {
    const cardId = bpmCardIdSchema.parse(cardIdInput), usuarioId = await usuarioAtual();
    const acesso = await checarAcessoBpmCard(cardId, usuarioId, null, "moverEtapa");
    if (!acesso.autorizado || !acesso.autoridadeMovimentoLivre) return { success: true as const, data: { permitido: false, pipelines: [] } };
    return { success: true as const, data: { permitido: true, pipelines: await obterCatalogoEncaminhamentoManual(cardId, usuarioId) } };
  } catch (error) { return { success: false as const, error: mensagem(error) }; }
}
const responsaveisSchema = z.object({ cardId: bpmCardIdSchema, pipelineId: z.string().cuid(), etapaId: etapaIdCardSchema }).strict();
export async function ObterResponsaveisEncaminhamentoManualBpm(input: z.input<typeof responsaveisSchema>) {
  try {
    const dados = responsaveisSchema.parse(input), usuarioId = await usuarioAtual();
    return { success: true as const, data: await obterResponsaveisEncaminhamentoManual(dados.cardId, dados.pipelineId, dados.etapaId, usuarioId) };
  } catch (error) { return { success: false as const, error: mensagem(error) }; }
}
export async function EncaminharCardManualmenteBpm(input: z.input<typeof encaminhamentoManualSchema>) {
  try {
    const dados = encaminhamentoManualSchema.parse(input), usuarioId = await usuarioAtual();
    const resultado = await encaminharCardManualmente(dados, usuarioId);
    await Promise.allSettled([
      Promise.resolve().then(() => revalidatePath("/PainelAlpha/AlphaCRM")),
      notificarPipelineBpm({ cardId: dados.cardId, tipo: "CARD_ATUALIZADO" }),
      ...(!resultado.mesmoPipeline ? [notificarPipelineBpm({ cardId: resultado.cardId, tipo: "CARD_CRIADO" })] : []),
    ]);
    const acessoDestino = await checarAcessoBpmCard(resultado.cardId, usuarioId, null, "visualizar").catch(() => null);
    return { success: true as const, data: { mesmoPipeline: resultado.mesmoPipeline, idempotente: resultado.idempotente,
      ...(acessoDestino?.autorizado ? { cardDestinoId: resultado.cardId } : {}) } };
  } catch (error) { return { success: false as const, error: mensagem(error) }; }
}
