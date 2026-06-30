import { NextRequest } from "next/server";
import { auth } from "../../../../../auth";
import {
  createChatSession,
  sendChatMessageStream,
  uploadChatFiles,
  OnyxError,
  type OnyxFileDescriptor,
} from "@/lib/onyx/client";
import { buildUserIdentityBlock } from "@/lib/onyx/system-knowledge";
import { BIBBLE_SYSTEM_PROMPT } from "@/lib/bibble/system-prompt";
import { extractTextFromUrl } from "@/lib/bibble/tika";
import { getUserOnyxToken } from "@/lib/onyx/user-token";
import db from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Eventos SSE — mesmo formato consumido pelo BibbleChatLayout, + "session".
type SSEEvent =
  | { type: "session"; onyxSessionId: string }
  | { type: "status"; state: string }
  | { type: "text"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

function encode(event: SSEEvent, enc: TextEncoder): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(event)}\n\n`);
}

interface AttachedFile {
  name: string;
  type: string;
  size: number;
  url?: string;
  extractedContent?: string;
}

interface HistoryMessage {
  role: "user" | "bibble";
  text: string;
}

interface ChatInput {
  message: string;
  agentId: number;
  onyxSessionId?: string | null;
  /** id da BibbleSession do Painel — para vincular o onyxSessionId a ela. */
  painelSessionId?: string | null;
  pageContext?: string | null;
  files?: AttachedFile[];
  history?: HistoryMessage[];
  /** Persona customizada (Bibble mode: agentId=0). Sobrepõe o system prompt padrão. */
  globalSystemPrompt?: string | null;
}

const MAX_FILE_CHARS = 25000;

function truncate(text: string): string {
  return text.length > MAX_FILE_CHARS
    ? text.slice(0, MAX_FILE_CHARS) + "\n\n...[conteúdo truncado após 25.000 caracteres]"
    : text;
}

/**
 * Formata o histórico recente como texto para reforçar o contexto do agente.
 * O Onyx mantém a própria sessão (onyxSessionId), mas quando ela zera (troca de
 * agente, reload), este histórico garante que o agente não perca o fio.
 */
function buildHistoryContext(history: HistoryMessage[]): string {
  if (!history.length) return "";
  const recent = history.slice(-12); // últimas 12 trocas
  const lines = recent.map(m => {
    const who = m.role === "bibble" ? "Assistente" : "Usuário";
    const txt = m.text.length > 4000 ? m.text.slice(0, 4000) + " [...]" : m.text;
    return `${who}: ${txt}`;
  });
  return `---\n### Histórico recente da conversa\n\n${lines.join("\n\n")}\n---`;
}

async function buildFileContext(files: AttachedFile[]): Promise<string> {
  if (!files.length) return "";
  const parts: string[] = ["---", "### Arquivos Anexados\n"];

  for (const file of files) {
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) continue;

    // Conteúdo já extraído no upload
    if (file.extractedContent?.trim()) {
      parts.push(`#### 📄 ${file.name}\n\`\`\`\n${truncate(file.extractedContent)}\n\`\`\``);
      continue;
    }

    // Texto puro
    const isText =
      file.type.startsWith("text/") ||
      file.type === "application/json" ||
      file.name.match(/\.(txt|csv|json|md|log|xml|yaml|yml|ts|tsx|js|jsx|py)$/i) !== null;

    if (isText && file.url) {
      try {
        const res = await fetch(file.url, { signal: AbortSignal.timeout(12000) });
        if (res.ok) {
          const raw = await res.text();
          parts.push(`#### 📄 ${file.name}\n\`\`\`\n${truncate(raw)}\n\`\`\``);
          continue;
        }
      } catch { /* fallback para Tika */ }
    }

    // Documentos binários: usa Tika
    if (file.url) {
      try {
        const { text, source } = await extractTextFromUrl(file.url, file.type, file.name, 20000);
        if (text) {
          parts.push(`#### 📄 ${file.name} [via ${source}]\n\`\`\`\n${truncate(text)}\n\`\`\``);
          continue;
        }
      } catch { /* ignora */ }
    }

    parts.push(`- 📎 **${file.name}** (${file.type}) — não foi possível extrair texto`);
  }

  parts.push("---\n");
  return parts.join("\n\n");
}

