import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "../../../../../auth";
import { checarAcessoBlueprint } from "@/lib/blueprint/ownership";
import { respostaLayoutSchema, preencherLayout, descricaoTiposLayout, TIPOS_LAYOUT } from "@/lib/blueprint/canvas-layouts";
import { callCompletion, type ChatMessage } from "@/lib/bibble/completion";
import { BIBBLE_MODEL } from "@/lib/bibble/client";
import { encodeSSE } from "@/lib/bibble/completion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  projectId: z.string().min(1),
  ideia: z.string().trim().min(3),
});

function montarSystemPrompt(): string {
  return [
    "Você ajuda a montar um layout inicial de canvas visual (fluxo/telas) a partir de uma ideia descrita em texto livre.",
    "Você DEVE escolher um dos tipos de layout abaixo e retornar APENAS um JSON no formato { \"tipo\": \"...\", \"itens\": [\"...\"] } — nada além disso, sem markdown, sem explicação.",
    "",
    "Tipos de layout disponíveis:",
    descricaoTiposLayout(),
    "",
    "\"itens\" é uma lista de 2 a 8 strings curtas (nomes de telas/passos/módulos), na ordem em que devem aparecer.",
    "Nunca invente itens não relacionados à ideia descrita. Baseie-se estritamente no que foi pedido.",
  ].join("\n");
}

function limparCercasMarkdown(texto: string): string {
  return texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), { status: 401 });
  }
  const userId = Number(session.user.id);

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ success: false, error: "Descreva a ideia com pelo menos 3 caracteres" }), { status: 400 });
  }
  const { projectId, ideia } = parsed.data;

  const acesso = await checarAcessoBlueprint(projectId, userId, session.user.role ?? null, "editarCanvas");
  if (!acesso.autorizado) {
    return new Response(JSON.stringify({ success: false, error: "Sem permissão para editar o canvas deste projeto" }), { status: 403 });
  }

  const providerCtrl = new AbortController();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        try { controller.enqueue(encodeSSE(event, enc)); } catch { /* stream closed */ }
      };

      try {
        send({ type: "status", message: "Pensando no layout..." });

        const messages: ChatMessage[] = [
          { role: "system", content: montarSystemPrompt() },
          { role: "user", content: ideia },
        ];

        const resposta = await callCompletion(messages, [], BIBBLE_MODEL, providerCtrl.signal, false);
        const textoResposta = resposta.choices[0]?.message.content ?? "";
        const jsonLimpo = limparCercasMarkdown(textoResposta);

        let payload: unknown;
        try {
          payload = JSON.parse(jsonLimpo);
        } catch {
          send({ type: "error", message: "A IA não retornou um layout válido. Tente descrever de outra forma." });
          return;
        }

        const validado = respostaLayoutSchema.safeParse(payload);
        if (!validado.success) {
          send({ type: "error", message: "A IA retornou um formato inesperado. Tente novamente." });
          return;
        }
        if (!TIPOS_LAYOUT.includes(validado.data.tipo)) {
          send({ type: "error", message: "Tipo de layout desconhecido." });
          return;
        }

        const { nodes, edges } = preencherLayout(validado.data);
        send({ type: "done", nodes, edges });
      } catch (err) {
        if (!providerCtrl.signal.aborted) {
          console.error("[BLUEPRINT-GERAR-LAYOUT]", err instanceof Error ? err.message : err);
          send({ type: "error", message: "Não foi possível gerar o layout agora. Tente novamente." });
        }
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      providerCtrl.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
