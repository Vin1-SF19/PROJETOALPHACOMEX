"use server";

import { z } from "zod";
import { auth } from "../../../auth";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { gerarFichaViabilidadeCardBpm } from "@/lib/bpm/ficha-viabilidade-server";
import { revalidatePath } from "next/cache";
import { fichaViabilidadeInputSchema, fichaViabilidadeLeituraSchema, fichaViabilidadeSalvarSchema } from "@/lib/bpm/ficha-viabilidade-documento";
import { FichaViabilidadeError, garantirFichaViabilidade, obterFichaViabilidadePersistida, salvarComplementoFichaViabilidade } from "@/lib/bpm/ficha-viabilidade-automatica-server";

export async function GerarFichaViabilidadeBpm(dados: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
  const parsed = z.object({ cardId: z.string().min(1) }).safeParse(dados);
  if (!parsed.success) return { success: false as const, error: "Card inválido" };
  try {
    await exigirAcessoBpmCard(parsed.data.cardId, Number(session.user.id), session.user.role ?? null, "visualizar");
    return { success: true as const, data: await gerarFichaViabilidadeCardBpm(parsed.data.cardId) };
  } catch (erro) {
    return { success: false as const, error: erro instanceof Error && erro.message === "Não autorizado"
      ? "Não autorizado" : "Não foi possível gerar a ficha de viabilidade" };
  }
}

function falhaFicha(error: unknown, operacao: "ler" | "gerar" | "salvar") {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  const errorCode = error instanceof FichaViabilidadeError ? error.code
    : error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^[A-Z0-9_]{1,40}$/.test(error.code) ? error.code : null;
  console.error("[FichaViabilidade] Falha na operação", { operacao, errorName, errorCode });
  return { success: false as const, error: error instanceof FichaViabilidadeError ? error.message
    : error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Não foi possível atualizar a ficha de análise de viabilidade.",
  code: error instanceof FichaViabilidadeError ? error.code : "FAILED" };
}

export async function ObterFichaViabilidadeBpm(dados: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
  const parsed = fichaViabilidadeLeituraSchema.safeParse(dados);
  if (!parsed.success) return { success: false as const, error: "Card inválido" };
  try {
    const userId = Number(session.user.id);
    await exigirAcessoBpmCard(parsed.data.cardId, userId, session.user.role ?? null, "visualizar");
    return { success: true as const, ...await obterFichaViabilidadePersistida(parsed.data.cardId, parsed.data.solicitacaoId, userId) };
  } catch (error) { return falhaFicha(error, "ler"); }
}

export async function GarantirFichaViabilidadeBpm(dados: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
  const parsed = fichaViabilidadeInputSchema.safeParse(dados);
  if (!parsed.success) return { success: false as const, error: "Card inválido" };
  try {
    const userId = Number(session.user.id);
    await exigirAcessoBpmCard(parsed.data.cardId, userId, session.user.role ?? null, "editarCard");
    const resultado = await garantirFichaViabilidade(parsed.data.cardId, userId);
    revalidatePath("/PainelAlpha/AlphaCRM");
    return { success: true as const, ...resultado };
  } catch (error) { return falhaFicha(error, "gerar"); }
}

export async function SalvarComplementoFichaViabilidadeBpm(dados: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
  const parsed = fichaViabilidadeSalvarSchema.safeParse(dados);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Complemento inválido" };
  try {
    const userId = Number(session.user.id);
    await exigirAcessoBpmCard(parsed.data.cardId, userId, session.user.role ?? null, "editarCard");
    const data = await salvarComplementoFichaViabilidade(parsed.data, userId, session.user.role ?? null);
    revalidatePath("/PainelAlpha/AlphaCRM");
    return { success: true as const, data };
  } catch (error) { return falhaFicha(error, "salvar"); }
}
