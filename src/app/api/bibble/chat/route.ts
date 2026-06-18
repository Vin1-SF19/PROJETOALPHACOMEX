import { NextRequest } from "next/server";
import { auth } from "../../../../../auth";
import { getProvider, getProviderConfig } from "@/lib/bibble/client";
import { BIBBLE_SYSTEM_PROMPT } from "@/lib/bibble/system-prompt";
import { BIBBLE_TOOLS, type OllamaTool } from "@/lib/bibble/tools";
import { executarTool, type UserCtx } from "@/lib/bibble/tool-executor";
import db from "@/lib/prisma";

// ─── File content extraction ──────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

async function extractFilesContent(
  files: Array<{ name: string; type: string; size: number; url?: string; base64?: string; extractedContent?: string }>
): Promise<string> {
  if (!files.length) return "";

  const parts: string[] = ["---", "### Arquivos Anexados pelo Usuário\n"];

  for (const file of files) {
    if (!file.url) {
      parts.push(`- 📎 **${file.name}** (${file.type}, ${fmtBytes(file.size)}) — sem URL de acesso`);
      continue;
    }

    // Conteúdo já extraído no upload (blobs privados não podem ser re-fetchados)
    if (file.extractedContent?.trim()) {
      const content = file.extractedContent.length > 25000
        ? file.extractedContent.slice(0, 25000) + "\n\n...[conteúdo truncado após 25.000 caracteres]"
        : file.extractedContent;
      const isPdfByName = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      parts.push(`#### 📄 ${file.name}${isPdfByName ? " (PDF)" : ""}\n\`\`\`\n${content}\n\`\`\``);
      continue;
    }

    const isText =
      file.type.startsWith("text/") ||
      file.type === "application/json" ||
      file.name.match(/\.(txt|csv|json|md|log|xml|yaml|yml|env|ts|tsx|js|jsx|py|java|cs|go|rs|cpp|c|h|php|rb|swift|kt)$/i) !== null;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    try {
      if (isText) {
        const res = await fetch(file.url, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.text();
        const content = raw.length > 20000 ? raw.slice(0, 20000) + "\n\n...[conteúdo truncado após 20.000 caracteres]" : raw;
        parts.push(`#### 📄 ${file.name} (${file.type})\n\`\`\`\n${content}\n\`\`\``);
      } else if (isPdf) {
        const res = await fetch(file.url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: buffer, verbosity: 0 });
        const parsed = await parser.getText();
        await parser.destroy();
        const text = parsed.text.trim();
        const content = text.length > 25000 ? text.slice(0, 25000) + "\n\n...[conteúdo truncado após 25.000 caracteres]" : text;
        const info = await new PDFParse({ data: buffer, verbosity: 0 }).getInfo().catch(() => null);
        const numpages = info?.total ?? "?";
        parts.push(`#### 📄 ${file.name} (PDF — ${numpages} pág.)\n\`\`\`\n${content}\n\`\`\``);
      } else if (isImage) {
        parts.push(`- 🖼️ **${file.name}** (${file.type}, ${fmtBytes(file.size)}) — [imagem disponível em: ${file.url}]`);
      } else if (isVideo) {
        parts.push(`- 🎬 **${file.name}** (${file.type}, ${fmtBytes(file.size)}) — [vídeo disponível em: ${file.url}]`);
      } else {
        parts.push(`- 📎 **${file.name}** (${file.type}, ${fmtBytes(file.size)}) — arquivo binário`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      parts.push(`- ⚠️ **${file.name}** — falha ao ler conteúdo: ${msg}`);
    }
  }

  parts.push("---\n");
  return parts.join("\n\n");
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCallRaw[];
  tool_call_id?: string;
}

interface ToolCallRaw {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface CompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
      tool_calls?: ToolCallRaw[];
    };
    finish_reason: string;
  }>;
}

interface StreamChunk {
  choices: Array<{
    delta: { content?: string };
    finish_reason: string | null;
  }>;
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function encode(event: SSEEvent, enc: TextEncoder): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(event)}\n\n`);
}

async function callCompletion(
  msgs: ChatMessage[],
  tools: OllamaTool[],
  model: string,
  signal: AbortSignal,
  stream: false,
  temperature?: number,
  contextWindow?: number,
): Promise<CompletionResponse>;
async function callCompletion(
  msgs: ChatMessage[],
  tools: OllamaTool[],
  model: string,
  signal: AbortSignal,
  stream: true,
  temperature?: number,
  contextWindow?: number,
): Promise<Response>;
async function callCompletion(
  msgs: ChatMessage[],
  tools: OllamaTool[],
  model: string,
  signal: AbortSignal,
  streamMode: boolean,
  temperature?: number,
  contextWindow?: number,
): Promise<CompletionResponse | Response> {
  const provider = getProvider(model);
  const { baseUrl, headers } = getProviderConfig(provider);

  const body: Record<string, unknown> = {
    model,
    messages: msgs,
    stream: streamMode,
  };
  if (temperature !== undefined) body.temperature = temperature;
  if (provider === "ollama" && contextWindow && contextWindow > 0) {
    body.options = { num_ctx: contextWindow };
    console.log(`[BIBBLE] num_ctx enviado: ${contextWindow}`);
  }
  if (!streamMode && tools.length > 0) {
    body.tools = tools;
  }

  const res = await fetch(baseUrl, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.status.toString());
    throw new Error(`Provider error ${res.status}: ${text}`);
  }

  if (streamMode) return res;
  return res.json() as Promise<CompletionResponse>;
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
    try { controller.enqueue(encode(event, enc)); } catch { /* stream closed */ }
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
      send({ type: "error", message: "Tive um problema aqui. Tenta de novo." });
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

  const baseMessages: ChatMessage[] = [
    { role: "system", content: finalSystemPrompt },
    ...(history ?? []).slice(-10).map((m): ChatMessage => ({
      role: m.role === "bibble" ? "assistant" : "user",
      content: m.text,
    })),
    { role: "user", content: userContentWithPage },
  ];

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
