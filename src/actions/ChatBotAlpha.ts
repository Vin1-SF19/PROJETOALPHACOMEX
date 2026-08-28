"use server";

// ChatBot Alpha — hub de acesso a ferramentas administrativas de infraestrutura
// (Adminer/Postgres, RedisInsight/Redis, MailHog) de um sistema ChatbotX self-hosted externo.
// Admin/CEO/TI escolhem entre os 3; usuário comum só acessa o MailHog (sem token).

import { z } from "zod";
import { auth } from "../../auth";
import { isAdminRole } from "@/lib/roles";

const SistemaSchema = z.enum(["adminer", "redis", "mailhog"]);
export type SistemaChatBot = z.infer<typeof SistemaSchema>;

export type ResultadoUrlChatBot = { success: true; url: string } | { success: false; error: string };

function montarUrlComToken(url: string | undefined, token: string | undefined): string | null {
  if (!url || !token) return null;
  return `${url}?token=${token}`;
}

export async function ObterUrlSistemaChatBot(sistema: SistemaChatBot): Promise<ResultadoUrlChatBot> {
  const parsed = SistemaSchema.safeParse(sistema);
  if (!parsed.success) return { success: false, error: "Sistema inválido" };

  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autenticado" };

  if (parsed.data === "mailhog") {
    const url = process.env.BASMAILOG_URL;
    if (!url) return { success: false, error: "Sistema não configurado" };
    return { success: true, url };
  }

  const role = (session.user as { role?: string }).role ?? "";
  if (!isAdminRole(role)) return { success: false, error: "Sem permissão" };

  const url =
    parsed.data === "adminer"
      ? montarUrlComToken(process.env.ADMINER_URL, process.env.ADMINER_TOKEN)
      : montarUrlComToken(process.env.REDIS_URL, process.env.REDIS_TOKEN);

  if (!url) return { success: false, error: "Sistema não configurado" };
  return { success: true, url };
}
