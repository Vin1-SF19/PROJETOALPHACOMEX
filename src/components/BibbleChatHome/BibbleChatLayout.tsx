"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BibbleSidebarPanel, { type SessionSummary, type ProjectSummary } from "./BibbleSidebarPanel";
import BibbleChatWindow from "./BibbleChatWindow";
import BibbleSettingsPanel from "./BibbleSettingsPanel";
import OnyxAgentsModal from "./OnyxAgentsModal";
import { type Message } from "./BibbleMessageBubble";
import type { UploadedFile } from "./BibbleFileUpload";
import { agentAvatarUrl, fetchFixados, toggleFixarAgente, fetchAgents, type OnyxAgent, type AgenteFixado } from "@/lib/onyx/browser";
import { getTema } from "@/lib/temas";

interface BibbleChatLayoutProps {
  userId: number;
  userName: string;
  role?: string;
  sessoesIniciais: SessionSummary[];
  temaName?: string;
}

let msgCounter = 0;
const newId = () => `msg-${++msgCounter}-${Date.now()}`;

const DEFAULT_MODEL = "gemma4:e4b";

export type StreamStatus = "idle" | "thinking" | "pesquisando" | "gerando_imagem";

/**
 * Separa o conteúdo de raciocínio (<think>...</think>) do texto visível.
 * Lida com o caso de stream parcial: se a tag <think> abriu mas ainda não
 * fechou, todo o conteúdo após <think> é tratado como think (em progresso).
 */
function splitThink(raw: string): { content: string; thinkContent?: string } {
  const openIdx = raw.indexOf("<think>");
  if (openIdx === -1) return { content: raw };

  const closeIdx = raw.indexOf("</think>");
  if (closeIdx === -1) {
    // think ainda aberto (streaming): tudo após <think> é raciocínio
    const before = raw.slice(0, openIdx);
    const think = raw.slice(openIdx + "<think>".length);
    return {
      content: before.trim(),
      thinkContent: think.length ? think : undefined,
    };
  }

  // think fechado: extrai e remove do content
  const think = raw.slice(openIdx + "<think>".length, closeIdx);
  const content = (raw.slice(0, openIdx) + raw.slice(closeIdx + "</think>".length)).trim();
  return {
    content,
    thinkContent: think.trim().length ? think.trim() : undefined,
  };
}

/** Marcador inserido em persistedContent ao anexar texto de arquivos. */
const FILE_CONTENT_MARKER = "\n\n---\n### Conteúdo dos arquivos anexados\n\n";

/**
 * Ao recarregar uma sessão do banco, separa o label curto (exibido na bolha) do
 * bloco com o texto extraído dos arquivos (mantido em fullContent para a IA).
 */
function splitPersisted(raw: string): { display: string; full: string } {
  const idx = raw.indexOf(FILE_CONTENT_MARKER);
  if (idx === -1) return { display: raw, full: raw };
  return { display: raw.slice(0, idx).trim(), full: raw };
}