// Pacote NDJSON do Onyx
interface OnyxGeneratedImage {
  file_id?: string;
  url?: string;
  revised_prompt?: string;
}
interface OnyxPacket {
  obj?: {
    type: string;
    reasoning?: string;
    content?: string;
    images?: OnyxGeneratedImage[];
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401 });
  }

  const input = (await req.json().catch(() => ({}))) as Partial<ChatInput>;
  const message = (input.message ?? "").trim();
  const agentId = Number(input.agentId);
  let onyxSessionId = input.onyxSessionId ?? null;

  if (!message && (!input.files || input.files.length === 0)) {
    return new Response(JSON.stringify({ error: "Mensagem vazia" }), { status: 400 });
  }
  if (!Number.isInteger(agentId) || agentId < 0) {
    return new Response(JSON.stringify({ error: "Agente inválido" }), { status: 400 });
  }

  // Token Onyx individual do usuário (se cadastrado): autentica como o próprio
  // usuário no Onyx. Quando NULL, cai no PAT de serviço (comportamento atual).
  // Resolvido pelo id da sessão — nunca aceitar token do corpo da requisição.
  const userToken = await getUserOnyxToken(session.user.id);

  // Extrai texto dos arquivos antes de abrir o stream
  const files = input.files ?? [];
  const fileContext = files.length > 0 ? await buildFileContext(files) : "";
  const finalMessage = fileContext
    ? `${fileContext}\n\n${message || "Analise os arquivos acima."}`
    : message;

  // Imagens → upload pro Onyx (file_descriptors) para o agente "enxergar".
  let fileDescriptors: OnyxFileDescriptor[] = [];
  const imagens = files.filter((f) => f.type.startsWith("image/") && f.url);
  if (imagens.length > 0) {
    try {
      const blobs = await Promise.all(
        imagens.map(async (img) => {
          const r = await fetch(img.url!, { signal: AbortSignal.timeout(15000) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return { blob: await r.blob(), name: img.name };
        }),
      );
      fileDescriptors = await uploadChatFiles(blobs, userToken);
    } catch (err) {
      console.error("[ONYX] Falha ao subir imagens pro chat:", err);
    }
  }

  // Conhecimento do sistema + contexto do usuário, compartilhado com o agente
  const userTyped = session.user as {
    id?: string;
    nome?: string;
    name?: string;
    usuario?: string;
    email?: string;
    role?: string;
    permissoes?: string[];
  };

  // Identidade estável do usuário — enviada em TODA requisição ao Onyx para que
  // o servidor acesse a memória pessoal em memory/{user_id}. user_id = id do
  // PainelAlpha (estável, nunca muda).
  const identityBlock = buildUserIdentityBlock({
    userId: String(userTyped.id ?? session.user.id),
    username: userTyped.usuario ?? userTyped.nome ?? userTyped.name ?? "",
    email: userTyped.email ?? "",
  });

  const enc = new TextEncoder();
  const providerCtrl = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        try { controller.enqueue(encode(event, enc)); } catch { /* fechado */ }
      };

      try {
        send({ type: "status", state: "thinking" });

        // 1. Garante uma sessão Onyx (cria na primeira mensagem da conversa)
        const isFirstMessage = !onyxSessionId;
        if (isFirstMessage) {
          const created = await createChatSession(agentId, "PainelAlpha", userToken);
          onyxSessionId = created.chat_session_id;

          // Vincula a sessão Onyx à BibbleSession do Painel (ownership por userId),
          // para reidratar o histórico do Onyx ao reabrir a conversa.
          const painelSessionId = input.painelSessionId;
          if (painelSessionId) {
            await db.bibbleSession
              .updateMany({
                where: { id: painelSessionId, userId: Number(session.user.id) },
                data: { onyxSessionId },
              })
              .catch(() => {});
          }
        }
        // Informa o id ao cliente para reutilizar nas próximas mensagens
        send({ type: "session", onyxSessionId: onyxSessionId! });

        // additional_context só na primeira mensagem.
        // - agentId=0 (Bibble mode): injeta o system prompt do Bibble + identidade.
        // - agentes reais: só identidade (agentes têm system prompt próprio no Onyx).
        let additionalContext: string | undefined;
        if (isFirstMessage) {
          const historyContext = buildHistoryContext(input.history ?? []);
          const isBibbleMode = agentId === 0;

          if (isBibbleMode) {
            const persona = input.globalSystemPrompt?.trim() || BIBBLE_SYSTEM_PROMPT;
            const userRole = userTyped.role ?? "";
            const isAdmin = userRole === "Admin" || userRole === "CEO";
            const userName = userTyped.nome ?? userTyped.name ?? "Usuário";
            const permissoes = (userTyped.permissoes ?? []) as string[];
            const permCtx = isAdmin
              ? `Usuário: ${userName} | Role: ${userRole} | Acesso: TOTAL (admin)`
              : `Usuário: ${userName} | Role: ${userRole} | Módulos: ${permissoes.length > 0 ? permissoes.join(", ") : "nenhum"}`;
            const systemBlock = `${persona}\n\n## CONTEXTO DO USUÁRIO\n${permCtx}`;
            additionalContext = historyContext
              ? `${systemBlock}\n\n${identityBlock}\n\n${historyContext}`
              : `${systemBlock}\n\n${identityBlock}`;
          } else {
            additionalContext = historyContext
              ? `${identityBlock}\n\n${historyContext}`
              : identityBlock;
          }
        }

        // 2. Envia a mensagem e faz streaming (com o conhecimento do sistema)
        const res = await sendChatMessageStream({
          chatSessionId: onyxSessionId!,
          message: finalMessage,
          additionalContext,
          fileDescriptors,
          userToken,
          signal: providerCtrl.signal,
        });

        if (!res.ok || !res.body) {
          const body = await res.text().catch(() => "");
          throw new OnyxError(body || `Onyx respondeu ${res.status}`, res.status);
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let reasoningOpen = false;
        let answerStarted = false;

        const handlePacket = (pkt: OnyxPacket) => {
          const obj = pkt.obj;
          if (!obj) return;
          switch (obj.type) {
            case "reasoning_start":
              reasoningOpen = true;
              send({ type: "text", text: "<think>" });
              break;
            case "reasoning_delta":
              if (obj.reasoning) send({ type: "text", text: obj.reasoning });
              break;
            case "reasoning_done":
              if (reasoningOpen) {
                reasoningOpen = false;
                send({ type: "text", text: "</think>\n\n" });
              }
              break;
            case "message_start":
              if (!answerStarted) {
                answerStarted = true;
                send({ type: "status", state: "respondendo" });
              }
              break;
            case "message_delta":
              if (obj.content) send({ type: "text", text: obj.content });
              break;
            // ── Geração de imagem ──────────────────────────────
            case "image_generation_start":
              send({ type: "status", state: "gerando_imagem" });
              break;
            case "image_generation_heartbeat":
              // progresso — mantém o status de "gerando imagem"
              break;
            case "image_generation_final":
              if (obj.images?.length) {
                for (const img of obj.images) {
                  // Servimos a imagem pelo proxy autenticado (file_id) ou a URL direta
                  const src = img.file_id ? `/api/onyx/file/${img.file_id}` : (img.url ?? "");
                  if (src) {
                    // Alt SEMPRE curto e sanitizado: o revised_prompt pode ter
                    // quebras de linha, [], () — que quebram o markdown ![alt](url)
                    // e impedem a imagem de renderizar. Reduz a uma linha segura.
                    const alt = (img.revised_prompt ?? "imagem gerada")
                      .replace(/[\r\n]+/g, " ")   // sem quebras de linha
                      .replace(/[[\]()]/g, "")    // sem colchetes/parênteses
                      .replace(/\s+/g, " ")
                      .trim()
                      .slice(0, 80) || "imagem gerada";
                    send({ type: "text", text: `\n\n![${alt}](${src})\n\n` });
                  }
                }
              }
              break;
            case "stop":
              // fim do turno
              break;
            default:
              break;
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              handlePacket(JSON.parse(trimmed) as OnyxPacket);
            } catch { /* linha parcial/malformada */ }
          }
        }
        // resto do buffer
        if (buf.trim()) {
          try { handlePacket(JSON.parse(buf.trim()) as OnyxPacket); } catch { /* ignore */ }
        }
        // Fecha think aberto caso o stream tenha terminado durante o reasoning
        if (reasoningOpen) send({ type: "text", text: "</think>\n\n" });

        send({ type: "done" });
      } catch (err) {
        if (providerCtrl.signal.aborted) {
          try { send({ type: "done" }); } catch { /* ignore */ }
        } else {
          const msg = err instanceof OnyxError ? err.message : "Erro ao falar com o agente.";
          console.error("[ONYX CHAT]", msg);
          try {
            send({ type: "error", message: "O agente teve um problema. Tenta de novo." });
            send({ type: "done" });
          } catch { /* ignore */ }
        }
      } finally {
        try { controller.close(); } catch { /* já fechado */ }
      }
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
