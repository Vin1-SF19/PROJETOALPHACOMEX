"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "../../../auth";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { sincronizarTranscricaoCardBpm } from "@/lib/bpm/transcricao-reuniao-server";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";
const schema = z.object({ cardId: z.string().min(1) });

export async function SincronizarTranscricaoReuniaoBpm(dados: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };

  const parsed = schema.safeParse(dados);
  if (!parsed.success) return { success: false as const, error: "Card inválido" };

  try {
    await exigirAcessoBpmCard(
      parsed.data.cardId,
      Number(session.user.id),
      session.user.role ?? null,
      "editarCard",
    );
    const resultado = await sincronizarTranscricaoCardBpm(
      parsed.data.cardId,
      "manual",
      async (tx) => {
        await exigirAcessoBpmCard(
          parsed.data.cardId,
          Number(session.user.id),
          session.user.role ?? null,
          "editarCard",
          tx,
        );
      },
    );
    if (resultado.status === "ERRO") {
      return { success: false as const, error: resultado.erro, recuperavel: resultado.recuperavel };
    }
    revalidatePath(`${ROTA_BASE}/pipeline`);
    return { success: true as const, data: resultado };
  } catch (erro) {
    const mensagem = erro instanceof Error && erro.message === "Não autorizado"
      ? "Não autorizado"
      : "Não foi possível sincronizar a transcrição";
    return { success: false as const, error: mensagem };
  }
}