export default function BibbleChatLayout({
  userName,
  role,
  sessoesIniciais,
  temaName,
}: BibbleChatLayoutProps) {
  const tema    = getTema(temaName);
  const isAdmin = role === "Admin" || role === "ADMIN";

  const [sessions, setSessions]             = useState<SessionSummary[]>(sessoesIniciais);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages]             = useState<Message[]>([]);
  const [inputValue, setInputValue]         = useState("");
  const [isStreaming, setIsStreaming]       = useState(false);
  const [streamStatus, setStreamStatus]     = useState<StreamStatus>("idle");
  const [model, setModel]                   = useState(DEFAULT_MODEL);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Onyx (agentes de IA) ──
  const [onyxModalOpen, setOnyxModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<OnyxAgent | null>(null);
  const onyxSessionRef = useRef<string | null>(null);   // sessão Onyx da conversa atual
  const selectedAgentRef = useRef<OnyxAgent | null>(null);

  // Agentes fixados (máx. 3, do banco). Lista enriquecida com nome/avatar via fetchAgents.
  const [fixados, setFixados] = useState<AgenteFixado[]>([]);
  const [agentesCache, setAgentesCache] = useState<OnyxAgent[]>([]);
  const fixadosIds = fixados.map(f => f.onyxAgentId);

  useEffect(() => {
    let ativo = true;
    Promise.all([fetchFixados(), fetchAgents()])
      .then(([fx, ags]) => { if (ativo) { setFixados(fx); setAgentesCache(ags); } })
      .catch(() => {});
    return () => { ativo = false; };
  }, []);

  const handleToggleFixar = useCallback(async (agent: OnyxAgent) => {
    const jaFixado = fixados.some(f => f.onyxAgentId === agent.id);
    try {
      const novos = await toggleFixarAgente(agent.id, jaFixado ? "desfixar" : "fixar", agent.name);
      setFixados(novos);
    } catch {
      /* limite de 3 ou erro — silencioso (o modal já valida via fixadosIds) */
    }
  }, [fixados]);

  // Lista de fixados enriquecida com nome/imagem (busca no cache de agentes)
  const fixadosSidebar = fixados.slice(0, 3).map(f => {
    const ag = agentesCache.find(a => a.id === f.onyxAgentId);
    return {
      id: f.onyxAgentId,
      name: ag?.name ?? f.agentName ?? `Agente ${f.onyxAgentId}`,
      hasImage: !!ag?.uploaded_image_id,
    };
  });
  const [temperature, setTemperature] = useState<number>(() => {
    if (typeof window === "undefined") return 0.7;
    return Number(localStorage.getItem("bibble-temperature") ?? "0.7");
  });
  const [globalSystemPrompt, setGlobalSystemPrompt] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("bibble-system-prompt") ?? "";
  });
  const [ollamaUrl, setOllamaUrl] = useState<string>(() => {
    if (typeof window === "undefined") return "http://localhost:11434";
    return localStorage.getItem("bibble-ollama-url") ?? "http://localhost:11434";
  });
  const [computerAccess, setComputerAccess] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("bibble-computer-access") === "true";
  });
  const [contextWindow, setContextWindow] = useState<number>(() => {
    if (typeof window === "undefined") return 4096;
    return Number(localStorage.getItem("bibble-context-window") ?? "4096");
  });
  const abortRef                              = useRef<AbortController | null>(null);
  const messagesRef                           = useRef<Message[]>([]);
  const [uploadFiles, setUploadFiles]         = useState<UploadedFile[]>([]);
  const [showFiles, setShowFiles]           = useState(false);

  // Mantém ref atualizado para leitura em callbacks sem criar dependência circular
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Ao trocar de agente, sincroniza o ref e zera a sessão Onyx (nova conversa com o agente)
  useEffect(() => {
    selectedAgentRef.current = selectedAgent;
    onyxSessionRef.current = null;
  }, [selectedAgent]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  /* ── Add & upload files ─────────────────────────────────── */
  const handleAddFiles = useCallback((newFiles: File[]) => {
    const MAX_SIZE = 50 * 1024 * 1024;
    const ALLOWED = [
      "image/jpeg","image/png","image/gif","image/webp","image/svg+xml",
      "video/mp4","video/webm","video/quicktime",
      "application/pdf",
      "application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain","text/csv","application/json",
    ];

    const entries: UploadedFile[] = newFiles
      .filter(f => f.size <= MAX_SIZE && (ALLOWED.includes(f.type) || f.name.match(/\.(txt|csv|json|md|pdf|doc|docx|xls|xlsx|ts|tsx|js|jsx|py)$/i)))
      .map(f => ({
        id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
        uploading: true,
      }));

    if (entries.length === 0) return;

    setUploadFiles(prev => [...prev, ...entries]);
    setShowFiles(true);

    entries.forEach(entry => {
      const form = new FormData();
      form.append("file", entry.file);

      fetch("/api/bibble/upload-to-blob", { method: "POST", body: form })
        .then(res => {
          if (!res.ok) return Promise.reject(new Error(`HTTP ${res.status}`));
          return res.json() as Promise<{ success: boolean; file: { url: string; extractedContent?: string } }>;
        })
        .then(data => {
          setUploadFiles(prev => prev.map(f =>
            f.id === entry.id ? {
              ...f,
              uploading: false,
              uploadUrl: data.file.url,
              extractedContent: data.file.extractedContent,
            } : f
          ));
        })
        .catch(() => {
          setUploadFiles(prev => prev.map(f =>
            f.id === entry.id ? { ...f, uploading: false, error: "Falha no upload" } : f
          ));
        });
    });
  }, []);

  /* ── Settings handlers (persist em localStorage) ────────── */
  const handleTemperatureChange = (v: number) => {
    setTemperature(v);
    localStorage.setItem("bibble-temperature", String(v));
  };
  const handleSystemPromptChange = (v: string) => {
    setGlobalSystemPrompt(v);
    localStorage.setItem("bibble-system-prompt", v);
  };
  const handleOllamaUrlChange = (url: string) => {
    setOllamaUrl(url);
    localStorage.setItem("bibble-ollama-url", url);
  };
  const handleComputerAccessChange = (v: boolean) => {
    setComputerAccess(v);
    localStorage.setItem("bibble-computer-access", String(v));
  };
  const handleContextWindowChange = (v: number) => {
    setContextWindow(v);
    localStorage.setItem("bibble-context-window", String(v));
  };

  /* ── Load session ───────────────────────────────────────── */
  const loadSession = useCallback(async (id: string) => {
    setActiveSessionId(id);
    setMessages([]);
    try {
      const res = await fetch(`/api/bibble/sessions/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages: Array<{ id: string; role: string; content: string }>;
      };
      setMessages(
        data.messages.map(m => {
          // Mensagens do usuário podem conter o bloco de arquivos anexados:
          // separa o que aparece na bolha do que vai para a IA (fullContent).
          if (m.role === "user") {
            const { display, full } = splitPersisted(m.content);
            return {
              id: m.id,
              role: "user" as const,
              content: display,
              fullContent: full !== display ? full : undefined,
            };
          }
          const { content, thinkContent } = splitThink(m.content);
          return {
            id: m.id,
            role: "assistant" as const,
            content,
            thinkContent,
          };
        })
      );
    } catch { /* ignore */ }
  }, []);

  /* ── Create session ─────────────────────────────────────── */
  const createSession = useCallback(async (firstMessage?: string, projectId?: string | null): Promise<string | null> => {
    try {
      const title = firstMessage
        ? firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "…" : "")
        : "Nova conversa";
      const body: { title: string; projectId?: string } = { title };
      if (projectId) body.projectId = projectId;

      const res = await fetch("/api/bibble/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const session = (await res.json()) as SessionSummary;
      setSessions(prev => [session, ...prev]);
      setActiveSessionId(session.id);
      return session.id;
    } catch { return null; }
  }, []);

  /* ── Save messages ──────────────────────────────────────── */
  const saveMessages = useCallback(async (
    sessionId: string,
    userMsg: string,
    assistantMsg: string,
  ) => {
    try {
      const res = await fetch(`/api/bibble/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userContent: userMsg, assistantContent: assistantMsg }),
      });
      if (!res.ok) {
        console.error("[Bibble] saveMessages failed:", res.status, await res.text().catch(() => ""));
        return;
      }
      setSessions(prev =>
        prev.map(s =>
          s.id === sessionId
            ? { ...s, updatedAt: new Date().toISOString() }
            : s
        )
      );
    } catch (err) {
      console.error("[Bibble] saveMessages error:", err);
    }
  }, []);

  /* ── Consome o stream SSE (Bibble ou Onyx) e atualiza a mensagem do assistente ── */
  const consumeChatStream = useCallback(async (res: Response, assistantId: string): Promise<string> => {
    if (!res.ok || !res.body) throw new Error("API error");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let fullResponse = "";

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6)) as {
            type: string;
            text?: string;
            state?: string;
            message?: string;
            onyxSessionId?: string;
          };

          if (event.type === "session" && event.onyxSessionId) {
            onyxSessionRef.current = event.onyxSessionId;
          } else if (event.type === "status" && event.state) {
            setStreamStatus(event.state as StreamStatus);
          } else if (event.type === "text" && event.text) {
            fullResponse += event.text;
            const { content: snapContent, thinkContent: snapThink } = splitThink(fullResponse);
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: snapContent, thinkContent: snapThink, streaming: true }
                  : m
              )
            );
          } else if (event.type === "error") {
            fullResponse = event.message ?? "Erro ao processar.";
          } else if (event.type === "done") {
            break outer;
          }
        } catch { /* malformed chunk */ }
      }
    }
    return fullResponse;
  }, []);

  /* ── Send message ───────────────────────────────────────── */
  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text && uploadFiles.length === 0) return;

    setInputValue("");

    const readyFiles = uploadFiles.filter(f => !f.uploading && !f.error);

    // A bolha mostra os anexos visualmente (imagem/chip), então o texto fica limpo.
    // Só docs (não-imagem) ganham um rótulo curto quando não há texto digitado.
    let msgContent = text;
    if (!text && readyFiles.length > 0) {
      const temImagem = readyFiles.some(f => f.file.type.startsWith("image/"));
      msgContent = temImagem ? "" : `Analise o(s) arquivo(s) anexado(s).`;
    }

    // Anexos exibidos na bolha (imagem inline / chip de doc) — com URL do Blob
    const filesForBubble = readyFiles.map(f => ({
      name: f.file.name,
      type: f.file.type,
      url: f.uploadUrl ?? f.previewUrl,
      size: f.file.size,
    }));

    // Conteúdo COMPLETO (com texto extraído dos arquivos) — persistido no
    // histórico para que a IA reenxergue o documento nas perguntas seguintes.
    let persistedContent = msgContent;
    if (readyFiles.length > 0) {
      const docParts = readyFiles
        .filter(f => f.extractedContent?.trim())
        .map(f => `#### 📄 ${f.file.name}\n\`\`\`\n${f.extractedContent!.slice(0, 25000)}\n\`\`\``);
      if (docParts.length > 0) {
        persistedContent = `${msgContent}\n\n---\n### Conteúdo dos arquivos anexados\n\n${docParts.join("\n\n")}\n---`;
      }
    }

    // A bolha mostra os anexos visualmente; o histórico/banco guarda o conteúdo completo.
    const userMsg: Message      = { id: newId(), role: "user",      content: msgContent, fullContent: persistedContent, files: filesForBubble.length > 0 ? filesForBubble : undefined };
    const assistantMsg: Message = { id: newId(), role: "assistant",  content: "", streaming: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setUploadFiles([]);
    setShowFiles(false);

    setIsStreaming(true);
    setStreamStatus("thinking");

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = await createSession(msgContent, activeProjectId);
      if (!sessionId) {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id
              ? { ...m, content: "Erro ao criar sessão.", streaming: false }
              : m
          )
        );
        setIsStreaming(false);
        setStreamStatus("idle");
        return;
      }
    }

    const history = messagesRef.current
      .filter(m => !m.streaming)
      .map(m => ({
        role: m.role === "assistant" ? "bibble" as const : "user" as const,
        // Usa o conteúdo completo (com texto dos PDFs) quando disponível.
        text: m.fullContent ?? m.content,
      }));

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let fullResponse = "";

    try {
      // Preparar dados dos arquivos para envio (URLs do Blob)
      const filesForChat = uploadFiles
        .filter(f => !f.uploading && !f.error && f.uploadUrl)
        .map(f => ({
          name: f.file.name,
          type: f.file.type,
          size: f.file.size,
          url: f.uploadUrl,
          extractedContent: f.extractedContent,
        }));

      console.log("[BIBBLE] Sending message with files:", filesForChat.map(f => f.name));

      // Se um agente Onyx está selecionado, conversa vai pelo Onyx; senão, fluxo Bibble/Ollama
      const agente = selectedAgentRef.current;
      const res = agente
        ? await fetch("/api/onyx/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ctrl.signal,
            body: JSON.stringify({
              message: text,
              agentId: agente.id,
              onyxSessionId: onyxSessionRef.current,
              pageContext: typeof window !== "undefined" ? window.location.pathname : null,
              files: filesForChat.length > 0 ? filesForChat : undefined,
              history,
            }),
          })
        : await fetch("/api/bibble/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ctrl.signal,
            body: JSON.stringify({
              message: msgContent,
              history,
              model,
              sessionId,
              files: filesForChat.length > 0 ? filesForChat : undefined,
              temperature,
              computerAccess,
              contextWindow,
              ...(globalSystemPrompt.trim() ? { globalSystemPrompt } : {}),
            }),
          });

      fullResponse = await consumeChatStream(res, assistantMsg.id);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        fullResponse = fullResponse || "Tive um problema. Tenta de novo.";
      }
    }

    const { content: finalContent, thinkContent: finalThink } = splitThink(fullResponse);
    setMessages(prev =>
      prev.map(m =>
        m.id === assistantMsg.id
          ? { ...m, content: finalContent, thinkContent: finalThink, streaming: false }
          : m
      )
    );
    setIsStreaming(false);
    setStreamStatus("idle");
    abortRef.current = null;

    if (fullResponse && sessionId) {
      // Persiste o conteúdo COMPLETO (com texto dos PDFs) para a IA reenxergar
      // o documento ao recarregar a sessão e em perguntas futuras.
      await saveMessages(sessionId, persistedContent, fullResponse);
    }
  }, [inputValue, uploadFiles, activeSessionId, activeProjectId, model, temperature, computerAccess, contextWindow, globalSystemPrompt, createSession, saveMessages, consumeChatStream]);

  /* ── Conversar (vazio): ativa o agente e abre uma conversa NOVA sem mensagens ── */
  const conversarVazio = useCallback((agent: OnyxAgent) => {
    setSelectedAgent(agent);
    selectedAgentRef.current = agent;
    onyxSessionRef.current = null;
    setActiveSessionId(null);
    setMessages([]);
    setInputValue("");
    setIsStreaming(false);
    setStreamStatus("idle");
  }, []);

  /* ── "Quem é você?": ativa o agente, abre conversa nova e já pede apresentação ── */
  const quemEhVoceAgente = useCallback(async (agent: OnyxAgent) => {
    // Ativa o agente imediatamente (UI: header, avatares) e zera a conversa/sessão Onyx
    setSelectedAgent(agent);
    selectedAgentRef.current = agent;
    onyxSessionRef.current = null;
    setActiveSessionId(null);
    setInputValue("");

    const introText = "Quem é você? Se apresente e me explique, de forma objetiva, o que você pode fazer por mim.";
    const userMsg: Message      = { id: newId(), role: "user",      content: introText };
    const assistantMsg: Message = { id: newId(), role: "assistant", content: "", streaming: true };
    setMessages([userMsg, assistantMsg]);

    setIsStreaming(true);
    setStreamStatus("thinking");

    // Persiste a conversa no banco do Painel (mesmo padrão do handleSend)
    const sessionId = await createSession(introText, activeProjectId);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let fullResponse = "";

    try {
      const res = await fetch("/api/onyx/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          message: introText,
          agentId: agent.id,
          onyxSessionId: null,
          pageContext: typeof window !== "undefined" ? window.location.pathname : null,
        }),
      });
      fullResponse = await consumeChatStream(res, assistantMsg.id);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        fullResponse = fullResponse || "Tive um problema ao apresentar o agente. Tenta de novo.";
      }
    }

    const { content: finalContent, thinkContent: finalThink } = splitThink(fullResponse);
    setMessages(prev =>
      prev.map(m =>
        m.id === assistantMsg.id
          ? { ...m, content: finalContent, thinkContent: finalThink, streaming: false }
          : m
      )
    );
    setIsStreaming(false);
    setStreamStatus("idle");
    abortRef.current = null;

    if (fullResponse && sessionId) {
      await saveMessages(sessionId, introText, fullResponse);
    }
  }, [activeProjectId, createSession, saveMessages, consumeChatStream]);

  /* ── Adicionar agente à conversa atual (sem reiniciar nem apresentar) ── */
  const adicionarAgenteNaConversa = useCallback((agent: OnyxAgent) => {
    // Ativa o agente; o useEffect de selectedAgent zera a sessão Onyx.
    // Mensagens atuais permanecem — a partir daqui as respostas vêm do agente.
    setSelectedAgent(agent);
    selectedAgentRef.current = agent;
    onyxSessionRef.current = null;
  }, []);

  /* ── Clique num agente fixado (sidebar) ──────────────────── */
  // Tela inicial (sem mensagens) → abre conversa nova vazia.
  // Dentro de um chat → adiciona/troca o agente na conversa atual.
  const handlePickFixado = useCallback((agentId: number) => {
    const ag = agentesCache.find(a => a.id === agentId);
    if (!ag) return;
    if (messages.length === 0) conversarVazio(ag);
    else adicionarAgenteNaConversa(ag);
  }, [agentesCache, messages.length, conversarVazio, adicionarAgenteNaConversa]);

  /* ── Stop ───────────────────────────────────────────────── */
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamStatus("idle");
    setMessages(prev =>
      prev.map(m => m.streaming ? { ...m, streaming: false } : m)
    );
  }, []);

  /* ── New session ────────────────────────────────────────── */
  const handleNewSession = useCallback((projectId?: string | null) => {
    setActiveSessionId(null);
    setMessages([]);
    setInputValue("");
    onyxSessionRef.current = null; // nova conversa = nova sessão no Onyx
    if (projectId !== undefined) setActiveProjectId(projectId);
  }, []);

  /* ── Delete session ─────────────────────────────────────── */
  const handleDeleteSession = useCallback(async (id: string) => {
    try {
      await fetch(`/api/bibble/sessions/${id}`, { method: "DELETE" });
    } catch { /* ignore */ }
    setSessions(prev => prev.filter(s => s.id !== id));
    if (id === activeSessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
  }, [activeSessionId]);

  /* ── Rename session ─────────────────────────────────────── */
  const handleRenameSession = useCallback(async (title: string) => {
    if (!activeSessionId) return;
    try {
      await fetch(`/api/bibble/sessions/${activeSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch { /* ignore */ }
    setSessions(prev =>
      prev.map(s => s.id === activeSessionId ? { ...s, title } : s)
    );
  }, [activeSessionId]);

  /* ── Rename de qualquer sessão (usado na sidebar) ───────── */
  const handleRenameSessionById = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      await fetch(`/api/bibble/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
    } catch { /* ignore */ }
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: trimmed } : s));
  }, []);

  /* ── Project callbacks ──────────────────────────────────── */
  const handleProjectCreate = useCallback(async (title: string, systemPrompt?: string): Promise<ProjectSummary | null> => {
    try {
      const res = await fetch("/api/bibble/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, systemPrompt }),
      });
      if (!res.ok) return null;
      return (await res.json()) as ProjectSummary;
    } catch { return null; }
  }, []);

  const handleProjectUpdate = useCallback(async (id: string, data: { title?: string; systemPrompt?: string | null }) => {
    try {
      await fetch(`/api/bibble/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch { /* ignore */ }
  }, []);

  const handleProjectDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/bibble/projects/${id}`, { method: "DELETE" });
    } catch { /* ignore */ }
    if (id === activeProjectId) setActiveProjectId(null);
    setSessions(prev => prev.map(s => s.projectId === id ? { ...s, projectId: null } : s));
  }, [activeProjectId]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background relative">
      <BibbleChatWindow
        sessionId={activeSessionId}
        sessionTitle={activeSession?.title ?? "Nova conversa"}
        messages={messages}
        userName={userName}
        model={model}
        streamStatus={streamStatus}
        inputValue={inputValue}
        isStreaming={isStreaming}
        onInputChange={setInputValue}
        onSend={handleSend}
        onStop={handleStop}
        onRenameSession={handleRenameSession}
        activeAgentName={selectedAgent?.name ?? null}
        activeAgentAvatarUrl={selectedAgent?.uploaded_image_id ? agentAvatarUrl(selectedAgent.id) : null}
        hasActiveAgent={!!selectedAgent}
        onClearAgent={() => setSelectedAgent(null)}
        isAdmin={isAdmin}
        imageGenAvailable={!!selectedAgent?.tools?.some(t => t.name === "generate_image")}
        uploadFiles={uploadFiles}
        onFilesChange={setUploadFiles}
        showFiles={showFiles}
        onToggleFiles={setShowFiles}
        onSelectFiles={handleAddFiles}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(p => !p)}
        tema={tema}
      />

      {/* Sidebar direita — desktop: inline com animação de largura */}
      <div
        className="hidden md:block shrink-0 h-full"
        style={{
          width: sidebarOpen ? "260px" : "0px",
          overflow: "hidden",
          pointerEvents: sidebarOpen ? "auto" : "none",
          transition: "width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div className="w-[260px] h-full">
          <BibbleSidebarPanel
            sessions={sessions}
            activeId={activeSessionId}
            activeProjectId={activeProjectId}
            model={model}
            onSelect={loadSession}
            onNew={handleNewSession}
            onDelete={handleDeleteSession}
            onRename={handleRenameSessionById}
            onModelChange={setModel}
            onProjectChange={setActiveProjectId}
            onProjectCreate={handleProjectCreate}
            onProjectUpdate={handleProjectUpdate}
            onProjectDelete={handleProjectDelete}
            isAdmin={isAdmin}
            onToggle={() => setSidebarOpen(false)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenAgents={() => setOnyxModalOpen(true)}
            activeAgentName={selectedAgent?.name ?? null}
            onClearAgent={() => setSelectedAgent(null)}
            fixados={fixadosSidebar}
            onPickFixado={handlePickFixado}
            activeAgentId={selectedAgent?.id ?? null}
          />
        </div>
      </div>

      {/* Sidebar mobile — overlay drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="md:hidden">
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              key="mobile-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="fixed right-0 top-0 bottom-0 z-50 w-[260px] bg-[#060c1a] border-l border-white/5"
            >
              <BibbleSidebarPanel
                sessions={sessions}
                activeId={activeSessionId}
                activeProjectId={activeProjectId}
                model={model}
                isAdmin={isAdmin}
                onSelect={loadSession}
                onNew={handleNewSession}
                onDelete={handleDeleteSession}
            onRename={handleRenameSessionById}
                onModelChange={setModel}
                onProjectChange={setActiveProjectId}
                onProjectCreate={handleProjectCreate}
                onProjectUpdate={handleProjectUpdate}
                onProjectDelete={handleProjectDelete}
                onToggle={() => setSidebarOpen(false)}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenAgents={() => setOnyxModalOpen(true)}
                activeAgentName={selectedAgent?.name ?? null}
                onClearAgent={() => setSelectedAgent(null)}
                fixados={fixadosSidebar}
                onPickFixado={handlePickFixado}
                activeAgentId={selectedAgent?.id ?? null}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BibbleSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isAdmin={isAdmin}
        temperature={temperature}
        onTemperatureChange={handleTemperatureChange}
        systemPrompt={globalSystemPrompt}
        onSystemPromptChange={handleSystemPromptChange}
        ollamaUrl={ollamaUrl}
        onOllamaUrlChange={handleOllamaUrlChange}
        contextWindow={contextWindow}
        onContextWindowChange={handleContextWindowChange}
        computerAccess={computerAccess}
        onComputerAccessChange={handleComputerAccessChange}
      />

      <OnyxAgentsModal
        open={onyxModalOpen}
        onClose={() => setOnyxModalOpen(false)}
        isAdmin={isAdmin}
        selectedAgentId={selectedAgent?.id ?? null}
        onConverse={conversarVazio}
        onQuemEhVoce={quemEhVoceAgente}
        onAddToConversation={adicionarAgenteNaConversa}
        fixadosIds={fixadosIds}
        onToggleFixar={handleToggleFixar}
      />
    </div>
  );
}
