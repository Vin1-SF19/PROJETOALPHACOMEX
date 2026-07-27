import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "../../../../../auth";
import { checarAcessoBlueprint } from "@/lib/blueprint/ownership";
import { montarContextoProjeto, descreverCanvasProjeto } from "@/lib/blueprint/ai-context";
import { REGRAS_PAINEL_ALPHA, montarCabecalhoPrompt } from "@/lib/blueprint/ai-prompt-templates";
import { callCompletion, encodeSSE, type ChatMessage } from "@/lib/bibble/completion";
import { BIBBLE_MODEL } from "@/lib/bibble/client";
import db from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  projectId: z.string().min(1),
  elementoFoco: z.string().max(500).optional(),
});

function montarSystemPrompt(): string {
  return [
    "Você gera prompts de implementação técnica completos e bem estruturados a partir da especificação de um sistema.",
    "O prompt final será usado por um desenvolvedor (ou assistente de IA de código) para implementar a feature descrita.",
    "Regras:",
    "- Baseie-se SOMENTE nas informações fornecidas (resumo, problema, objetivo, requisitos, elementos do canvas) — nunca invente requisitos que não foram mencionados.",
    "- Estruture o prompt com seções claras: Objetivo, Contexto/Problema, Funcionalidades (baseadas nos elementos do canvas e requisitos), Fluxo (baseado nas conexões do canvas, se houver), Critérios de aceite.",
    "- Se o material for insuficiente para alguma seção, indique isso explicitamente em vez de inventar.",
    "- Responda em português do Brasil, direto, sem rodeios ou saudações.",
  ].join("\n");
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
    return new Response(JSON.stringify({ success: false, error: "Dados inválidos" }), { status: 400 });
  }
  const { projectId, elementoFoco } = parsed.data;

  const acesso = await checarAcessoBlueprint(projectId, userId, session.user.role ?? null, "usarIA");
  if (!acesso.autorizado) {
    return new Response(JSON.stringify({ success: false, error: "Sem permissão para usar a IA neste projeto" }), { status: 403 });
  }

  const providerCtrl = new AbortController();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        try { controller.enqueue(encodeSSE(event, enc)); } catch { /* stream closed */ }
      };

      try {
        send({ type: "status", message: "Lendo a especificação do projeto..." });
        const projeto = await db.blueprintProject.findUnique({ where: { id: projectId }, select: { title: true } });
        const contextoProjeto = await montarContextoProjeto(projectId);

        send({ type: "status", message: "Lendo o canvas visual..." });
        const contextoCanvas = await descreverCanvasProjeto(projectId);

        const userContent = [
          contextoProjeto || "(projeto ainda sem conteúdo de especificação registrado)",
          contextoCanvas || "(canvas ainda vazio)",
          elementoFoco ? `## Elemento de foco selecionado pelo usuário\n${elementoFoco}` : "",
          "Gere o prompt de implementação completo com base neste material.",
        ].filter(Boolean).join("\n\n");

        const messages: ChatMessage[] = [
          { role: "system", content: montarSystemPrompt() },
          { role: "user", content: userContent },
        ];

        send({ type: "status", message: "Gerando prompt..." });
        const resposta = await callCompletion(messages, [], BIBBLE_MODEL, providerCtrl.signal, false);
        const corpoGerado = resposta.choices[0]?.message.content ?? "";

        const promptFinal = [
          montarCabecalhoPrompt(projeto?.title ?? "Sistema"),
          corpoGerado.trim(),
          REGRAS_PAINEL_ALPHA,
        ].join("\n\n---\n\n");

        send({ type: "done", prompt: promptFinal });
      } catch (err) {
        if (!providerCtrl.signal.aborted) {
          console.error("[BLUEPRINT-GERAR-PROMPT]", err instanceof Error ? err.message : err);
          send({ type: "error", message: "Não foi possível gerar o prompt agora. Tente novamente." });
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
