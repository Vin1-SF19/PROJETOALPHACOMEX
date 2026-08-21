"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Archive, FolderKanban, Globe2, Plus, RotateCcw, Settings2, Users } from "lucide-react";
import {
  ArquivarProjetoAlphaSeo,
  CriarProjetoAlphaSeo,
  RestaurarProjetoAlphaSeo,
} from "@/actions/AlphaSeoProjects";
import { PageHeader, SeoCard, StatePanel } from "../shared/PageHeader";

interface Project {
  id: string;
  name: string;
  domain: string | null;
  market: string;
  languageCode: string;
  updatedAt: string | Date;
  _count: { savedKeywords: number; rankConfigs: number; audits: number };
}

function isProject(value: unknown): value is Project {
  return Boolean(value) && typeof value === "object" && typeof (value as { id?: unknown }).id === "string";
}

export function ProjectsClient({ initialProjects, initialArchived }: { initialProjects: Project[]; initialArchived: Project[] }) {
  const [projects, setProjects] = useState(initialProjects);
  const [archived, setArchived] = useState(initialArchived);
  const [show, setShow] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function create(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await CriarProjetoAlphaSeo({ name: formData.get("name"), domain: formData.get("domain") || null, market: formData.get("market"), languageCode: formData.get("languageCode"), locationCode: Number(formData.get("locationCode")) });
      if (!result.success) return setError(result.error);
      const created = result.data;
      if (isProject(created)) setProjects((rows) => [created, ...rows]);
      setShow(false);
    });
  }

  function archiveProject(project: Project) {
    startTransition(async () => {
      const result = await ArquivarProjetoAlphaSeo({ projectId: project.id });
      if (!result.success) return setError(result.error);
      setProjects((rows) => rows.filter((row) => row.id !== project.id));
      setArchived((rows) => [project, ...rows]);
      setConfirmArchive(null);
    });
  }

  function restoreProject(project: Project) {
    startTransition(async () => {
      const result = await RestaurarProjetoAlphaSeo({ projectId: project.id });
      if (!result.success) return setError(result.error);
      setArchived((rows) => rows.filter((row) => row.id !== project.id));
      setProjects((rows) => [project, ...rows]);
    });
  }

  return <>
    <PageHeader title="Projetos SEO" description="Cada workspace mantém mercado, integrações, memória, pesquisas e histórico isolados." icon={FolderKanban} actions={<button type="button" onClick={() => setShow(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[rgb(var(--seo-accent))] px-4 text-sm font-bold text-slate-950"><Plus size={16}/>Novo projeto</button>} />
    {show && <SeoCard className="mb-6 p-5"><form action={create} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_120px_120px_120px_auto]"><Field name="name" label="Nome" placeholder="Projeto institucional" required/><Field name="domain" label="Domínio" placeholder="exemplo.com.br"/><Field name="market" label="Mercado" placeholder="BR" value="BR" required/><Field name="languageCode" label="Idioma" placeholder="pt" value="pt" required/><Field name="locationCode" label="Location" placeholder="2076" value="2076" required/><button disabled={pending} className="min-h-11 self-end rounded-xl border border-white/10 bg-white/10 px-5 text-sm font-bold text-white disabled:opacity-50">{pending ? "Criando…" : "Criar"}</button></form><button type="button" onClick={() => setShow(false)} className="mt-3 text-xs font-bold text-slate-500 hover:text-white">Cancelar</button></SeoCard>}
    {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-300">{error}</p>}
    {projects.length === 0 ? <StatePanel title="Seu primeiro observatório começa aqui" description="Crie um projeto para pesquisar palavras-chave, acompanhar rankings, auditar páginas e conectar Google Search Console e GA4."/> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <ProjectCard key={project.id} project={project} onArchive={() => setConfirmArchive(project)} pending={pending}/>)}</div>}
    {confirmArchive && <SeoCard className="mt-4 border-amber-400/20 bg-amber-400/10 p-5"><h2 className="font-bold text-amber-100">Arquivar {confirmArchive.name}?</h2><p className="mt-2 text-sm text-amber-100/80">Histórico, integrações e pesquisas serão preservados. O projeto poderá ser restaurado.</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => archiveProject(confirmArchive)} disabled={pending} className="min-h-11 rounded-xl bg-amber-300 px-4 text-xs font-black text-amber-950">Confirmar</button><button type="button" onClick={() => setConfirmArchive(null)} className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-bold">Cancelar</button></div></SeoCard>}
    {archived.length > 0 && <details className="mt-6 rounded-2xl border border-white/[.08] bg-slate-900/30"><summary className="cursor-pointer px-5 py-4 text-sm font-bold text-slate-300">Arquivados ({archived.length})</summary><div className="grid gap-3 border-t border-white/5 p-4 md:grid-cols-2 xl:grid-cols-3">{archived.map((project) => <SeoCard key={project.id} className="p-4"><h2 className="truncate font-bold text-white">{project.name}</h2><p className="mt-1 truncate text-xs text-slate-500">{project.domain ?? "Sem domínio"}</p><button type="button" onClick={() => restoreProject(project)} disabled={pending} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold"><RotateCcw size={13}/>Restaurar</button></SeoCard>)}</div></details>}
  </>;
}

function ProjectCard({ project, onArchive, pending }: { project: Project; onArchive: () => void; pending: boolean }) {
  return <SeoCard className="group h-full p-5 transition hover:-translate-y-0.5 hover:border-white/20 motion-reduce:transform-none"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-white/[.05] text-[rgb(var(--seo-accent))]"><Globe2 size={19}/></span><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-400">{project.market} · {project.languageCode.toUpperCase()}</span></div><Link href={`/PainelAlpha/AlphaSEO/${project.id}/dashboard`} className="mt-5 block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--seo-accent))]"><h2 className="truncate text-lg font-bold text-white">{project.name}</h2><p className="mt-1 truncate text-xs text-slate-500">{project.domain ?? "Domínio ainda não definido"}</p></Link><div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/5 pt-4 text-center text-xs"><Counter label="keywords" value={project._count.savedKeywords}/><Counter label="trackers" value={project._count.rankConfigs}/><Counter label="audits" value={project._count.audits}/></div><div className="mt-4 flex flex-wrap gap-2"><Link href={`/PainelAlpha/AlphaSEO/${project.id}/settings`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold"><Settings2 size={13}/>Configurar</Link><Link href={`/PainelAlpha/AlphaSEO/${project.id}/settings`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold"><Users size={13}/>Membros</Link><button type="button" onClick={onArchive} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-400/20 px-3 text-xs font-bold text-amber-200"><Archive size={13}/>Arquivar</button></div></SeoCard>;
}

function Counter({ label, value }: { label: string; value: number }) {
  return <span><b className="block text-white">{value}</b><small className="text-slate-500">{label}</small></span>;
}

function Field({ name, label, placeholder, value, required = false }: { name: string; label: string; placeholder: string; value?: string; required?: boolean }) {
  return <label className="text-xs font-semibold text-slate-300">{label}<input required={required} name={name} defaultValue={value} maxLength={120} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-[rgb(var(--seo-accent))]" placeholder={placeholder}/></label>;
}
