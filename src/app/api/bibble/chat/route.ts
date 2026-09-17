import { NextRequest } from "next/server";
import { auth } from "../../../../../auth";
import { modelSupportsVision, getModelLabel, BIBBLE_MODEL } from "@/lib/bibble/client";
import { BIBBLE_TOOLS, type OllamaTool } from "@/lib/bibble/tools";
import { executarTool, type UserCtx } from "@/lib/bibble/tool-executor";
import {
  mensagemConfirmaCancelamentoCalendario,
  mensagemSolicitaCancelamentoCalendario,
  protegerRespostaDeFalsoCancelamento,
  resolverEventoConfirmadoDoUsuario,
  resultadoCancelamentoConcluido,
} from "@/lib/bibble/calendar-cancellation";
import {
  mensagemSolicitaAbrirChamado,
  protegerRespostaDeFalsoChamado,
  resultadoAbrirChamadoConcluido,
} from "@/lib/bibble/chamado-guard";
import { extractTextFromUrl } from "@/lib/bibble/tika";
import { callCompletion, consumeCompletionStream, encodeSSE, isOutputTruncated, type ChatMessage, type ContentPart } from "@/lib/bibble/completion";
import {
  allocatePerFileBudget,
  calculateRequestBudget,
  estimateTokens,
  selectRecentHistory,
  selectTextForTokenBudget,
  type TextSelectionStrategy,
} from "@/lib/bibble/context-budget";
import { resultadoToolAlterouCalendario } from "@/lib/google-calendar/invalidation";
import db from "@/lib/prisma";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import {
  bibbleChatInputSchema,
  fetchTrustedBibbleBlob,
  isBibbleBlobOwnedByUser,
  readRequestTextWithLimit,
  type BibbleChatInput,
} from "@/lib/bibble/attachment-security";
import { acquireBibbleLease, type AdmissionLease } from "@/lib/bibble/admission-control";
import { buildBibbleSystemPrompt } from "@/lib/bibble/persona";
import { validateBibbleModuleContext } from "@/lib/bibble/module-context";
import { authorizedTools, routeToolsByIntent } from "@/lib/bibble/tool-policy";
import { BIBBLE_REQUEST_DEADLINE_MS } from "@/lib/bibble/runtime-config";
import { createBibbleMetrics, safeBibbleLog, type BibbleMetrics } from "@/lib/bibble/telemetry";
import { randomUUID } from "crypto";
import {
  buildAdaptiveStylePrompt,
  classifyBehavioralStyle,
  normalizeAdaptivePreferences,
} from "@/lib/bibble/adaptive-style";
import { loadBehavioralHistory } from "@/lib/bibble/behavioral-memory";
import type { AdaptiveTonePreferences, BehavioralProfile, BehavioralSample } from "@/lib/bibble/adaptive-style";
import { issueBibbleMutationGrant, type BibbleMutationGrant } from "@/lib/bibble/mutation-grant";

// ─── File content extraction ──────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

const MAX_TOOL_CALLS_POR_TURNO = 6;
const MAX_TOOL_CALLS_POR_REQUISICAO = 12;
const MAX_MUTACOES_CALENDARIO_POR_REQUISICAO = 3;
// Quantas vezes o fluxo sem-tools pode pedir "continue de onde parou" quando
// a resposta é cortada por limite de saída (ex.: relatório/conciliação longa).
// Mantido conservador: cada continuação é uma geração inteira nova no Ollama
// compartilhado (custo de GPU), e não há rate-limit por usuário nesta rota.
const MAX_CONTINUACOES_TRUNCAMENTO = 2;
const MUTACOES_CALENDARIO = new Set([
  "criar_evento_calendario",
  "editar_evento_calendario",
  "cancelar_evento_calendario",
  "criar_evento_calendario_colega",
  "editar_evento_calendario_colega",
  "cancelar_evento_calendario_colega",
]);

