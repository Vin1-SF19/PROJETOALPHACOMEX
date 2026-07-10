import { NextRequest } from "next/server";
import { auth } from "../../../../../auth";
import { modelSupportsVision, getModelLabel } from "@/lib/bibble/client";
import { BIBBLE_SYSTEM_PROMPT } from "@/lib/bibble/system-prompt";
import { BIBBLE_TOOLS, type OllamaTool } from "@/lib/bibble/tools";
import { executarTool, type UserCtx } from "@/lib/bibble/tool-executor";
import { extractTextFromUrl } from "@/lib/bibble/tika";
import { callCompletion, encodeSSE, type ChatMessage, type ContentPart, type StreamChunk } from "@/lib/bibble/completion";
import db from "@/lib/prisma";

// ─── File content extraction ──────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

const MAX_CONTENT_CHARS = 25000;

function truncate(text: string): string {
  return text.length > MAX_CONTENT_CHARS
    ? text.slice(0, MAX_CONTENT_CHARS) + "\n\n...[conteúdo truncado após 25.000 caracteres]"
    : text;
}

async function extractFilesContent(
  files: Array<{ name: string; type: string; size: number; url?: string; base64?: string; extractedContent?: string }>
): Promise<string> {
  if (!files.length) return "";

  const parts: string[] = ["---", "### Arquivos Anexados pelo Usuário\n"];

  for (const file of files) {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (isImage) {
      // Imagens são enviadas como conteúdo de VISÃO (base64) — não como texto-link.
      // Tratadas à parte em coletarImagens(). Aqui só registramos o nome.
      parts.push(`- 🖼️ **${file.name}** (anexada como imagem para análise visual)`);
      continue;
    }
    if (isVideo) {
      parts.push(`- 🎬 **${file.name}** (${file.type}, ${fmtBytes(file.size)}) — [vídeo disponível em: ${file.url ?? "sem URL"}]`);
      continue;
    }

    // Conteúdo já extraído no upload (blobs privados não podem ser re-fetchados)
    if (file.extractedContent?.trim()) {
      parts.push(`#### 📄 ${file.name}\n\`\`\`\n${truncate(file.extractedContent)}\n\`\`\``);
      continue;
    }

    if (!file.url) {
      parts.push(`- 📎 **${file.name}** (${file.type}, ${fmtBytes(file.size)}) — sem URL de acesso`);
      continue;
    }

    // Texto puro (código, CSV, JSON, Markdown…)
    const isText =
      file.type.startsWith("text/") ||
      file.type === "application/json" ||
      file.name.match(/\.(txt|csv|json|md|log|xml|yaml|yml|env|ts|tsx|js|jsx|py|java|cs|go|rs|cpp|c|h|php|rb|swift|kt)$/i) !== null;

    if (isText) {
      try {
        const res = await fetch(file.url, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.text();
        parts.push(`#### 📄 ${file.name} (${file.type})\n\`\`\`\n${truncate(raw)}\n\`\`\``);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        parts.push(`- ⚠️ **${file.name}** — falha ao ler: ${msg}`);
      }
      continue;
    }

    // Documentos: usa Tika (PDF, DOCX, XLSX, PPTX, etc.)
    try {
      const { text, source } = await extractTextFromUrl(file.url, file.type, file.name, 20000);
      if (text) {
        parts.push(`#### 📄 ${file.name} [via ${source}]\n\`\`\`\n${truncate(text)}\n\`\`\``);
      } else {
        parts.push(`- 📎 **${file.name}** (${file.type}, ${fmtBytes(file.size)}) — formato não suportado para extração de texto`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      parts.push(`- ⚠️ **${file.name}** — falha ao extrair conteúdo: ${msg}`);
    }
  }

  parts.push("---\n");
  return parts.join("\n\n");
}

type FileInput = { name: string; type: string; size: number; url?: string; base64?: string; extractedContent?: string };

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
        const res = await fetch(file.url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        imagens.push(`data:${file.type};base64,${buf.toString("base64")}`);
      }
    } catch (err) {
      console.error(`[BIBBLE] Falha ao carregar imagem ${file.name}:`, err);
    }
  }
  return imagens;
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─── Types ────────────────────────────────────────────────────────────────────
// ChatMessage/ContentPart/CompletionResponse/StreamChunk vivem em @/lib/bibble/completion
// (extraídos para reuso — ver Onda 5 do Alpha Presentation Studio).

type SSEEvent =
  | { type: "status"; state: string }
  | { type: "text"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

interface HistoryMessage {
  role: "user" | "bibble";
  text: string;
}

interface BibbleMessageWithFiles {
  message: string;
  files?: Array<{
    name: string;
    type: string;
    size: number;
    url?: string;
    base64?: string;
    extractedContent?: string;
  }>;
}

interface ChatInput {
  message: string;
  history: HistoryMessage[];
  context?: Record<string, unknown>;
  model?: string;
  sessionId?: string;
  files?: BibbleMessageWithFiles["files"];
  temperature?: number;
  computerAccess?: boolean;
  globalSystemPrompt?: string;
  contextWindow?: number;
}

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
): Promise<void> {
  const send = (event: SSEEvent) => {
    try { controller.enqueue(encodeSSE(event, enc)); } catch { /* stream closed */ }
  };

  try {
    send({ type: "status", state: "thinking" });

    const msgs: ChatMessage[] = [...baseMessages];
    const MAX_TOOL_TURNS = 5;

    for (let turn = 0; turn <= MAX_TOOL_TURNS; turn++) {
      const data = await callCompletion(msgs, tools, model, providerCtrl.signal, false, temperature, contextWindow);
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

        const results = await Promise.all(
          toolCalls.map(async (tc) => {
            const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
            const result = await executarTool(tc.function.name, args, userCtx);
            return { role: "tool" as const, tool_call_id: tc.id, content: result };
          })
        );

        msgs.push(...results);
        send({ type: "status", state: "thinking" });
        continue;
      }

      // Stream final answer
      const streamRes = await callCompletion(msgs, tools, model, providerCtrl.signal, true, temperature, contextWindow);

      if (!streamRes.body) throw new Error("Stream sem body");

      const reader = streamRes.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;
          try {
            const chunk = JSON.parse(raw) as StreamChunk;
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) send({ type: "text", text: delta });
          } catch { /* skip malformed chunk */ }
        }
      }

      break;
    }

    send({ type: "done" });
  } catch (err) {
    if (providerCtrl.signal.aborted) {
      try { send({ type: "done" }); } catch { /* ignore */ }
      return;
    }
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("[BIBBLE CHAT]", msg);
    try {
      send({ type: "error", message: "Tive um problema aqui. Tenta de novo!!." });
      send({ type: "done" });
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

  const userId = Number(session.user.id);
  const userTyped = session.user as {
    nome?: string;
    name?: string;
    role?: string;
    permissoes?: string[];
  };
  const userName = userTyped.nome ?? userTyped.name ?? "Usuário";
  const userRole = userTyped.role ?? "";
  const userPermissoes = userTyped.permissoes ?? [];

  const userCtx: UserCtx = { userId, userName, role: userRole, permissoes: userPermissoes };

  const input: ChatInput = await req.json().catch(() => ({}));
  const { message = "", history = [], context, model: modelOverride, sessionId, files, temperature, computerAccess, globalSystemPrompt, contextWindow } = input;

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

  // ── Formatar mensagem com arquivos — extrair conteúdo real ──
  let userContent = message.trim();
  let imagensBase64: string[] = [];

  if (files && files.length > 0) {
    console.log(`[BIBBLE] Extraindo conteúdo de ${files.length} arquivo(s)...`);
    try {
      const filesContext = await extractFilesContent(files);
      if (filesContext) {
        userContent = filesContext + "\n\n" + (userContent || "Analise os arquivos acima.");
      }
    } catch (err) {
      console.error("[BIBBLE] Erro ao extrair conteúdo de arquivos:", err);
    }

    // Imagens → visão (base64). Se o modelo não suporta, avisa o usuário.
    const temImagem = files.some(f => f.type.startsWith("image/"));
    if (temImagem) {
      if (modelSupportsVision(activeModel)) {
        imagensBase64 = await coletarImagensBase64(files);
      } else {
        userContent =
          `⚠️ O modelo atual (**${getModelLabel(activeModel)}**) não consegue analisar imagens. ` +
          `Troque para um modelo com visão (ex.: GPT-4o, Claude, Gemini) ou contate o administrador.\n\n` +
          userContent;
      }
    }
  }

  const userContentWithPage = context?.urlAtual
    ? `\n\n[Página atual: ${context.urlAtual}]\n\n${userContent}`
    : userContent;

  // Injeta contexto do usuário no system prompt para o LLM saber as permissões upfront
  const isAdmin = userRole === "Admin" || userRole === "CEO";
  const permissoesCtx = isAdmin
    ? `\n\n## CONTEXTO DO USUÁRIO\nUsuário: ${userName} | Role: ${userRole} | Acesso: TOTAL (admin)`
    : `\n\n## CONTEXTO DO USUÁRIO\nUsuário: ${userName} | Role: ${userRole}\nMódulos com acesso: ${userPermissoes.length > 0 ? userPermissoes.join(", ") : "nenhum"}\n\nIMPORTANTE: Se o usuário pedir algo de um módulo que não está na lista acima, informe que ele não tem acesso e sugira contatar um administrador. NÃO tente executar a ação.`;

  let finalSystemPrompt = systemPrompt + permissoesCtx;

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

  // Janela de histórico por orçamento de caracteres: mantém o máximo de trocas
  // recentes que cabe sem estourar o contexto do modelo. Aproxima ~4 chars/token;
  // reserva espaço para system prompt + mensagem atual + resposta.
  const ctxTokens = contextWindow && contextWindow > 0 ? contextWindow : 8192;
  const historyCharBudget = Math.max(4000, Math.floor(ctxTokens * 4 * 0.5));

  const trimmedHistory: ChatMessage[] = [];
  let usedChars = 0;
  for (let i = (history ?? []).length - 1; i >= 0; i--) {
    const m = history[i];
    const len = m.text?.length ?? 0;
    if (usedChars + len > historyCharBudget && trimmedHistory.length >= 2) break;
    usedChars += len;
    trimmedHistory.unshift({
      role: m.role === "bibble" ? "assistant" : "user",
      content: m.text,
    });
  }

  // Mensagem do usuário: array multimodal quando há imagens (visão), senão string.
  const userMessage: ChatMessage =
    imagensBase64.length > 0
      ? {
          role: "user",
          content: [
            { type: "text", text: userContentWithPage },
            ...imagensBase64.map((url): ContentPart => ({ type: "image_url", image_url: { url } })),
          ],
        }
      : { role: "user", content: userContentWithPage };

  const baseMessages: ChatMessage[] = [
    { role: "system", content: finalSystemPrompt },
    ...trimmedHistory,
    userMessage,
  ];

  // ── Provider local (Ollama / OpenAI / Anthropic / Google) ───────────────────
  const providerCtrl = new AbortController();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      void runStream(controller, enc, baseMessages, userCtx, providerCtrl, activeModel, toolsToUse, temperature, contextWindow).catch((fatal) => {
        console.error("[BIBBLE] fatal:", fatal);
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
