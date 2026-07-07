"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Plus, Trash2, MessageSquare, FolderOpen,
  ChevronDown, Search, Check, Pencil, X,
  ChevronRight, FileText, AlertTriangle, Settings, Bot, Pin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { agentAvatarUrl } from "@/lib/onyx/browser";
import { type TemaAlpha } from "@/lib/temas";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  title: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  systemPrompt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { sessions: number };
}

interface BibbleSidebarPanelProps {
  sessions: SessionSummary[];
  activeId: string | null;
  activeProjectId: string | null;
  model: string;
  isAdmin: boolean;
  onSelect: (id: string) => void;
  onNew: (projectId?: string | null) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onModelChange: (model: string) => void;
  onProjectChange: (id: string | null) => void;
  onProjectCreate: (title: string, systemPrompt?: string) => Promise<ProjectSummary | null>;
  onProjectUpdate: (id: string, data: { title?: string; systemPrompt?: string | null }) => Promise<void>;
  onProjectDelete: (id: string) => Promise<void>;
  onToggle: () => void;
  onOpenSettings: () => void;
  onOpenAgents: () => void;
  activeAgentName?: string | null;
  onClearAgent?: () => void;
  /** Agentes fixados (até 3) — exibidos abaixo do botão Agentes */
  fixados?: { id: number; name: string; hasImage: boolean }[];
  /** Clicou num agente fixado — pai decide se abre conversa nova ou adiciona à atual */
  onPickFixado?: (id: number) => void;
  /** id do agente ativo na conversa (destaca o fixado correspondente) */
  activeAgentId?: number | null;
  /** tema do usuário — colore botões/destaques na cor do esquema escolhido */
  tema?: TemaAlpha;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

interface DateGroup { label: string; sessions: SessionSummary[]; }

function formatDayLabel(date: Date): string {
  const raw = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  }).format(date);
  // "sexta-feira, 12 de junho de 2026" → "Sexta-feira, 12 de junho"
  return raw.replace(/ de \d{4}$/, "").replace(/^(.)/, c => c.toUpperCase());
}

