"use client";

import { useRef, useState, useTransition } from "react";
import { Bot, Send, Square } from "lucide-react";
import {
  AprovarCustoAlphaSeoSam,
  ArquivarSessaoAlphaSeoSam,
  CancelarSessaoAlphaSeoSam,
  CriarSessaoAlphaSeoSam,
  DescobrirSkillsAlphaSeoSam,
  EstimarCustoAlphaSeoSam,
  ObterSessaoAlphaSeoSam,
} from "@/actions/AlphaSeoSam";
import { SeoCard, StatePanel } from "../shared/PageHeader";
import { SamSessionRail, type SamSessionSummary } from "./SamSessionRail";

type Message = { role: "user" | "assistant" | "tool"; text: string };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseMessages(value: unknown): Message[] {
  const source = record(value)?.messages;
  if (!Array.isArray(source)) return [];
  return source.flatMap((item) => {
    const row = record(item);
    if (!row || typeof row.content !== "string" || typeof row.role !== "string") return [];
    const role = row.role === "USER" ? "user" : row.role === "TOOL" ? "tool" : "assistant";
    return [{ role, text: row.content } satisfies Message];
  });
}

export function SamWorkspace({ projectId, initialSessions, initialSessionId }: { projectId: string; initialSessions: SamSessionSummary[]; initialSessionId?: string }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [sessionId, setSessionId] = useState(initialSessionId ?? initialSessions.find((session) => session.status === "ACTIVE")?.id ?? "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [prepared, setPrepared] = useState<{ message: string; micros: number } | null>(null);
  const [skills, setSkills] = useState<unknown>(null);
  const [pending, start] = useTransition();
  const abort = useRef<AbortController | null>(null);

  function newSession() {
    start(async () => {
      const result = await CriarSessaoAlphaSeoSam(projectId);
      if (!result.success || !result.data) return setStatus(result.error ?? "Falha ao criar sessão");
      const row = record(result.data);
      if (!row || typeof row.id !== "string") return setStatus("Sessão inválida.");
      const session: SamSessionSummary = { id: row.id, title: String(row.title ?? "Nova conversa"), status: String(row.status ?? "ACTIVE"), createdAt: String(row.createdAt ?? new Date().toISOString()), updatedAt: new Date().toISOString() };
      setSessions((rows) => [session, ...rows]);
      setSessionId(session.id);
      setMessages([]);
      setStatus("Nova sessão criada.");
    });
  }

  function openSession(id: string) {
    start(async () => {
      const result = await ObterSessaoAlphaSeoSam({ projectId, sessionId: id });
      if (!result.success) return setStatus(result.error ?? "Falha ao carregar sessão");
      setSessionId(id);
      setMessages(parseMessages(result.data));
      setStatus("Conversa carregada.");
    });
  }

  function archiveSession(id: string) {
    start(async () => {
      const result = await ArquivarSessaoAlphaSeoSam({ projectId, sessionId: id });
      if (!result.success) return setStatus(result.error ?? "Falha ao arquivar sessão");
      setSessions((rows) => rows.map((row) => row.id === id ? { ...row, status: "ARCHIVED" } : row));
      if (sessionId === id) {
        setSessionId("");
        setMessages([]);
      }
      setStatus("Conversa arquivada.");
    });
  }

  function discoverSkills() {
    start(async () => {
      const result = await DescobrirSkillsAlphaSeoSam();
      setSkills(result.data);
      setStatus("Catálogo de skills atualizado.");
    });
  }

  function estimate() {
    const message = input.trim();
    if (!message || !sessionId) return;
    start(async () => {
      const result = await EstimarCustoAlphaSeoSam({ projectId, message });
      if (!result.success || !result.data) return setStatus(result.error ?? "Falha ao estimar custo");
      setPrepared({ message, micros: result.data.estimatedMicrosUsd });
      setStatus("Confirme o custo estimado antes de enviar.");
    });
  }

  function approveAndSend() {
    if (!prepared) return;
    const message = prepared.message;
    setPrepared(null);
    setInput("");
    setMessages((rows) => [...rows, { role: "user", text: message }]);
    start(async () => {
      const approval = await AprovarCustoAlphaSeoSam({ projectId, message });
      if (!approval.success) return setStatus(approval.error ?? "Falha ao aprovar custo");
      await streamTurn(message);
    });
  }

  async function streamTurn(message: string) {
    const controller = new AbortController();
    abort.current = controller;
    setStreaming(true);
    setStatus("SAM está analisando…");
    try {
      const response = await fetch("/api/alpha-seo/sam/stream", { method: "POST", headers: { "content-type": "application/json", accept: "text/event-stream" }, body: JSON.stringify({ projectId, sessionId, message }), signal: controller.signal });
      if (!response.ok || !response.body) return setStatus("Não foi possível iniciar o stream.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) handleEvent(event);
      }
      setStatus("Pronto.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setStatus("Execução cancelada.");
      else setStatus("O stream foi interrompido. O transcript foi preservado.");
    } finally {
      setStreaming(false);
      abort.current = null;
    }
  }

  function handleEvent(event: string) {
    const type = /event: ([^\n]+)/.exec(event)?.[1];
    const raw = /data: (.+)/.exec(event)?.[1];
    if (!raw) return;
    const data = JSON.parse(raw) as { text?: string; name?: string; error?: string };
    if (type === "message" && data.text) setMessages((rows) => [...rows, { role: "assistant", text: data.text ?? "" }]);
    if (type === "tool_start") setMessages((rows) => [...rows, { role: "tool", text: `Executando ${data.name ?? "ferramenta"}…` }]);
    if (type === "error") setStatus(data.error ?? "Falha no SAM");
  }

  function cancel() {
    abort.current?.abort();
    start(async () => {
      if (sessionId) await CancelarSessaoAlphaSeoSam({ projectId, sessionId });
      setStreaming(false);
    });
  }

  return <SeoCard className="flex min-h-[650px] flex-col overflow-hidden lg:flex-row"><SamSessionRail sessions={sessions} activeId={sessionId} pending={pending} onCreate={newSession} onOpen={openSession} onArchive={archiveSession} onDiscoverSkills={discoverSkills}/><div className="flex min-w-0 flex-1 flex-col"><div className="flex items-center gap-2 border-b border-white/5 px-4 py-3"><Bot size={17} className="text-[rgb(var(--seo-accent))]"/><b className="text-sm text-white">SAM · {sessionId ? "sessão ativa" : "selecione uma sessão"}</b></div>{skills != null && <details className="border-b border-white/5 p-3"><summary className="cursor-pointer text-xs font-bold text-slate-300">Skills disponíveis</summary><pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-slate-500">{JSON.stringify(skills, null, 2)}</pre></details>}<div className="flex-1 space-y-3 overflow-y-auto p-4">{!sessionId ? <StatePanel title="Selecione ou crie uma conversa" description="Sessões, mensagens e arquivamento ficam isolados por usuário e projeto."/> : messages.length === 0 ? <div className="mx-auto max-w-xl py-20 text-center"><Bot className="mx-auto text-[rgb(var(--seo-accent))]"/><h2 className="mt-4 font-bold text-white">Por onde começamos?</h2><p className="mt-2 text-sm text-slate-500">Peça uma análise, plano de keywords, leitura de páginas ou quick wins.</p></div> : messages.map((message, index) => <div key={index} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "ml-auto bg-[rgb(var(--seo-accent))] text-slate-950" : message.role === "tool" ? "border border-white/5 bg-white/[.025] text-xs text-slate-500" : "bg-white/[.06] text-slate-200"}`}>{message.text}</div>)}</div><div className="border-t border-white/5 p-4">{prepared && <div className="mb-3 flex items-center justify-between rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100"><span>Custo máximo: US$ {(prepared.micros / 1_000_000).toFixed(4)}</span><button type="button" onClick={approveAndSend} className="min-h-11 rounded-lg bg-amber-300 px-3 font-black text-amber-950">Aprovar e enviar</button></div>}<textarea value={input} onChange={(event) => { setInput(event.target.value); setPrepared(null); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); estimate(); } }} rows={3} placeholder="Pergunte ao SAM…" className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm outline-none focus:border-[rgb(var(--seo-accent))]"/><div className="mt-2 flex items-center justify-between"><span role="status" className="text-[10px] text-slate-500">{status}</span>{streaming ? <button type="button" onClick={cancel} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-400/20 px-4 text-xs font-bold text-rose-300"><Square size={12}/>Cancelar</button> : <button type="button" onClick={estimate} disabled={!sessionId || !input.trim() || pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[rgb(var(--seo-accent))] px-4 text-xs font-black text-slate-950 disabled:opacity-40"><Send size={13}/>Estimar</button>}</div></div></div></SeoCard>;
}

export function SamStart({ projectId, initialSessions }: { projectId: string; initialSessions: SamSessionSummary[] }) {
  return <SamWorkspace projectId={projectId} initialSessions={initialSessions}/>;
}
