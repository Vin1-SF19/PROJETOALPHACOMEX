"use server";
import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { confirmarVinculoEmpresaSchema } from "@/lib/bpm/cnpj-empresa-vinculo";
import { confirmarVinculoEmpresaNoCard, ErroVinculoEmpresa } from "@/lib/bpm/cnpj-empresa-vinculo-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { repetirTransacaoOcupada } from "@/lib/bpm/sqlite-busy-retry";

export async function ConfirmarVinculoEmpresaCardBpm(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
  const parsed = confirmarVinculoEmpresaSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Confira a empresa e confirme o vínculo novamente." };
  try {
    const resultado = await repetirTransacaoOcupada(() => db.$transaction(tx =>
      confirmarVinculoEmpresaNoCard(parsed.data.proposta, { id: Number(session.user.id), role: session.user.role ?? null }, tx),
    { maxWait: 10000, timeout: 60000 }));
    await Promise.allSettled([
      Promise.resolve().then(() => revalidatePath("/PainelAlpha/AlphaCRM")),
      notificarPipelineBpm({ pipelineId: resultado.pipelineId, cardId: parsed.data.proposta.cardId, tipo: "CARD_ATUALIZADO" }),
    ]);
    return { success: true as const, data: resultado.dados };
  } catch (error) {
    if (error instanceof ErroVinculoEmpresa) return { success: false as const, error: error.message, code: error.code };
    if (error instanceof Error && error.message === "Não autorizado") return { success: false as const, error: "Não autorizado" };
    // O guard do dossiê fornece uma mensagem de domínio segura, sem detalhes do banco.
    if (error instanceof Error && error.message === "Desvincule o dossiê antes de trocar a empresa do card.") return { success: false as const, error: error.message };
    console.error("[ConfirmarVinculoEmpresaCardBpm] Falha ao vincular empresa");
    return { success: false as const, error: "Não foi possível confirmar o vínculo. Seus dados continuam disponíveis para tentar novamente." };
  }
}
