import {
  protegerRespostaDeFalsoCancelamento,
  resultadoCancelamentoConcluido,
} from "@/lib/bibble/calendar-cancellation";
import {
  protegerRespostaDeFalsoChamado,
  resultadoAbrirChamadoConcluido,
} from "@/lib/bibble/chamado-guard";
import {
  callCompletion,
  consumeCompletionStream,
  encodeSSE,
  isOutputTruncated,
  type ChatMessage,
} from "@/lib/bibble/completion";
import { executarTool, type UserCtx } from "@/lib/bibble/tool-executor";
import type { OllamaTool } from "@/lib/bibble/tools";
import { resultadoToolAlterouCalendario } from "@/lib/google-calendar/invalidation";
import { BIBBLE_REQUEST_DEADLINE_MS } from "@/lib/bibble/runtime-config";
import { safeBibbleLog, type BibbleMetrics } from "@/lib/bibble/telemetry";
import type { AdmissionLease } from "@/lib/bibble/admission-control";
import type { BibbleMutationGrant } from "@/lib/bibble/mutation-grant";

const BIBBLE_ROUTE_MAX_DURATION_SECONDS = 120;
const MAX_TOOL_CALLS_POR_TURNO = 6;
const MAX_TOOL_CALLS_POR_REQUISICAO = 12;
const MAX_MUTACOES_CALENDARIO_POR_REQUISICAO = 3;
const MAX_CONTINUACOES_TRUNCAMENTO = 2;
const MUTACOES_CALENDARIO = new Set([
  "criar_evento_calendario",
  "editar_evento_calendario",
  "cancelar_evento_calendario",
  "criar_evento_calendario_colega",
  "editar_evento_calendario_colega",
  "cancelar_evento_calendario_colega",
]);

type SSEEvent =
  | { type: "status"; state: string }
  | { type: "text"; text: string }
  | { type: "calendar_changed" }
  | { type: "done"; finishReason?: string | null; truncated?: boolean; successful?: boolean }
  | { type: "error"; message: string };

