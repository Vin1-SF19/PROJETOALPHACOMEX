"use client";

import { Archive, MessageSquare, Plus, Sparkles } from "lucide-react";

export interface SamSessionSummary {
  id: string;
  title: string;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface SamSessionRailProps {
  sessions: SamSessionSummary[];
  activeId: string;
  pending: boolean;
  onCreate: () => void;
  onOpen: (sessionId: string) => void;
  onArchive: (sessionId: string) => void;
  onDiscoverSkills: () => void;
}

export function SamSessionRail({ sessions, activeId, pending, onCreate, onOpen, onArchive, onDiscoverSkills }: SamSessionRailProps) {
  return <aside aria-label="Histórico do SAM" className="border-b border-white/5 bg-slate-950/35 p-3 lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
    <div className="flex gap-2 lg:flex-col">
      <button type="button" onClick={onCreate} disabled={pending} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[rgb(var(--seo-accent))] px-3 text-xs font-black text-slate-950"><Plus size={13}/>Nova conversa</button>
      <button type="button" onClick={onDiscoverSkills} disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold"><Sparkles size={13}/>Skills</button>
    </div>
    <div className="mt-3 flex gap-2 overflow-x-auto lg:max-h-[520px] lg:flex-col lg:overflow-y-auto">
      {sessions.filter((session) => session.status !== "ARCHIVED").map((session) => <div key={session.id} className={`flex min-w-56 items-center gap-1 rounded-xl border p-1 lg:min-w-0 ${activeId === session.id ? "border-[rgb(var(--seo-accent))] bg-white/[.06]" : "border-white/[.06] bg-white/[.025]"}`}><button type="button" onClick={() => onOpen(session.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left"><MessageSquare size={13} className="shrink-0 text-[rgb(var(--seo-accent))]"/><span className="min-w-0"><b className="block truncate text-xs text-white">{session.title}</b><small className="text-[10px] text-slate-500">{new Date(session.updatedAt).toLocaleDateString("pt-BR")}</small></span></button><button type="button" onClick={() => onArchive(session.id)} aria-label={`Arquivar ${session.title}`} className="grid size-11 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-white/[.06] hover:text-white"><Archive size={13}/></button></div>)}
      {sessions.filter((session) => session.status !== "ARCHIVED").length === 0 && <p className="p-3 text-xs text-slate-500">Nenhuma conversa ativa.</p>}
    </div>
  </aside>;
}
