import { NextRequest } from "next/server";
import { auth } from "../../../../../auth";
import { modelSupportsVision, getModelLabel } from "@/lib/bibble/client";
import { BIBBLE_SYSTEM_PROMPT } from "@/lib/bibble/system-prompt";
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
  calculateRequestBudget,
  estimateTokens,
  selectRecentHistory,
  selectTextForTokenBudget,
  type TextSelectionStrategy,
} from "@/lib/bibble/context-budget";
import { resultadoToolAlterouCalendario } from "@/lib/google-calendar/invalidation";
import db from "@/lib/prisma";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { isAdminRole } from "@/lib/roles";
import {
  bibbleChatInputSchema,
  fetchTrustedBibbleBlob,
  readRequestTextWithLimit,
  type BibbleChatInput,
} from "@/lib/bibble/attachment-security";

// ─── File content extraction ──────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

const MAX_TOOL_CALLS_POR_TURNO = 6;
const MAX_TOOL_CALLS_POR_REQUISICAO = 12;
const MAX_MUTACOES_CALENDARIO_POR_REQUISICAO = 3;
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
): Promise<{ text: string; metrics: ExtractionMetric[]; estimatedTokens: number }> {
  if (!files.length) return { text: "", metrics: [], estimatedTokens: 0 };

  const parts: string[] = ["---", "### Arquivos Anexados pelo Usuário\n"];
  const metrics: ExtractionMetric[] = [];
  let remainingTokens = Math.max(0, contentTokenBudget - estimateTokens(parts.join("\n\n")));

  const appendExtractedText = (
    heading: string,
    raw: string,
    source: string,
  ) => {
    const headingTokens = estimateTokens(heading) + 2;
    const selection = selectTextForTokenBudget(
      raw,
      Math.max(0, remainingTokens - headingTokens),
      "conteúdo do arquivo",
    );
    const part = `${heading}\n\`\`\`\n${selection.text}\n\`\`\``;
    const partTokens = estimateTokens(part);
    parts.push(part);
    remainingTokens = Math.max(0, remainingTokens - partTokens);
    metrics.push({
      source,
      extractedChars: selection.originalChars,
      includedChars: selection.includedChars,
      strategy: selection.strategy,
    });
  };

  for (const file of files) {
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

    // Conteúdo já extraído no upload (blobs privados não podem ser re-fetchados)
    if (file.extractedContent?.trim()) {
      appendExtractedText(
        `#### 📄 ${file.name}`,
        file.extractedContent,
        file.extractionSource ?? "upload",
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
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.text();
        appendExtractedText(`#### 📄 ${file.name} (${file.type})`, raw, "url-text");
      } catch {
        parts.push(`- ⚠️ **${file.name}** — falha ao ler o conteúdo.`);
        metrics.push({ source: "url-text", extractedChars: 0, includedChars: 0, strategy: "no-useful-text" });
      }
      continue;
    }

    // Documentos: usa Tika (PDF, DOCX, XLSX, PPTX, etc.)
    try {
      const { text, source } = await extractTextFromUrl(file.url, file.type, file.name, 20000);
      if (text) {
        appendExtractedText(`#### 📄 ${file.name} [via ${source}]`, text, source);
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
async function coletarImagensBase64(files: FileInput[]): Promise<string[]> {
  const imagens: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    try {
      if (file.base64?.trim()) {
        const url = file.base64.startsWith("data:") ? file.base64 : `data:${file.type};base64,${file.base64}`;
        imagens.push(url);
      } else if (file.url) {
        const res = await fetchTrustedBibbleBlob(file.url, {
          signal: AbortSignal.timeout(15000),
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

async function runStream(
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
): Promise<void> {
  const send = (event: SSEEvent) => {
    try { controller.enqueue(encodeSSE(event, enc)); } catch { /* stream closed */ }
  };

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

    if (
      userCtx.confirmouCancelamentoCalendario &&
      userCtx.cancelamentoPendente
    ) {
      send({ type: "status", state: "pesquisando" });
      const alvo = userCtx.cancelamentoPendente;
      console.info("[BIBBLE CALENDAR] Executando cancelamento confirmado", {
        userId: userCtx.userId,
        googleEventId: alvo.googleEventId,
      });
      const resultado = await executarTool(
        "cancelar_evento_calendario",
        {
          google_event_id: alvo.googleEventId,
          etag: alvo.etag,
          calendario_nome: alvo.calendarioNome,
          confirmado: true,
        },
        userCtx,
      );

      if (resultadoCancelamentoConcluido("cancelar_evento_calendario", resultado)) {
        console.info("[BIBBLE CALENDAR] Cancelamento confirmado pelo Google", {
          userId: userCtx.userId,
          googleEventId: alvo.googleEventId,
        });
        send({ type: "calendar_changed" });
        send({
          type: "text",
          text: `O evento **"${alvo.titulo}"** foi cancelado e removido do seu calendário.`,
        });
      } else {
        console.warn("[BIBBLE CALENDAR] Cancelamento não confirmado", {
          userId: userCtx.userId,
          googleEventId: alvo.googleEventId,
        });
        let mensagemErro = "Não consegui confirmar a exclusão do evento no Google Agenda.";
        try {
          const dados = JSON.parse(resultado) as { erro?: unknown };
          if (typeof dados.erro === "string") mensagemErro = dados.erro;
        } catch {
          if (resultado.trim()) mensagemErro = resultado;
        }
        send({ type: "text", text: mensagemErro });
      }
      send({ type: "done", successful: true });
      return;
    }

    for (let turn = 0; turn <= MAX_TOOL_TURNS; turn++) {
      if (tools.length > 0) {
        const data = await callCompletion(
          msgs,
          tools,
          model,
          providerCtrl.signal,
          false,
          temperature,
          contextWindow,
          maxOutputTokens,
        );
        const choice = data.choices[0];
        if (!choice) throw new Error("Resposta vazia do provedor");

        const toolCalls = choice.message.tool_calls;
        if (choice.finish_reason === "tool_calls" && toolCalls?.length) {
        send({ type: "status", state: "pesquisando" });

        msgs.push({
          role: "assistant",
          content: choice.message.content ?? "",
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
          if (
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
              result = await executarTool(tc.function.name, args, userCtx);
            }
          } else {
            result = await executarTool(tc.function.name, args, userCtx);
          }

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
      }

      // Sem ferramentas (fluxo de documento), a resposta é gerada uma única
      // vez diretamente em streaming. Com ferramentas, esta é a geração final.
      const streamRes = await callCompletion(
        msgs,
        [],
        model,
        providerCtrl.signal,
        true,
        temperature,
        contextWindow,
        maxOutputTokens,
      );

      let respostaFinalProtegida = "";
      const protegerRespostaCancelamento =
        userCtx.solicitouCancelamentoCalendario === true;
      // Quando o usuário pediu para abrir um chamado, uma alegação falsa de
      // abertura ("chamado #X criado") só pode ser barrada antes de qualquer
      // texto chegar à tela — por isso o turno é buferizado e revisado no fim.
      const protegerRespostaChamado =
        userCtx.solicitouAbrirChamado === true && !chamadoAbertoComSucesso;
      const bufferizarResposta = protegerRespostaCancelamento || protegerRespostaChamado;

      const streamResult = await consumeCompletionStream(streamRes, (delta) => {
        if (bufferizarResposta) {
          respostaFinalProtegida += delta;
        } else {
          send({ type: "text", text: delta });
        }
      });
      const finishReason = streamResult.finishReason;

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
      if (truncated) {
        send({
          type: "error",
          message: "A resposta atingiu o limite de saída do modelo e não foi concluída. Seus anexos e texto foram mantidos para tentar novamente.",
        });
      }

      console.info("[BIBBLE COMPLETION] finish", {
        stage: "final-stream",
        finishReason: finishReason ?? "provider-eof",
        truncated,
        outputTokenLimit: maxOutputTokens ?? null,
      });

      send({ type: "done", finishReason, truncated, successful: !truncated });
      return;
    }

    send({ type: "error", message: "A solicitação excedeu o limite seguro de etapas com ferramentas." });
    send({ type: "done", finishReason: "tool_turn_limit", truncated: true, successful: false });
  } catch {
    if (providerCtrl.signal.aborted) {
      try { send({ type: "done", successful: false }); } catch { /* ignore */ }
      return;
    }
    console.error("[BIBBLE CHAT] failed", { stage: "stream" });
    try {
      send({ type: "error", message: "Tive um problema aqui. Tenta de novo!!." });
      send({ type: "done", successful: false });
    } catch { /* ignore */ }
  } finally {
    try { controller.close(); } catch { /* already closed */ }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let rawInput: string;
  try {
    rawInput = await readRequestTextWithLimit(req);
  } catch {
    return new Response(JSON.stringify({ error: "Payload do chat excede o limite permitido" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }
  const parsedInput = bibbleChatInputSchema.safeParse(
    (() => {
      try { return JSON.parse(rawInput) as unknown; } catch { return null; }
    })(),
  );
  if (!parsedInput.success) {
    return new Response(JSON.stringify({ error: "Entrada de chat inválida" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const input: BibbleChatInput = parsedInput.data;
  const userId = Number(session.user.id);
  const userTyped = session.user as {
    nome?: string;
    name?: string;
  };
  const [usuarioAtual, userPermissoes] = await Promise.all([
    db.usuarios.findUnique({
      where: { id: userId },
      select: { nome: true, role: true, status: true },
    }),
    getPermissoesEfetivas(userId),
  ]);
  if (!usuarioAtual || usuarioAtual.status !== "ATIVO") {
    return new Response(JSON.stringify({ error: "Usuário inativo ou não encontrado" }), {
      status: 403,
    });
  }
  const userName = usuarioAtual.nome || userTyped.nome || userTyped.name || "Usuário";
  const userRole = usuarioAtual.role;

  const userCtx: UserCtx = { userId, userName, role: userRole, permissoes: userPermissoes };

  const { message = "", history = [], context, model: modelOverride, sessionId, files, temperature, computerAccess, globalSystemPrompt, contextWindow } = input;
  const inputFiles = files ?? [];
  const hasAttachments = inputFiles.length > 0;
  const hasPdf = inputFiles.some(file =>
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
  );
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
    return new Response(JSON.stringify({ error: "Mensagem vazia" }), { status: 400 });
  }

  // ── Resolve system prompt (project override if session is in a project) ──
  let systemPrompt = BIBBLE_SYSTEM_PROMPT;

  if (sessionId) {
    const bibbleSession = await db.bibbleSession.findUnique({
      where: { id: sessionId, userId },
      include: { project: { select: { systemPrompt: true } } },
    });
    if (bibbleSession?.project?.systemPrompt?.trim()) {
      systemPrompt = bibbleSession.project.systemPrompt.trim();
    }
  }

  const activeModel = modelOverride?.trim() || (process.env.BIBBLE_MODEL ?? "qwen3:14b");

  // ── Preparar mensagem e anexos ──
  let userContent = message.trim();
  let imagensBase64: string[] = [];

  // Injeta contexto do usuário no system prompt para o LLM saber as permissões upfront
  const isAdmin = isAdminRole(userRole);
  const permissoesCtx = isAdmin
    ? `\n\n## CONTEXTO DO USUÁRIO\nUsuário: ${userName} | Role: ${userRole} | Acesso: TOTAL (admin)`
    : `\n\n## CONTEXTO DO USUÁRIO\nUsuário: ${userName} | Role: ${userRole}\nMódulos com acesso: ${userPermissoes.length > 0 ? userPermissoes.join(", ") : "nenhum"}\n\nIMPORTANTE: Se o usuário pedir algo de um módulo que não está na lista acima, informe que ele não tem acesso e sugira contatar um administrador. NÃO tente executar a ação.`;

  const agoraSaoPaulo = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "long",
  }).format(new Date());
  const contextoTemporal =
    `\n\n## DATA E HORA ATUAIS\nAgora em America/Sao_Paulo: ${agoraSaoPaulo}. ` +
    "Converta referências como hoje, amanhã e próxima semana em datas absolutas antes de chamar ferramentas. " +
    "Para horários, sempre envie ISO 8601 com offset -03:00; não invente data, duração ou participantes ausentes.";

  let finalSystemPrompt = systemPrompt + permissoesCtx + contextoTemporal;

  if (globalSystemPrompt?.trim()) {
    finalSystemPrompt = finalSystemPrompt + "\n\n---\n\n## PERSONA CUSTOMIZADA (prioridade máxima)\n\n" + globalSystemPrompt.trim();
  }

  // Acesso ao computador: tools de sistema de arquivos só disponíveis quando habilitado
  const FS_TOOLS = new Set(["ler_arquivo", "criar_pasta", "criar_arquivo", "escrever_arquivo", "apagar", "mover_arquivo", "copiar_arquivo"]);
  const toolsToUse = computerAccess
    ? [...BIBBLE_TOOLS]
    : BIBBLE_TOOLS.filter(t => !FS_TOOLS.has(t.function.name));

  if (computerAccess) {
    const userHome = (process.env.USERPROFILE ?? process.env.HOME ?? "C:/Users/Usuario").replace(/\\/g, "/");
    const desktopPath = userHome + "/Desktop";
    finalSystemPrompt += `\n\n## ACESSO AO SISTEMA DE ARQUIVOS ATIVO
O usuário habilitou o acesso completo ao sistema de arquivos. Você tem as seguintes ferramentas disponíveis:

- \`ler_arquivo\` — lê um arquivo ou lista o conteúdo de uma pasta
- \`criar_pasta\` — cria uma pasta (e subpastas necessárias)
- \`criar_arquivo\` — cria um novo arquivo com conteúdo
- \`escrever_arquivo\` — escreve ou sobrescreve um arquivo existente
- \`apagar\` — apaga arquivo ou pasta (use recursivo: true para pastas com conteúdo)
- \`mover_arquivo\` — move ou renomeia arquivo/pasta
- \`copiar_arquivo\` — copia um arquivo para outro local

Caminhos desta máquina:
- Área de Trabalho: ${desktopPath}
- Pasta do usuário: ${userHome}
- Diretório do projeto: .

REGRA ABSOLUTA: Quando o usuário pedir para criar, copiar, mover, apagar ou listar arquivos/pastas, USE as ferramentas acima imediatamente. NUNCA diga que não tem acesso ao sistema de arquivos quando este modo estiver ativo.`;
  }

  // Qualquer anexo segue fluxo isolado de uma única geração: nenhuma tool pode
  // misturar conteúdo não confiável do arquivo com ações no sistema.
  const toolsForTurn = hasAttachments ? [] : toolsToUse;

  // Imagens → visão (base64). Se o modelo não suporta, avisa o usuário.
  const temImagem = inputFiles.some(file => file.type.startsWith("image/"));
  if (temImagem) {
    if (modelSupportsVision(activeModel)) {
      imagensBase64 = await coletarImagensBase64(inputFiles);
    } else {
      userContent =
        `⚠️ O modelo atual (**${getModelLabel(activeModel)}**) não consegue analisar imagens. ` +
        `Troque para um modelo com visão (ex.: GPT-4o, Claude, Gemini) ou contate o administrador.\n\n` +
        userContent;
    }
  }

  const userPromptWithoutFiles = context?.urlAtual
    ? `\n\n[Página atual: ${context.urlAtual}]\n\n${userContent || "Analise os arquivos anexados."}`
    : (userContent || "Analise os arquivos anexados.");
  const requestBudget = calculateRequestBudget({
    model: activeModel,
    requestedContextWindow: contextWindow,
    hasPdf,
    systemPrompt: finalSystemPrompt,
    userPrompt: userPromptWithoutFiles,
    tools: toolsForTurn,
    imageCount: imagensBase64.length,
  });

  if (!requestBudget.fitsFixedInput) {
    console.warn("[BIBBLE BUDGET] insufficient", {
      stage: "request-budget",
      effectiveContextWindow: requestBudget.effectiveContextWindow,
      inputTokenBudget: requestBudget.inputTokenBudget,
      fixedInputTokens: requestBudget.fixedInputTokens,
      outputTokenLimit: requestBudget.outputTokenLimit,
    });
    return new Response(JSON.stringify({
      error: "O prompt e as configurações atuais excedem a capacidade segura do modelo. Reduza o prompt personalizado ou escolha uma janela maior.",
    }), { status: 400, headers: { "Content-Type": "application/json" } });
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
  if (hasPdf && documentTokenBudget < 256) {
    console.warn("[BIBBLE BUDGET] insufficient", {
      stage: "document-budget",
      effectiveContextWindow: requestBudget.effectiveContextWindow,
      documentTokenBudget,
      outputTokenLimit: requestBudget.outputTokenLimit,
    });
    return new Response(JSON.stringify({
      error: "O PDF não cabe com segurança nesta requisição sem consumir a reserva da resposta. Reduza o prompt personalizado ou escolha uma janela maior.",
    }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const filesContext = await extractFilesContent(inputFiles, documentTokenBudget);
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
  const providerCtrl = new AbortController();
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
      ).catch(() => {
        console.error("[BIBBLE CHAT] fatal", { stage: "stream" });
        try { controller.close(); } catch { /* ignore */ }
      });
    },
    cancel() {
      providerCtrl.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
