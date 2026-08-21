"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, Bot, BrainCircuit, ChevronLeft, FileSearch, FolderKanban,
  Gauge, KeyRound, Link2, Menu, Radar, Search, Settings2, Sparkles,
  Tags, X,
} from "lucide-react";
import { FlowButton } from "@/components/ui/flow-button";

const NAV = [
  ["dashboard", "Visão geral", Gauge], ["keywords", "Keywords", Search],
  ["saved", "Salvas", Tags], ["rank", "Rank Tracking", Radar],
  ["domain", "Domínio", BarChart3], ["backlinks", "Backlinks", Link2],
  ["audit", "Site Audit", FileSearch], ["search-performance", "Search Console", Gauge],
  ["brand-lookup", "Brand Lookup", Sparkles], ["prompt-explorer", "Prompt Explorer", BrainCircuit],
  ["sam", "SAM", Bot], ["settings", "Configurações", Settings2],
] as const;

export function AlphaSeoShell({ children, accent, projectId, projectName, projects = [] }: {
  children: React.ReactNode; accent: string; projectId?: string; projectName?: string; projects?: Array<{ id: string; name: string }>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (projectId) window.localStorage.setItem("alpha-seo:last-project-id", projectId); }, [projectId]);
  const base = projectId ? `/PainelAlpha/AlphaSEO/${projectId}` : "/PainelAlpha/AlphaSEO";
  const content = (
    <>
      <div className="border-b border-white/5 p-5">
        <div className="flex items-center justify-between gap-2">
          <Link href="/PainelAlpha/AlphaSEO" className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: `rgba(${accent},.18)`, color: `rgb(${accent})` }}><Radar size={18} /></span>
            <span className="min-w-0"><b className="block text-sm uppercase tracking-tight text-white">Alpha SEO</b><small className="block truncate text-[10px] text-slate-500">{projectName ?? "Inteligência orgânica"}</small></span>
          </Link>
          <button className="rounded-lg p-2 text-slate-400 md:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={17} /></button>
        </div>
        {projectId && projects.length > 0 && <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Projeto<select aria-label="Trocar projeto Alpha SEO" value={projectId} onChange={(event) => { const nextId = event.target.value; window.localStorage.setItem("alpha-seo:last-project-id", nextId); setOpen(false); router.push(`/PainelAlpha/AlphaSEO/${nextId}/dashboard`); }} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-xs normal-case text-white outline-none">{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {projectId ? NAV.map(([segment, label, Icon]) => {
          const href = `${base}/${segment}`;
          return <FlowButton key={segment} href={href} label={label} icon={Icon} accent={accent} active={pathname === href || pathname.startsWith(`${href}/`)} onClick={() => setOpen(false)} />;
        }) : <FlowButton href={base} label="Projetos" icon={FolderKanban} accent={accent} active />}
      </nav>
      <div className="border-t border-white/5 p-3">
        {projectId && <FlowButton href="/PainelAlpha/AlphaSEO" label="Trocar projeto" icon={ChevronLeft} accent={accent} />}
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/5 bg-white/[.025] px-3 py-2 text-[10px] text-slate-500"><KeyRound size={12} /> Provedores protegidos no servidor</div>
      </div>
    </>
  );
  return (
    <div className="relative flex min-h-screen bg-[#020617] text-slate-100" style={{ ["--seo-accent" as string]: accent }}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(var(--seo-accent),.12),transparent_34%),radial-gradient(circle_at_90%_85%,rgba(var(--seo-accent),.06),transparent_30%)]" />
      {open && <button className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} aria-label="Fechar navegação" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/5 bg-slate-950/85 backdrop-blur-xl transition-transform md:sticky md:top-0 md:h-screen md:w-56 ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>{content}</aside>
      <section className="relative z-10 min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-white/5 bg-slate-950/70 px-4 backdrop-blur-xl md:hidden"><button onClick={() => setOpen(true)} className="rounded-xl p-2 text-slate-300" aria-label="Abrir menu"><Menu size={19} /></button><b className="ml-3 text-sm">{projectName ?? "Alpha SEO"}</b></header>
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
      </section>
    </div>
  );
}