function groupByDate(sessions: SessionSummary[]): DateGroup[] {
  const now        = new Date();
  const todayStr   = now.toDateString();
  const yesterStr  = new Date(now.getTime() - 86_400_000).toDateString();
  const lastMonth  = new Date(now.getTime() - 30 * 86_400_000);

  const todayBucket:     SessionSummary[]                                = [];
  const yesterdayBucket: SessionSummary[]                                = [];
  const byDay            = new Map<string, { date: Date; sessions: SessionSummary[] }>();
  const monthBucket:     SessionSummary[]                                = [];
  const olderBucket:     SessionSummary[]                                = [];

  for (const s of sessions) {
    const d  = new Date(s.updatedAt);
    const ds = d.toDateString();
    if (ds === todayStr) {
      todayBucket.push(s);
    } else if (ds === yesterStr) {
      yesterdayBucket.push(s);
    } else {
      const daysAgo = (now.getTime() - d.getTime()) / 86_400_000;
      if (daysAgo <= 6) {
        if (!byDay.has(ds)) byDay.set(ds, { date: d, sessions: [] });
        byDay.get(ds)!.sessions.push(s);
      } else if (d >= lastMonth) {
        monthBucket.push(s);
      } else {
        olderBucket.push(s);
      }
    }
  }

  const result: DateGroup[] = [];
  if (todayBucket.length)     result.push({ label: "Hoje",            sessions: todayBucket });
  if (yesterdayBucket.length) result.push({ label: "Ontem",           sessions: yesterdayBucket });

  const sortedDays = [...byDay.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
  for (const { date, sessions: s } of sortedDays) {
    result.push({ label: formatDayLabel(date), sessions: s });
  }

  if (monthBucket.length) result.push({ label: "Últimos 30 dias", sessions: monthBucket });
  if (olderBucket.length) result.push({ label: "Mais antigas",    sessions: olderBucket });

  return result;
}

// ─── Model dropdown ───────────────────────────────────────────────────────────

const ONYX_ICON = (
  <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3">
    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M7 4v3l2 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface OllamaModelPublic {
  id: string;
  label: string;
  paramSize: string | null;
  family: string | null;
}

function ModelDropdown({
  model,
  open,
  onClose,
  onSelect,
}: {
  model: string;
  open: boolean;
  onClose: () => void;
  onSelect: (m: string) => void;
}) {
  const [ollamaModels, setOllamaModels] = useState<OllamaModelPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch("/api/bibble/models")
      .then(res => res.json())
      .then((data: { models: OllamaModelPublic[]; error?: string }) => {
        setOllamaModels(data.models ?? []);
        if (data.error) setError(data.error);
      })
      .catch(() => setError("Não foi possível carregar os modelos do Ollama."))
      .finally(() => setLoading(false));
  }, [open]);

  const handleSelect = (m: OllamaModelPublic) => {
    onSelect(m.id);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute bottom-full left-3 right-3 mb-2 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 z-50"
        style={{ background: "#080f1e", border: "1px solid rgba(30,45,74,0.9)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: "1px solid rgba(30,45,74,0.6)" }}>
          <span style={{ color: "#6366f1" }}>{ONYX_ICON}</span>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] flex-1" style={{ color: "#475569" }}>
            Modelo
          </span>
        </div>

        <div className="overflow-y-auto custom-scrollbar max-h-[300px] p-1.5 space-y-0.5">
          {loading && (
            <div className="space-y-1 px-2 py-1">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-9 rounded-xl animate-pulse" style={{ background: "rgba(30,45,74,0.4)" }} />
              ))}
            </div>
          )}

          {error && (
            <div className="mx-2 my-1 px-3 py-2 rounded-lg flex items-center gap-2"
              style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)" }}>
              <AlertTriangle size={12} style={{ color: "#f87171", flexShrink: 0 }} />
              <span className="text-[10px]" style={{ color: "#fca5a5" }}>{error}</span>
            </div>
          )}

          {!loading && !error && ollamaModels.length === 0 && (
            <div className="px-3 py-4 text-[10px] text-center" style={{ color: "#334155" }}>
              Nenhum modelo encontrado no Ollama.
            </div>
          )}

          {!loading && ollamaModels.map(m => {
            const isActive = m.id === model;
            return (
              <button
                key={m.id}
                onClick={() => handleSelect(m)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] transition-all text-left"
                style={{
                  color: isActive ? "#f1f5f9" : "#64748b",
                  background: isActive ? "rgba(99,102,241,0.12)" : "transparent",
                  cursor: "pointer",
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "rgba(30,45,74,0.5)"; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <Check
                  size={10}
                  className="shrink-0"
                  style={{ color: "#6366f1", opacity: isActive ? 1 : 0 }}
                />
                <span className="font-medium flex-1 truncate">{m.label}</span>
                {isActive && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-md shrink-0" style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>
                    ativo
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── ProjectEditor (inline create/edit) ──────────────────────────────────────

function ProjectEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: { title: string; systemPrompt?: string | null };
  onSave: (title: string, systemPrompt: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [prompt, setPrompt] = useState(initial?.systemPrompt ?? "");
  const [showPrompt, setShowPrompt] = useState(!!(initial?.systemPrompt));

  return (
    <div className="space-y-2 px-1 py-1">
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Nome do projeto"
        className="w-full rounded-lg px-2.5 py-1.5 text-[11px] outline-none"
        style={{ background: "rgba(30,45,74,0.5)", border: "1px solid #1e2d4a", color: "#cbd5e1" }}
      />
      <button
        onClick={() => setShowPrompt(p => !p)}
        className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider transition-colors"
        style={{ color: "#475569" }}
      >
        <FileText size={9} />
        {showPrompt ? "Ocultar system prompt" : "Adicionar system prompt"}
      </button>
      {showPrompt && (
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Instrução personalizada para este projeto..."
          rows={3}
          className="w-full rounded-lg px-2.5 py-1.5 text-[10px] outline-none resize-none"
          style={{ background: "rgba(20,35,60,0.5)", border: "1px solid #1e2d4a", color: "#cbd5e1" }}
        />
      )}
      <div className="flex gap-1.5 justify-end">
        <button
          onClick={onCancel}
          className="px-2.5 py-1 rounded-lg text-[10px] transition-colors"
          style={{ color: "#475569" }}
        >
          Cancelar
        </button>
        <button
          onClick={() => title.trim() && onSave(title.trim(), prompt.trim())}
          disabled={!title.trim()}
          className="px-2.5 py-1 rounded-lg bg-alpha-glow border border-alpha text-alpha text-[10px] font-black hover:bg-alpha/20 transition-colors disabled:opacity-30"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type SidebarTab = "chat" | "projetos";

export default function BibbleSidebarPanel({
  sessions,
  activeId,
  activeProjectId,
  model,
  isAdmin,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onModelChange,
  onProjectChange,
  onProjectCreate,
  onProjectUpdate,
  onProjectDelete,
  onToggle,
  onOpenSettings,
  onOpenAgents,
  activeAgentName,
  onClearAgent,
  fixados = [],
  onPickFixado,
  activeAgentId,
  tema,
}: BibbleSidebarPanelProps) {
  // Cor do tema (string "R, G, B"); fallback no indigo original.
  const ac = tema?.accent ?? "99, 102, 241";
  const [tab, setTab]                   = useState<SidebarTab>("chat");
  const [search, setSearch]             = useState("");
  const [modelOpen, setModelOpen]       = useState(false);
  const [projects, setProjects]         = useState<ProjectSummary[] | null>(null);
  const [creating, setCreating]         = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);

  // Renomear conversa inline + confirmação de exclusão
  const [renamingId, setRenamingId]     = useState<string | null>(null);
  const [renameValue, setRenameValue]   = useState("");
  const [confirmDelete, setConfirmDelete] = useState<SessionSummary | null>(null);

  const startRename = (s: SessionSummary) => {
    setRenamingId(s.id);
    setRenameValue(s.title);
  };
  const commitRename = () => {
    if (renamingId && renameValue.trim()) onRename(renamingId, renameValue.trim());
    setRenamingId(null);
  };

  // null = not yet loaded / loading; [] = loaded empty
  useEffect(() => {
    if (tab !== "projetos") return;
    setProjects(null); // eslint-disable-line react-hooks/set-state-in-effect
    let active = true;
    fetch("/api/bibble/projects")
      .then(r => r.json() as Promise<ProjectSummary[]>)
      .then(data => { if (active) setProjects(data); })
      .catch(() => { if (active) setProjects([]); });
    return () => { active = false; };
  }, [tab]);

  const filteredSessions = useMemo(() => {
    let list = sessions;
    if (activeProjectId) list = list.filter(s => s.projectId === activeProjectId);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(s => s.title.toLowerCase().includes(q));
  }, [sessions, activeProjectId, search]);

  const groups = useMemo(() => groupByDate(filteredSessions), [filteredSessions]);
  const hasAny = groups.length > 0;

  const activeProjectTitle = activeProjectId
    ? (projects ?? []).find(p => p.id === activeProjectId)?.title
    : null;

  // ── Project actions ──
  const handleProjectSave = async (title: string, systemPrompt: string) => {
    const result = await onProjectCreate(title, systemPrompt);
    if (result) {
      setProjects(prev => [result, ...(prev ?? [])]);
    }
    setCreating(false);
  };

  const handleProjectEdit = async (id: string, title: string, systemPrompt: string) => {
    await onProjectUpdate(id, { title, systemPrompt: systemPrompt || null });
    setProjects(prev => (prev ?? []).map(p => p.id === id ? { ...p, title, systemPrompt: systemPrompt || null } : p));
    setEditingId(null);
  };

  const handleProjectDelete = async (id: string) => {
    await onProjectDelete(id);
    setProjects(prev => (prev ?? []).filter(p => p.id !== id));
  };

  const openProjectSessions = (id: string) => {
    onProjectChange(id);
    setTab("chat");
  };

  return (
    <aside className="w-[260px] shrink-0 flex flex-col h-full border-l relative" style={{ borderColor: "#1e2d4a", background: "#0d1526" }}>

      {/* ── Brand ─────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[#1e2d4a]">
        <div className="flex items-center justify-between">
          <Image
            src="/Logo_Principal.png"
            alt="Logo"
            width={110}
            height={36}
            className="object-contain"
            priority
          />
          <div className="flex items-center gap-1">
            {/* Botão de configurações */}
            <button
              onClick={onOpenSettings}
              className="w-7 h-7 grid place-items-center rounded-lg transition-colors duration-150 hover:bg-[#1e2d4a]"
              title="Configurações"
              style={{ color: "#4f6272" }}
            >
              <Settings size={15} />
            </button>
            {/* Botão para recolher sidebar — acionado pelo pai via onToggle */}
            <button
              onClick={onToggle}
              className="w-7 h-7 grid place-items-center rounded-lg transition-colors duration-150 hover:bg-[#1e2d4a]"
              title="Recolher menu"
              style={{ color: "#4f6272" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 pt-3 pb-2.5">
        <div className="flex bg-[rgba(15,23,42,0.8)] rounded-[12px] p-[3px] gap-[3px]">
          {(["chat", "projetos"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-[7px] rounded-[9px]",
                "text-[11px] font-black uppercase tracking-wider transition-all duration-150",
                tab === t
                  ? "bg-[#0f172a] text-[#a5b4fc]"
                  : "text-[#6b7fa0] hover:text-[#a5b4fc]",
              )}
            >
              {t === "chat"
                ? <MessageSquare size={11} strokeWidth={2.5} />
                : <FolderOpen size={11} strokeWidth={2.5} />
              }
              {t === "chat" ? "Chat" : "Projetos"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Botão Agentes (Onyx) ──────────────────────────────── */}
      <div className="shrink-0 px-3 pb-2.5 space-y-1.5">
        <button
          onClick={onOpenAgents}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
          style={{
            background: `linear-gradient(135deg, rgba(${ac},0.22) 0%, rgba(${ac},0.14) 100%)`,
            border: `1px solid rgba(${ac},0.4)`,
            color: `rgba(${ac},1)`,
            boxShadow: `0 2px 12px rgba(${ac},0.15)`,
          }}
        >
          <Bot size={14} strokeWidth={2.5} />
          Agentes
        </button>

        {activeAgentName && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
            style={{ background: `rgba(${ac},0.12)`, border: `1px solid rgba(${ac},0.3)` }}
          >
            <Bot size={11} className="shrink-0" style={{ color: `rgba(${ac},1)` }} />
            <span className="flex-1 text-[10.5px] font-bold truncate" style={{ color: `rgba(${ac},1)` }}>{activeAgentName}</span>
            {onClearAgent && (
              <button onClick={onClearAgent} title="Voltar ao Bibble padrão" className="shrink-0 opacity-70 hover:opacity-100 transition-opacity" style={{ color: `rgba(${ac},1)` }}>
                <X size={11} strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}

        {/* ── Agentes fixados (até 3) ─────────────────────────── */}
        {fixados.length > 0 && (
          <div className="pt-1">
            <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1 mb-1.5" style={{ color: "#fbbf24" }}>
              <Pin size={9} fill="#fbbf24" /> Seus agentes fixados
            </p>
            <div className="space-y-1">
              {fixados.slice(0, 3).map(fx => {
                const ativo = activeAgentId === fx.id;
                return (
                  <button
                    key={fx.id}
                    onClick={() => onPickFixado?.(fx.id)}
                    title={ativo ? `${fx.name} (ativo)` : `Usar ${fx.name}`}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all active:scale-[0.98]"
                    style={{
                      background: ativo ? "rgba(245,158,11,0.16)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${ativo ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.07)"}`,
                    }}
                  >
                    <div className="w-6 h-6 rounded-lg grid place-items-center shrink-0 overflow-hidden relative" style={{ background: "rgba(245,158,11,0.15)" }}>
                      {fx.hasImage ? (
                        <Image src={agentAvatarUrl(fx.id)} alt={fx.name} fill unoptimized className="object-cover" />
                      ) : (
                        <Bot size={12} style={{ color: "#fbbf24" }} />
                      )}
                    </div>
                    <span className="flex-1 text-[11px] font-bold truncate text-left" style={{ color: ativo ? "#fcd34d" : "#cbd5e1" }}>{fx.name}</span>
                    {ativo && <Check size={11} strokeWidth={3} style={{ color: "#fbbf24" }} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Tab content ───────────────────────────────────────── */}
      {tab === "chat" ? (
        <>
          <div className="shrink-0 px-3 pb-2 space-y-2">
            {/* Active project filter chip */}
            {activeProjectId && activeProjectTitle && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-alpha-glow border border-alpha/30">
                <FolderOpen size={10} className="text-alpha shrink-0" />
                <span className="text-[10px] text-alpha font-bold truncate flex-1">{activeProjectTitle}</span>
                <button
                  onClick={() => onProjectChange(null)}
                  className="text-alpha/60 hover:text-alpha transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            )}

            <button
              onClick={() => onNew(activeProjectId)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-widest active:scale-[0.98] transition-all hover:brightness-125"
              style={{ background: `rgba(${ac},0.2)`, border: `1px solid rgba(${ac},0.35)`, color: `rgba(${ac},1)` }}
            >
              <Plus size={12} strokeWidth={2.5} />
              Nova conversa
            </button>
            <div className="relative">
              <Search size={11} className="absolute left-3 top-[9px] pointer-events-none" style={{ color: "#334155" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar conversas..."
                className="w-full rounded-xl pl-8 pr-3 py-2 text-[11px] outline-none transition-colors"
                style={{ background: "rgba(30,45,74,0.4)", border: "1px solid #1e2d4a", color: "#cbd5e1" }}
              />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
            {hasAny ? (
              groups.map(({ label, sessions: items }) => {
                if (!items.length) return null;
                return (
                  <div key={label} className="mb-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] px-2 py-1.5" style={{ color: "#5a7090" }}>
                      {label}
                    </p>
                    <div className="space-y-0.5">
                      {items.map(s => (
                        <div
                          key={s.id}
                          onClick={() => { if (renamingId !== s.id) onSelect(s.id); }}
                          className={cn(
                            "group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 select-none relative",
                            s.id !== activeId && "hover:bg-[rgba(30,45,74,0.6)]",
                          )}
                          style={s.id === activeId ? { background: `rgba(${ac},0.12)` } : undefined}
                        >
                          {s.id === activeId && (
                            <div
                              className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r"
                              style={{ background: `rgba(${ac},1)` }}
                            />
                          )}
                          {s.id === activeId
                            ? <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `rgba(${ac},1)` }} />
                            : <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `rgba(${ac},0.2)` }} />
                          }

                          {renamingId === s.id ? (
                            <input
                              autoFocus
                              value={renameValue}
                              onClick={e => e.stopPropagation()}
                              onChange={e => setRenameValue(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={e => {
                                if (e.key === "Enter") commitRename();
                                else if (e.key === "Escape") setRenamingId(null);
                              }}
                              className="flex-1 min-w-0 text-[12.5px] font-medium leading-tight rounded-md px-1.5 py-0.5 outline-none"
                              style={{ background: "rgba(15,23,42,0.9)", border: `1px solid rgba(${ac},0.5)`, color: "#f1f5f9" }}
                            />
                          ) : (
                            <span
                              className="flex-1 text-[12.5px] font-medium truncate leading-tight"
                              style={{ color: s.id === activeId ? "#f1f5f9" : "#8fa3bc" }}
                            >
                              {s.title}
                            </span>
                          )}

                          {renamingId !== s.id && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={e => { e.stopPropagation(); startRename(s); }}
                                className="p-1 rounded-lg transition-all hover:text-[#a5b4fc]"
                                style={{ color: "#5a7090" }}
                                title="Renomear"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setConfirmDelete(s); }}
                                className="p-1 rounded-lg transition-all hover:text-red-400"
                                style={{ color: "#5a7090" }}
                                title="Excluir"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-36 gap-2.5">
                <MessageSquare size={18} style={{ color: "#1e2d4a" }} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-center leading-relaxed" style={{ color: "#2d3f5a" }}>
                  {search ? "Nenhum resultado" : activeProjectId ? "Sem conversas neste projeto" : "Sem conversas ainda"}
                </p>
              </div>
            )}
          </nav>
        </>
      ) : (
        /* ── Projetos tab ─────────────────────────────────────── */
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="shrink-0 px-3 pb-2">
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-alpha-glow border border-alpha/30 text-alpha text-[10px] font-black uppercase tracking-widest hover:bg-alpha/20 active:scale-[0.98] transition-all"
            >
              <Plus size={11} strokeWidth={2.5} />
              Novo projeto
            </button>
          </div>

          {creating && (
            <div className="shrink-0 mx-3 mb-2 p-2 rounded-xl" style={{ background: "#0a1020", border: "1px solid #1e2d4a" }}>
              <ProjectEditor
                onSave={handleProjectSave}
                onCancel={() => setCreating(false)}
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
            {projects === null ? (
              <div className="space-y-2 px-2 pt-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "rgba(30,45,74,0.4)" }} />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-36 gap-2.5">
                <FolderOpen size={18} style={{ color: "#1e2d4a" }} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-center leading-relaxed" style={{ color: "#2d3f5a" }}>
                  Nenhum projeto ainda
                </p>
              </div>
            ) : (
              <div className="space-y-1 pt-1">
                {projects.map(p => (
                  <div
                    key={p.id}
                    className={cn(
                      "rounded-xl border transition-all duration-150",
                      activeProjectId === p.id
                        ? "bg-alpha-glow border-alpha/30"
                        : "border-transparent",
                    )}
                  >
                    {editingId === p.id ? (
                      <div className="p-2">
                        <ProjectEditor
                          initial={{ title: p.title, systemPrompt: p.systemPrompt }}
                          onSave={(title, sp) => handleProjectEdit(p.id, title, sp)}
                          onCancel={() => setEditingId(null)}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2.5 group">
                        <FolderOpen
                          size={12}
                          className="shrink-0"
                          style={{ color: activeProjectId === p.id ? undefined : "#334155" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-[11px] font-semibold truncate leading-tight"
                            style={{ color: activeProjectId === p.id ? undefined : "#94a3b8" }}
                          >
                            {p.title}
                          </p>
                          <p className="text-[9px] font-medium" style={{ color: "#334155" }}>
                            {p._count.sessions} conversa{p._count.sessions !== 1 ? "s" : ""}
                            {p.systemPrompt && " · prompt"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openProjectSessions(p.id)}
                            title="Ver conversas"
                            className="p-1 rounded-lg transition-colors"
                            style={{ color: "#334155" }}
                          >
                            <ChevronRight size={10} />
                          </button>
                          <button
                            onClick={() => setEditingId(p.id)}
                            title="Editar"
                            className="p-1 rounded-lg transition-colors"
                            style={{ color: "#334155" }}
                          >
                            <Pencil size={10} />
                          </button>
                          <button
                            onClick={() => handleProjectDelete(p.id)}
                            title="Excluir"
                            className="p-1 rounded-lg transition-colors"
                            style={{ color: "#334155" }}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Model selector footer (somente admin) ─────────────── */}
      {isAdmin && (
        <div className="shrink-0 px-3 py-3 relative" style={{ borderTop: "1px solid #1e2d4a" }}>
          <ModelDropdown
            model={model}
            open={modelOpen}
            onClose={() => setModelOpen(false)}
            onSelect={onModelChange}
          />

          <button
            onClick={() => setModelOpen(p => !p)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-150"
            style={{
              background: modelOpen ? "rgba(30,45,74,0.8)" : "rgba(30,45,74,0.3)",
              borderColor: modelOpen ? "#1e2d4a" : "rgba(30,45,74,0.5)",
              color: modelOpen ? "#cbd5e1" : "#64748b",
            }}
          >
            <span style={{ color: "#6366f1" }} className="shrink-0">
              {ONYX_ICON}
            </span>
            <span className="flex-1 text-[11px] font-medium truncate text-left">
              {model || "Modelo"}
            </span>
            <ChevronDown
              size={11}
              className={cn("shrink-0 transition-transform duration-150", modelOpen && "rotate-180")}
            />
          </button>
        </div>
      )}

      {/* ── Modal de confirmação de exclusão ──────────────────── */}
      {confirmDelete && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full rounded-2xl p-4"
            style={{ background: "#0a1020", border: "1px solid rgba(239,68,68,0.3)", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ background: "rgba(239,68,68,0.12)" }}>
                <Trash2 size={15} style={{ color: "#f87171" }} />
              </div>
              <div className="min-w-0">
                <h4 className="text-[13px] font-bold" style={{ color: "#f1f5f9" }}>Apagar conversa?</h4>
                <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "#8fa3bc" }}>
                  &quot;{confirmDelete.title}&quot; será removida permanentemente. Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                style={{ color: "#94a3b8", background: "rgba(30,45,74,0.5)" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-black transition-all active:scale-[0.97]"
                style={{ background: "#dc2626", color: "#fff", boxShadow: "0 2px 10px rgba(220,38,38,0.4)" }}
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
