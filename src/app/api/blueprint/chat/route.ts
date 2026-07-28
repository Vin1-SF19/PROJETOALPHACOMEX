import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "../../../../../auth";
import { checarAcessoBlueprint } from "@/lib/blueprint/ownership";
import { montarContextoProjeto } from "@/lib/blueprint/ai-context";
import { executarBlueprintAiTool, registrarAcaoIaBlueprint } from "@/lib/blueprint/ai-executor";
import { BLUEPRINT_AI_TOOLS } from "@/lib/blueprint/ai-tools";
import { callCompletion, encodeSSE, type ChatMessage } from "@/lib/bibble/completion";
import { BIBBLE_MODEL } from "@/lib/bibble/client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  projectId: z.string().min(1),
  message: z.string().min(1).max(4000),
});

const MAX_TOOL_TURNS = 4;

function montarSystemPrompt(contexto: string): string {
  return [
    "Você é o assistente de IA do Alpha Blueprint, ajudando a organizar a especificação de UM projeto específico.",
    "Regras obrigatórias:",
    "- Nunca invente requisitos ou fatos como se fossem verdadeiros — se não souber, diga que não sabe ou pergunte.",
    "- Diferencie claramente o que já está registrado no projeto do que você está sugerindo.",
    "- Nunca mencione ou use informação de qualquer outro projeto além deste.",
    "- Ao sugerir requisitos, fluxos ou estrutura, deixe claro que é uma sugestão para o usuário revisar — você não aplica mudanças automaticamente.",
    "- Responda em português do Brasil, de forma objetiva.",
    "",
    "Formatação da resposta (obrigatório, a resposta é renderizada como Markdown real):",
    "- Nunca escreva tudo em um único parágrafo corrido. Quebre em seções curtas com linha em branco entre elas.",
    "- Use um título curto em negrito (ex: **Resumo**) para introduzir cada bloco, sem repetir o nome do campo dentro do texto.",
    "- Para listar campos/atributos (status, prioridade, setor etc.), use uma lista com `-`, um item por linha — nunca liste vários campos separados só por `*` na mesma linha.",
    "- Não coloque em negrito o rótulo e o valor ao mesmo tempo (evite `**Status:** PRONTO`); negrito é só para destacar o que é realmente importante.",
    "- Se algo não está registrado ou está vazio, diga isso em uma frase curta separada, não dentro de parênteses coladas ao resto.",
  ].join("\n") + "\n\nContexto atual do projeto:\n" + (contexto || "(projeto ainda sem conteúdo registrado)");
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
  const { projectId, message } = parsed.data;

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
        const contexto = await montarContextoProjeto(projectId);
        const systemPrompt = montarSystemPrompt(contexto);

        const messages: ChatMessage[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ];

        let turnos = 0;
        while (turnos < MAX_TOOL_TURNS) {
          turnos++;
          const resposta = await callCompletion(messages, BLUEPRINT_AI_TOOLS, BIBBLE_MODEL, providerCtrl.signal, false);
          const escolha = resposta.choices[0];
          const toolCalls = escolha.message.tool_calls;

          if (toolCalls && toolCalls.length > 0) {
            messages.push({ role: "assistant", content: escolha.message.content || "", tool_calls: toolCalls });

            for (const call of toolCalls) {
              send({ type: "status", message: `Consultando ${call.function.name.replace(/_/g, " ")}...` });
              const params = JSON.parse(call.function.arguments || "{}");
              const resultado = await executarBlueprintAiTool(call.function.name, params, { projectId, userId });
              await registrarAcaoIaBlueprint(projectId, userId, call.function.name);
              messages.push({ role: "tool", content: resultado, tool_call_id: call.id });
            }
            continue;
          }

          send({ type: "text", text: escolha.message.content });
          break;
        }

        send({ type: "done" });
      } catch (err) {
        if (!providerCtrl.signal.aborted) {
          console.error("[BLUEPRINT-CHAT]", err instanceof Error ? err.message : err);
          send({ type: "error", message: "Tive um problema ao processar sua mensagem. Tente novamente." });
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
