import { NextRequest } from "next/server";
import { auth } from "../../../../../auth";
import {
  createChatSession,
  sendChatMessageStream,
  OnyxError,
} from "@/lib/onyx/client";
import { buildAgentSystemContext } from "@/lib/onyx/system-knowledge";

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

interface ChatInput {
  message: string;
  agentId: number;
  onyxSessionId?: string | null;
  pageContext?: string | null;
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

  if (!message) {
    return new Response(JSON.stringify({ error: "Mensagem vazia" }), { status: 400 });
  }
  if (!Number.isInteger(agentId) || agentId < 0) {
    return new Response(JSON.stringify({ error: "Agente inválido" }), { status: 400 });
  }

  // Conhecimento do sistema + contexto do usuário, compartilhado com o agente
  const userTyped = session.user as { nome?: string; name?: string; role?: string; permissoes?: string[] };
  const systemContext = buildAgentSystemContext({
    userName: userTyped.nome ?? userTyped.name ?? "Usuário",
    role: userTyped.role ?? "",
    permissoes: userTyped.permissoes ?? [],
    pageContext: input.pageContext ?? null,
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
        if (!onyxSessionId) {
          const created = await createChatSession(agentId, "PainelAlpha");
          onyxSessionId = created.chat_session_id;
        }
        // Informa o id ao cliente para reutilizar nas próximas mensagens
        send({ type: "session", onyxSessionId });

        // 2. Envia a mensagem e faz streaming (com o conhecimento do sistema)
        const res = await sendChatMessageStream({
          chatSessionId: onyxSessionId,
          message,
          additionalContext: systemContext,
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
                    const alt = (img.revised_prompt ?? "imagem gerada").replace(/[[\]]/g, "");
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