type ExtractionMetric = {
  source: string;
  extractedChars: number;
  includedChars: number;
  strategy: TextSelectionStrategy | "no-useful-text" | "metadata-only";
};

async function extractFilesContent(
  files: FileInput[],
  contentTokenBudget: number,
  signal?: AbortSignal,
): Promise<{ text: string; metrics: ExtractionMetric[]; estimatedTokens: number }> {
  if (!files.length) return { text: "", metrics: [], estimatedTokens: 0 };

  const parts: string[] = ["---", "### Arquivos Anexados pelo Usuário\n"];
  const metrics: ExtractionMetric[] = [];
  const headerTokens = estimateTokens(parts.join("\n\n"));

  // Cada arquivo de conteúdo (não imagem/vídeo) recebe uma fatia GARANTIDA do
  // orçamento, proporcional ao tamanho em bytes — antes, o 1º arquivo processado
  // podia consumir o orçamento inteiro e deixar os seguintes sem texto útil
  // (crítico com múltiplos extratos: um mês podia sobrar sem nenhum lançamento).
  const contentFiles = files.filter(f => !f.type.startsWith("image/") && !f.type.startsWith("video/"));
  const perFileBudget = allocatePerFileBudget(
    contentFiles.map(f => f.size),
    Math.max(0, contentTokenBudget - headerTokens),
  );
  const budgetByFile = new Map(contentFiles.map((f, i) => [f, perFileBudget[i]]));

  const appendExtractedText = (
    heading: string,
    raw: string,
    source: string,
    fileBudget: number,
  ) => {
    const headingTokens = estimateTokens(heading) + 2;
    const selection = selectTextForTokenBudget(
      raw,
      Math.max(0, fileBudget - headingTokens),
      "conteúdo do arquivo",
    );
    const part = `${heading}\n\`\`\`\n${selection.text}\n\`\`\``;
    parts.push(part);
    metrics.push({
      source,
      extractedChars: selection.originalChars,
      includedChars: selection.includedChars,
      strategy: selection.strategy,
    });
  };

  for (const file of files) {
    if (signal?.aborted) throw signal.reason;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (isImage) {
      // Imagens são enviadas como conteúdo de VISÃO (base64) — não como texto-link.
      // Tratadas à parte em coletarImagens(). Aqui só registramos o nome.
      parts.push(`- 🖼️ **${file.name}** (anexada como imagem para análise visual)`);
      metrics.push({ source: "vision", extractedChars: 0, includedChars: 0, strategy: "metadata-only" });
      continue;
    }
    if (isVideo) {
      parts.push(`- 🎬 **${file.name}** (${file.type}, ${fmtBytes(file.size)}) — [vídeo disponível em: ${file.url ?? "sem URL"}]`);
      metrics.push({ source: "video", extractedChars: 0, includedChars: 0, strategy: "metadata-only" });
      continue;
    }

    const fileBudget = budgetByFile.get(file) ?? 0;

    // Conteúdo já extraído no upload (blobs privados não podem ser re-fetchados)
    if (file.extractedContent?.trim()) {
      appendExtractedText(
        `#### 📄 ${file.name}`,
        file.extractedContent,
        file.extractionSource ?? "upload",
        fileBudget,
      );
      continue;
    }

    if (!file.url) {
      parts.push(`- 📎 **${file.name}** (${file.type}, ${fmtBytes(file.size)}) — sem URL de acesso`);
      metrics.push({ source: "missing-url", extractedChars: 0, includedChars: 0, strategy: "no-useful-text" });
      continue;
    }

    // Texto puro (código, CSV, JSON, Markdown…)
    const isText =
      file.type.startsWith("text/") ||
      file.type === "application/json" ||
      file.name.match(/\.(txt|csv|json|md|log|xml|yaml|yml|env|ts|tsx|js|jsx|py|java|cs|go|rs|cpp|c|h|php|rb|swift|kt)$/i) !== null;

    if (isText) {
      try {
        const res = await fetchTrustedBibbleBlob(file.url, {
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.text();
        appendExtractedText(`#### 📄 ${file.name} (${file.type})`, raw, "url-text", fileBudget);
      } catch {
        parts.push(`- ⚠️ **${file.name}** — falha ao ler o conteúdo.`);
        metrics.push({ source: "url-text", extractedChars: 0, includedChars: 0, strategy: "no-useful-text" });
      }
      continue;
    }

    // Documentos: usa Tika (PDF, DOCX, XLSX, PPTX, etc.)
    try {
      if (signal?.aborted) throw signal.reason;
      const { text, source } = await extractTextFromUrl(file.url, file.type, file.name, 20000);
      if (signal?.aborted) throw signal.reason;
      if (text) {
        appendExtractedText(`#### 📄 ${file.name} [via ${source}]`, text, source, fileBudget);
      } else {
        parts.push(`- ⚠️ **${file.name}** — não foi possível obter texto útil pela cadeia Tika, pdf-parse e OCR configurado.`);
        metrics.push({ source, extractedChars: 0, includedChars: 0, strategy: "no-useful-text" });
      }
    } catch {
      parts.push(`- ⚠️ **${file.name}** — falha ao extrair texto útil do documento.`);
      metrics.push({ source: "extraction-error", extractedChars: 0, includedChars: 0, strategy: "no-useful-text" });
    }
  }

  parts.push("---\n");
  const assembled = parts.join("\n\n");
  const bounded = selectTextForTokenBudget(
    assembled,
    contentTokenBudget,
    "conjunto de anexos",
  );
  if (bounded.reduced) {
    metrics.push({
      source: "assembled-context",
      extractedChars: bounded.originalChars,
      includedChars: bounded.includedChars,
      strategy: bounded.strategy,
    });
  }
  return { text: bounded.text, metrics, estimatedTokens: bounded.estimatedTokens };
}

type FileInput = {
  name: string;
  type: string;
  size: number;
  url?: string;
  base64?: string;
  extractedContent?: string;
  extractionSource?: "tika" | "pdf-parse" | "pdf24-ocr" | "unsupported";
};

/**
 * Coleta as imagens dos anexos como data URLs base64 (formato de visão OpenAI-compat).
 * Prioriza o base64 já enviado pelo cliente; senão baixa da URL do Blob e converte.
 */
async function coletarImagensBase64(files: FileInput[], signal?: AbortSignal): Promise<string[]> {
  const imagens: string[] = [];
  for (const file of files) {
    if (signal?.aborted) throw signal.reason;
    if (!file.type.startsWith("image/")) continue;
    try {
      if (file.base64?.trim()) {
        const url = file.base64.startsWith("data:") ? file.base64 : `data:${file.type};base64,${file.base64}`;
        imagens.push(url);
      } else if (file.url) {
        const res = await fetchTrustedBibbleBlob(file.url, {
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        imagens.push(`data:${file.type};base64,${buf.toString("base64")}`);
      }
    } catch {
      console.warn("[BIBBLE FILE] image-load-failed", {
        stage: "vision-input",
        size: file.size,
        type: file.type,
      });
    }
  }
  return imagens;
}

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ─── Types ────────────────────────────────────────────────────────────────────
// ChatMessage/ContentPart/CompletionResponse/StreamChunk vivem em @/lib/bibble/completion
// (extraídos para reuso — ver Onda 5 do Alpha Presentation Studio).

type SSEEvent =
  | { type: "status"; state: string }
  | { type: "text"; text: string }
  | { type: "calendar_changed" }
  | { type: "done"; finishReason?: string | null; truncated?: boolean; successful?: boolean }
  | { type: "error"; message: string };

// ─── Core streaming runner ────────────────────────────────────────────────────

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
  const TEMPO_LIMITE_CONTINUACAO_MS = (maxDuration - 20) * 1000;

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

// ─── Route handler ────────────────────────────────────────────────────────────

type AdaptiveStyleDependencies = {
  loadHistory: (userId: number) => Promise<BehavioralSample[]>;
  classify: (history: BehavioralSample[], currentMessage: string) => BehavioralProfile;
};

export async function deriveAdaptiveStyleForTurn(
  userId: number,
  message: string,
  inputPreferences: AdaptiveTonePreferences | undefined,
  dependencies: AdaptiveStyleDependencies = {
    loadHistory: loadBehavioralHistory,
    classify: classifyBehavioralStyle,
  },
): Promise<{
  adaptiveStyle: string | null;
  telemetry: { ms: number; sampleCount: number; applied: boolean };
}> {
  const startedAt = Date.now();
  const preferences = normalizeAdaptivePreferences(inputPreferences);
  try {
    const history = await dependencies.loadHistory(userId);
    const profile = dependencies.classify(history, message);
    return {
      adaptiveStyle: buildAdaptiveStylePrompt(profile, preferences, message),
      telemetry: {
        ms: Date.now() - startedAt,
        sampleCount: profile.sampleSize,
        applied: preferences.adaptiveTone,
      },
    };
  } catch {
    return {
      adaptiveStyle: null,
      telemetry: { ms: Date.now() - startedAt, sampleCount: 0, applied: false },
    };
  }
}

export async function POST(req: NextRequest) {
  const requestStartedAt = Date.now();
  const requestId = randomUUID();
  const deadlineAt = requestStartedAt + BIBBLE_REQUEST_DEADLINE_MS;
  const providerCtrl = new AbortController();
  const deadlineTimer = setTimeout(() => providerCtrl.abort(new Error('deadline')), Math.max(1, deadlineAt - Date.now()));
  const onRequestAbort = () => providerCtrl.abort(req.signal.reason);
  req.signal.addEventListener('abort', onRequestAbort, { once: true });
  const rejectBeforeLease = (response: Response) => {
    clearTimeout(deadlineTimer);
    req.signal.removeEventListener('abort', onRequestAbort);
    return response;
  };
  const session = await auth();
  if (providerCtrl.signal.aborted) return rejectBeforeLease(new Response(JSON.stringify({ error: "Prazo da solicitação excedido" }), { status: 504 }));
  if (!session?.user?.id) {
    return rejectBeforeLease(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }));
  }

  const userId = Number(session.user.id);
  const userTyped = session.user as {
    nome?: string;
    name?: string;
  };
  const usuarioAtual = await db.usuarios.findUnique({
      where: { id: userId },
      select: { nome: true, role: true, status: true },
    });
  if (!usuarioAtual || usuarioAtual.status !== "ATIVO") {
    return rejectBeforeLease(new Response(JSON.stringify({ error: "Usuário inativo ou não encontrado" }), {
      status: 403,
    }));
  }
  const lease = acquireBibbleLease(String(userId));
  if (!lease) return rejectBeforeLease(new Response(JSON.stringify({ error: "Bibble está processando outra solicitação sua. Tente novamente em instantes.", retryable: true }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "10" } }));
  const rejectEarly = (response: Response) => { lease.release(); clearTimeout(deadlineTimer); return response; };
  let rawInput: string;
  try { rawInput = await readRequestTextWithLimit(req); }
  catch { return rejectEarly(new Response(JSON.stringify({ error: "Payload do chat excede o limite permitido" }), { status: 413, headers: { "Content-Type": "application/json" } })); }
  const parsedInput = bibbleChatInputSchema.safeParse((() => { try { return JSON.parse(rawInput) as unknown; } catch { return null; } })());
  if (!parsedInput.success) return rejectEarly(new Response(JSON.stringify({ error: "Entrada de chat inválida" }), { status: 400, headers: { "Content-Type": "application/json" } }));
  const input: BibbleChatInput = parsedInput.data;
  const userPermissoes = await getPermissoesEfetivas(userId);
  const userName = usuarioAtual.nome || userTyped.nome || userTyped.name || "Usuário";
  const userRole = usuarioAtual.role;

  const userCtx: UserCtx = { userId, userName, role: userRole, permissoes: userPermissoes };

  const { message = "", history = [], context, sessionId, files, temperature, computerAccess, globalSystemPrompt, contextWindow } = input;
  const submittedFiles = files ?? [];
  if (submittedFiles.some(file => !file.url || !isBibbleBlobOwnedByUser(file.url, userId))) {
    return rejectEarly(new Response(JSON.stringify({ error: "Anexo sem ownership verificável" }), { status: 403 }));
  }
  const inputFiles = submittedFiles.map(file => ({ ...file, extractedContent: undefined }));
  const hasAttachments = inputFiles.length > 0;
  // Exige evidência real de conteúdo (URL do Blob validada ou texto já
  // extraído) — sem isso, qualquer usuário conseguiria declarar type/name de
  // PDF sem anexar nada real só para forçar a janela de contexto/output
  // ampliada (mais cara em GPU) no servidor Ollama compartilhado.
  const ultimaMensagemBibble = history.at(-1);
  const bibblePediuConfirmacaoDeCancelamento =
    ultimaMensagemBibble?.role === "bibble" &&
    /(?:confirm|posso|deseja).{0,100}cancel|cancel.{0,100}(?:confirm|posso|deseja)/i.test(
      ultimaMensagemBibble.text,
    );
  const usuarioConfirmouCancelamento =
    mensagemConfirmaCancelamentoCalendario(message);
  userCtx.confirmouCancelamentoCalendario =
    !hasAttachments
    && Boolean(bibblePediuConfirmacaoDeCancelamento)
    && usuarioConfirmouCancelamento;
  userCtx.solicitouCancelamentoCalendario =
    !hasAttachments && (
      userCtx.confirmouCancelamentoCalendario
      || mensagemSolicitaCancelamentoCalendario(message)
    );
  userCtx.solicitouAbrirChamado =
    !hasAttachments && mensagemSolicitaAbrirChamado(message);

  if (
    !hasAttachments &&
    userCtx.confirmouCancelamentoCalendario &&
    ultimaMensagemBibble?.role === "bibble"
  ) {
    userCtx.cancelamentoPendente = await resolverEventoConfirmadoDoUsuario(
      userId,
      ultimaMensagemBibble.text,
    ) ?? undefined;
  }

  // Validação: mensagem ou arquivos
  if (!message?.trim() && (!files || files.length === 0)) {
    return rejectEarly(new Response(JSON.stringify({ error: "Mensagem vazia" }), { status: 400 }));
  }

  // Instruções de projeto complementam o núcleo imutável; nunca o substituem.
  let projectInstructions: string | null = null;

  if (sessionId) {
    const bibbleSession = await db.bibbleSession.findUnique({
      where: { id: sessionId, userId },
      include: { project: { select: { systemPrompt: true } } },
    });
    if (bibbleSession?.project?.systemPrompt?.trim()) {
      projectInstructions = bibbleSession.project.systemPrompt.trim();
    }
  }

  const activeModel = BIBBLE_MODEL;

  // Perfil comportamental é derivado localmente de uma amostra autorizada e
  // limitada. Falhas degradam para a persona padrão e jamais repetem provider.
  const adaptiveResult = await deriveAdaptiveStyleForTurn(
    userId,
    message,
    input.adaptivePreferences,
  );
  const adaptiveStyle = adaptiveResult.adaptiveStyle;

  // ── Preparar mensagem e anexos ──
  let userContent = message.trim();
  let imagensBase64: string[] = [];

  const agoraSaoPaulo = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "long",
  }).format(new Date());
  const contextoTemporal =
    `\n\n## DATA E HORA ATUAIS\nAgora em America/Sao_Paulo: ${agoraSaoPaulo}. ` +
    "Converta referências como hoje, amanhã e próxima semana em datas absolutas antes de chamar ferramentas. " +
    "Para horários, sempre envie ISO 8601 com offset -03:00; não invente data, duração ou participantes ausentes.";

  const validatedModule = validateBibbleModuleContext(context, userPermissoes, userRole);
  const authorized = authorizedTools(BIBBLE_TOOLS, userCtx, computerAccess === true);
  const toolsToUse = routeToolsByIntent(authorized, message);
  const finalSystemPrompt = buildBibbleSystemPrompt({
    tools: hasAttachments ? [] : toolsToUse, userName, role: userRole, permissions: userPermissoes,
    moduleContext: validatedModule ? `${validatedModule.moduleKey} (${validatedModule.route})${validatedModule.entityId ? `; registro ${validatedModule.entityId}` : ''}` : undefined,
    projectInstructions, stylePreference: globalSystemPrompt, adaptiveStyle,
  }) + contextoTemporal;

  // Qualquer anexo segue fluxo isolado de uma única geração: nenhuma tool pode
  // misturar conteúdo não confiável do arquivo com ações no sistema.
  const toolsForTurn = hasAttachments ? [] : toolsToUse;
  const mutationGrant = userCtx.solicitouAbrirChamado === true
    && toolsForTurn.some((tool) => tool.function.name === "abrir_chamado")
    && deadlineAt > Date.now()
      ? issueBibbleMutationGrant({
          userId,
          requestId,
          tool: "abrir_chamado",
          expiresAt: Math.min(deadlineAt, Date.now() + 120_000),
          authorizedText: message,
        })
      : undefined;

  // Imagens → visão (base64). Se o modelo não suporta, avisa o usuário.
  const temImagem = inputFiles.some(file => file.type.startsWith("image/"));
  if (temImagem) {
    if (modelSupportsVision(activeModel)) {
      imagensBase64 = await coletarImagensBase64(inputFiles, providerCtrl.signal);
    } else {
      userContent =
        `⚠️ O modelo atual (**${getModelLabel(activeModel)}**) não consegue analisar imagens. ` +
        `Troque para um modelo com visão (ex.: GPT-4o, Claude, Gemini) ou contate o administrador.\n\n` +
        userContent;
    }
  }

  const userPromptWithoutFiles = userContent || "Analise os arquivos anexados.";
  const requestBudget = calculateRequestBudget({
    model: activeModel,
    requestedContextWindow: contextWindow,
    hasPdf: hasAttachments,
    systemPrompt: finalSystemPrompt,
    userPrompt: userPromptWithoutFiles,
    tools: toolsForTurn,
    imageCount: imagensBase64.length,
  });

  if (!requestBudget.fitsFixedInput) {
    console.warn("[BIBBLE BUDGET] insufficient", {
      requestId,
      stage: "request-budget",
      effectiveContextWindow: requestBudget.effectiveContextWindow,
      inputTokenBudget: requestBudget.inputTokenBudget,
      fixedInputTokens: requestBudget.fixedInputTokens,
      outputTokenLimit: requestBudget.outputTokenLimit,
    });
    return rejectEarly(new Response(JSON.stringify({
      error: "O prompt e as configurações atuais excedem a capacidade segura do modelo. Reduza o prompt personalizado ou escolha uma janela maior.",
    }), { status: 400, headers: { "Content-Type": "application/json" } }));
  }

  const rawHistory: ChatMessage[] = (history ?? []).map(historyMessage => ({
    role: historyMessage.role === "bibble" ? "assistant" : "user",
    content: historyMessage.text,
  }));
  const desiredHistoryTokens = rawHistory.reduce(
    (total, historyMessage) => total + estimateTokens(historyMessage.content) + 8,
    0,
  );
  const initialHistoryBudget = inputFiles.length > 0
    ? Math.min(desiredHistoryTokens, Math.floor(requestBudget.availableContentTokens * 0.2))
    : requestBudget.availableContentTokens;
  const documentTokenBudget = Math.max(
    0,
    requestBudget.availableContentTokens - initialHistoryBudget,
  );
  if (hasAttachments && documentTokenBudget < 256) {
    console.warn("[BIBBLE BUDGET] insufficient", {
      requestId,
      stage: "document-budget",
      effectiveContextWindow: requestBudget.effectiveContextWindow,
      documentTokenBudget,
      outputTokenLimit: requestBudget.outputTokenLimit,
    });
    return rejectEarly(new Response(JSON.stringify({
      error: "O PDF não cabe com segurança nesta requisição sem consumir a reserva da resposta. Reduza o prompt personalizado ou escolha uma janela maior.",
    }), { status: 400, headers: { "Content-Type": "application/json" } }));
  }
  const filesContext = await extractFilesContent(inputFiles, documentTokenBudget, providerCtrl.signal);
  if (providerCtrl.signal.aborted) return rejectEarly(new Response(JSON.stringify({ error: "Prazo da solicitação excedido" }), { status: 504 }));
  const historySelection = selectRecentHistory(
    rawHistory,
    Math.max(0, requestBudget.availableContentTokens - filesContext.estimatedTokens),
  );

  if (filesContext.text) {
    userContent = `${filesContext.text}\n\n${userPromptWithoutFiles}`;
  } else {
    userContent = userPromptWithoutFiles;
  }

  for (const metric of filesContext.metrics) {
    console.info("[BIBBLE PDF] context", {
      requestId,
      stage: "request-context",
      source: metric.source,
      extractedChars: metric.extractedChars,
      includedChars: metric.includedChars,
      effectiveContextWindow: requestBudget.effectiveContextWindow,
      inputTokenBudget: requestBudget.inputTokenBudget,
      outputTokenLimit: requestBudget.outputTokenLimit,
      strategy: metric.strategy,
    });
  }
  console.info("[BIBBLE BUDGET] request", {
    requestId,
    stage: "request-budget",
    effectiveContextWindow: requestBudget.effectiveContextWindow,
    inputTokenBudget: requestBudget.inputTokenBudget,
    fixedInputTokens: requestBudget.fixedInputTokens,
    documentTokens: filesContext.estimatedTokens,
    historyTokens: historySelection.estimatedTokens,
    outputTokenLimit: requestBudget.outputTokenLimit,
    legacyContextAdjusted: requestBudget.legacyContextAdjusted,
    historyReduced: historySelection.reduced,
  });

  // Mensagem do usuário: array multimodal quando há imagens (visão), senão string.
  const userMessage: ChatMessage =
    imagensBase64.length > 0
      ? {
          role: "user",
          content: [
            { type: "text", text: userContent },
            ...imagensBase64.map((url): ContentPart => ({ type: "image_url", image_url: { url } })),
          ],
        }
      : { role: "user", content: userContent };

  const baseMessages: ChatMessage[] = [
    { role: "system", content: finalSystemPrompt },
    ...historySelection.messages,
    userMessage,
  ];

  // ── Provider local (Ollama / OpenAI / Anthropic / Google) ───────────────────
  const metrics = createBibbleMetrics(userId, activeModel, { requestId, startedAt: requestStartedAt });
  metrics.contextMs = Date.now() - requestStartedAt;
  metrics.queueMs = lease.queueMs;
  metrics.adaptiveStyle = adaptiveResult.telemetry;
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      void runStream(
        controller,
        enc,
        baseMessages,
        userCtx,
        providerCtrl,
        activeModel,
        toolsForTurn,
        temperature,
        requestBudget.effectiveContextWindow,
        requestBudget.outputTokenLimit,
        metrics,
        lease,
        deadlineTimer,
        deadlineAt,
        mutationGrant,
      ).catch(() => {
        lease.release();
        safeBibbleLog(metrics);
        console.error("[BIBBLE CHAT] fatal", { stage: "stream" });
        try { controller.close(); } catch { /* ignore */ }
      });
    },
    cancel() {
      providerCtrl.abort();
      clearTimeout(deadlineTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Request-Id": metrics.requestId,
      "Server-Timing": `queue;dur=${metrics.queueMs}`,
    },
  });
}