export async function runStream(
  controller: ReadableStreamDefaultController,
  enc: TextEncoder,
  baseMessages: ChatMessage[],
  userCtx: UserCtx,
  providerCtrl: AbortController,
  model: string,
  tools: OllamaTool[],
  temperature?: number,
  contextWindow?: number,
  maxOutputTokens?: number,
  metrics?: BibbleMetrics,
  lease?: AdmissionLease,
  deadlineTimer?: ReturnType<typeof setTimeout>,
  deadlineAt?: number,
  mutationGrant?: BibbleMutationGrant,
): Promise<void> {
  const send = (event: SSEEvent) => {
    try { controller.enqueue(encodeSSE(event, enc)); } catch { /* stream closed */ }
  };
  const authorizedToolNames = new Set(tools.map(tool => tool.function.name));
  const effectiveDeadlineAt = deadlineAt ?? Date.now() + BIBBLE_REQUEST_DEADLINE_MS;
  // Margem de segurança antes do maxDuration da rota (120s): uma continuação
  // extra só é pedida se sobrar tempo suficiente para completá-la, senão o
  // Next.js aborta a requisição no meio de uma geração já paga em GPU-time.
  const TEMPO_LIMITE_CONTINUACAO_MS = (BIBBLE_ROUTE_MAX_DURATION_SECONDS - 20) * 1000;

  try {
    send({ type: "status", state: "thinking" });

    const msgs: ChatMessage[] = [...baseMessages];
    const MAX_TOOL_TURNS = 5;
    let totalToolCalls = 0;
    let totalMutacoesCalendario = 0;
    const mutacoesExecutadas = new Set<string>();
    let alteracaoCalendarioNotificada = false;
    let cancelamentoCalendarioExecutado = false;
    let chamadoAbertoComSucesso = false;

    for (let turn = 0; turn <= MAX_TOOL_TURNS; turn++) {
      if (tools.length > 0) {
        if (Date.now() >= effectiveDeadlineAt - 5_000) throw new Error("deadline");
        if (metrics) metrics.providerCalls += 1;
        const decisionResponse = await callCompletion(
          msgs,
          tools,
          model,
          providerCtrl.signal,
          true,
          temperature,
          contextWindow,
          maxOutputTokens,
          metrics?.requestId,
        );
        let decisionText = "";
        const decision = await consumeCompletionStream(decisionResponse, delta => {
          decisionText += delta;
        });
        if (decision.usage?.completion_tokens !== undefined && metrics) {
          metrics.outputTokens = (metrics.outputTokens ?? 0) + decision.usage.completion_tokens;
          metrics.inputTokens = decision.usage.prompt_tokens;
          metrics.tokenCount = "exact";
        }
        const toolCalls = decision.toolCalls;
        if (decision.finishReason === "tool_calls" && toolCalls.length) {
        send({ type: "status", state: "pesquisando" });
        if (metrics) metrics.toolCycles += 1;

        msgs.push({
          role: "assistant",
          content: decisionText,
          tool_calls: toolCalls,
        });

        // Tool calls podem alterar o mesmo calendário. Executá-las em sequência preserva a
        // ordem pedida pelo modelo e evita corridas entre criar/editar/cancelar no mesmo turno.
        const results: ChatMessage[] = [];
        for (const [indice, tc] of toolCalls.entries()) {
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          } catch {
            args = {};
          }
          totalToolCalls += 1;
          let result: string;
          const toolStarted = Date.now();
          if (!authorizedToolNames.has(tc.function.name)) {
            console.warn('[BIBBLE_TOOL_REJECTED]', { requestId: metrics?.requestId, reason: 'outside-turn-capabilities' });
            result = JSON.stringify({ ok: false, erro: 'Ferramenta não autorizada neste turno.' });
          } else if (
            indice >= MAX_TOOL_CALLS_POR_TURNO ||
            totalToolCalls > MAX_TOOL_CALLS_POR_REQUISICAO
          ) {
            result = JSON.stringify({
              ok: false,
              erro: "Limite seguro de ferramentas atingido nesta solicitação.",
            });
          } else if (MUTACOES_CALENDARIO.has(tc.function.name)) {
            totalMutacoesCalendario += 1;
            const assinatura = `${tc.function.name}:${JSON.stringify(args)}`;
            if (totalMutacoesCalendario > MAX_MUTACOES_CALENDARIO_POR_REQUISICAO) {
              result = JSON.stringify({
                ok: false,
                erro: "Limite seguro de alterações no calendário atingido nesta solicitação.",
              });
            } else if (mutacoesExecutadas.has(assinatura)) {
              result = JSON.stringify({
                ok: false,
                erro: "Alteração duplicada bloqueada nesta solicitação.",
              });
            } else {
              mutacoesExecutadas.add(assinatura);
              result = await executarTool(tc.function.name, args, userCtx, { signal: providerCtrl.signal, requestId: metrics?.requestId, deadlineAt: effectiveDeadlineAt, mutationGrant });
            }
          } else {
            result = await executarTool(tc.function.name, args, userCtx, { signal: providerCtrl.signal, requestId: metrics?.requestId, deadlineAt: effectiveDeadlineAt, mutationGrant });
          }
          metrics?.tools.push({ name: tc.function.name, durationMs: Date.now() - toolStarted, ok: !/erro|falha/i.test(result) });

          if (
            !alteracaoCalendarioNotificada &&
            resultadoToolAlterouCalendario(tc.function.name, result)
          ) {
            send({ type: "calendar_changed" });
            alteracaoCalendarioNotificada = true;
          }
          if (resultadoCancelamentoConcluido(tc.function.name, result)) {
            cancelamentoCalendarioExecutado = true;
          }
          if (resultadoAbrirChamadoConcluido(tc.function.name, result)) {
            chamadoAbertoComSucesso = true;
          }

          results.push({ role: "tool", tool_call_id: tc.id, content: result });
        }

        msgs.push(...results);
        send({ type: "status", state: "thinking" });
          continue;
        }
        // A resposta da chamada de decisão já é final quando não há tool call.
        // Reutilizá-la evita a antiga segunda geração descartável.
        if (decisionText.trim()) {
          if (metrics && metrics.ttftMs === undefined) metrics.ttftMs = Date.now() - metrics.startedAt;
          send({ type: "text", text: decisionText });
          if (metrics) metrics.finishReason = decision.finishReason;
          send({ type: "done", finishReason: decision.finishReason, successful: true });
          return;
        }
      }

      // Sem ferramentas (fluxo de documento), a resposta é gerada em streaming.
      // Com ferramentas, esta é a geração final. Quando o modelo é cortado por
      // limite de saída (finishReason "length"/"max_tokens"), continuamos
      // automaticamente pedindo a sequência do texto em vez de desistir — uma
      // conciliação bancária ou relatório longo legitimamente pode passar do
      // teto de um único turno.
      const protegerRespostaCancelamento =
        userCtx.solicitouCancelamentoCalendario === true;
      // Quando o usuário pediu para abrir um chamado, uma alegação falsa de
      // abertura ("chamado #X criado") só pode ser barrada antes de qualquer
      // texto chegar à tela — por isso o turno é buferizado e revisado no fim.
      const protegerRespostaChamado =
        userCtx.solicitouAbrirChamado === true && !chamadoAbertoComSucesso;
      const bufferizarResposta = protegerRespostaCancelamento || protegerRespostaChamado;

      let respostaFinalProtegida = "";
      let respostaAcumulada = "";
      let finishReason: string | null = null;
      let continuacoesUsadas = 0;

      for (;;) {
        if (Date.now() >= effectiveDeadlineAt - 5_000) throw new Error("deadline");
        if (metrics) metrics.providerCalls += 1;
        const streamRes = await callCompletion(
          msgs,
          [],
          model,
          providerCtrl.signal,
          true,
          temperature,
          contextWindow,
          maxOutputTokens,
          metrics?.requestId,
        );

        const streamResult = await consumeCompletionStream(streamRes, (delta) => {
          if (!bufferizarResposta && metrics && metrics.ttftMs === undefined) metrics.ttftMs = Date.now() - metrics.startedAt;
          respostaAcumulada += delta;
          if (bufferizarResposta) {
            respostaFinalProtegida += delta;
          } else {
            send({ type: "text", text: delta });
          }
        });
        finishReason = streamResult.finishReason;
        if (streamResult.usage?.completion_tokens !== undefined && metrics) {
          metrics.outputTokens = (metrics.outputTokens ?? 0) + streamResult.usage.completion_tokens;
          metrics.inputTokens = streamResult.usage.prompt_tokens;
          metrics.tokenCount = "exact";
        }

        const cortadoPorLimite = isOutputTruncated(finishReason);
        const tempoEsgotando = Date.now() >= effectiveDeadlineAt - Math.max(5_000, BIBBLE_REQUEST_DEADLINE_MS - TEMPO_LIMITE_CONTINUACAO_MS);
        if (
          !cortadoPorLimite
          || bufferizarResposta
          || continuacoesUsadas >= MAX_CONTINUACOES_TRUNCAMENTO
          || tempoEsgotando
        ) {
          break;
        }

        // Pede a continuação: injeta o texto já gerado como turno do
        // assistant e soma um pedido explícito de continuar exatamente de
        // onde parou, sem repetir o que já foi enviado.
        continuacoesUsadas += 1;
        msgs.push({ role: "assistant", content: respostaAcumulada });
        msgs.push({
          role: "user",
          content: "Continue exatamente de onde parou, sem repetir o que já foi escrito e sem reintroduzir o assunto.",
        });
        console.info("[BIBBLE COMPLETION] continuation", {
          stage: "final-stream",
          attempt: continuacoesUsadas,
          outputTokenLimit: maxOutputTokens ?? null,
        });
        send({ type: "status", state: "thinking" });
      }

      if (bufferizarResposta && respostaFinalProtegida) {
        let respostaSegura = respostaFinalProtegida;
        if (protegerRespostaCancelamento) {
          respostaSegura = protegerRespostaDeFalsoCancelamento(
            respostaSegura,
            cancelamentoCalendarioExecutado,
          );
        }
        if (protegerRespostaChamado) {
          respostaSegura = protegerRespostaDeFalsoChamado(
            respostaSegura,
            chamadoAbertoComSucesso,
          );
        }
        if (metrics && metrics.ttftMs === undefined) metrics.ttftMs = Date.now() - metrics.startedAt;
        send({ type: "text", text: respostaSegura });
      }

      if (!finishReason) {
        console.warn("[BIBBLE COMPLETION] abnormal-finish", {
          stage: "final-stream",
          finishReason: "provider-eof",
          outputTokenLimit: maxOutputTokens ?? null,
        });
        send({ type: "error", message: "A conexão com o modelo terminou antes de confirmar a resposta. Seus anexos foram mantidos para tentar novamente." });
        send({ type: "done", finishReason: null, truncated: true, successful: false });
        return;
      }

      const truncated = isOutputTruncated(finishReason);
      if (metrics) { metrics.finishReason = finishReason; metrics.truncated = truncated; }
      if (truncated) {
        send({
          type: "error",
          message: "A resposta atingiu o limite de saída do modelo mesmo após tentativas de continuação automática e não foi concluída. Seus anexos e texto foram mantidos para tentar novamente.",
        });
      }

      console.info("[BIBBLE COMPLETION] finish", {
        stage: "final-stream",
        finishReason: finishReason ?? "provider-eof",
        truncated,
        continuacoesUsadas,
        outputTokenLimit: maxOutputTokens ?? null,
      });

      send({ type: "done", finishReason, truncated, successful: !truncated });
      return;
    }

    send({ type: "error", message: "A solicitação excedeu o limite seguro de etapas com ferramentas." });
    send({ type: "done", finishReason: "tool_turn_limit", truncated: true, successful: false });
  } catch (error) {
    if (providerCtrl.signal.aborted) {
      try { send({ type: "done", successful: false }); } catch { /* ignore */ }
      return;
    }
    if (metrics) metrics.errorCategory = error instanceof Error && error.message === "deadline" ? "deadline" : "stream";
    console.error("[BIBBLE CHAT] failed", { stage: metrics?.errorCategory ?? "stream", requestId: metrics?.requestId, deadlineAt: effectiveDeadlineAt });
    try {
      send({ type: "error", message: "Não consegui concluir esta resposta. Seu texto e anexos foram preservados; tente novamente." });
      send({ type: "done", successful: false });
    } catch { /* ignore */ }
  } finally {
    if (deadlineTimer) clearTimeout(deadlineTimer);
    lease?.release();
    if (metrics) safeBibbleLog(metrics);
    try { controller.close(); } catch { /* already closed */ }
  }
}

