import { NextRequest } from "next/server";
import { auth } from "../../../../../auth";
import { modelSupportsVision, getModelLabel, BIBBLE_MODEL } from "@/lib/bibble/client";
import { BIBBLE_TOOLS } from "@/lib/bibble/tools";
import type { UserCtx } from "@/lib/bibble/tool-executor";
import {
  mensagemConfirmaCancelamentoCalendario,
  mensagemSolicitaCancelamentoCalendario,
  resolverEventoConfirmadoDoUsuario,
} from "@/lib/bibble/calendar-cancellation";
import {
  mensagemSolicitaAbrirChamado,
} from "@/lib/bibble/chamado-guard";
import { extractTextFromUrl } from "@/lib/bibble/tika";
import type { ChatMessage, ContentPart } from "@/lib/bibble/completion";
import {
  allocatePerFileBudget,
  calculateRequestBudget,
  estimateTokens,
  selectRecentHistory,
  selectTextForTokenBudget,
  type TextSelectionStrategy,
} from "@/lib/bibble/context-budget";
import db from "@/lib/prisma";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import {
  bibbleChatInputSchema,
  fetchTrustedBibbleBlob,
  isBibbleBlobOwnedByUser,
  readRequestTextWithLimit,
  type BibbleChatInput,
} from "@/lib/bibble/attachment-security";
import { acquireBibbleLease } from "@/lib/bibble/admission-control";
import { buildBibbleSystemPrompt } from "@/lib/bibble/persona";
import { validateBibbleModuleContext } from "@/lib/bibble/module-context";
import { authorizedTools, routeToolsByIntent } from "@/lib/bibble/tool-policy";
import { BIBBLE_REQUEST_DEADLINE_MS } from "@/lib/bibble/runtime-config";
import { createBibbleMetrics, safeBibbleLog } from "@/lib/bibble/telemetry";
import { randomUUID } from "crypto";
import { issueBibbleMutationGrant } from "@/lib/bibble/mutation-grant";
import { runStream } from "@/lib/bibble/chat-stream-runner";
import { deriveAdaptiveStyleForTurn } from "@/lib/bibble/adaptive-turn";

// ─── File content extraction ──────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

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

// ─── Route handler ────────────────────────────────────────────────────────────

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
