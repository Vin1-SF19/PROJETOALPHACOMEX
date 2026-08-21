import type { LucideIcon } from "lucide-react";

export function PageHeader({ eyebrow = "Alpha SEO", title, description, icon: Icon, actions }: { eyebrow?: string; title: string; description: string; icon: LucideIcon; actions?: React.ReactNode }) {
  return <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="flex min-w-0 items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[.04] text-[rgb(var(--seo-accent))]"><Icon size={21} /></span><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.22em] text-[rgb(var(--seo-accent))]">{eyebrow}</p><h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p></div></div>
    {actions && <div className="shrink-0">{actions}</div>}
  </header>;
}

export function SeoCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-white/[.08] bg-slate-900/55 shadow-2xl shadow-black/10 backdrop-blur-sm ${className}`}>{children}</section>;
}

export function StatePanel({ title, description }: { title: string; description: string }) {
  return <SeoCard className="p-8 text-center"><div className="mx-auto mb-3 size-2 rounded-full bg-[rgb(var(--seo-accent))] shadow-[0_0_18px_rgba(var(--seo-accent),.8)]"/><h2 className="font-bold text-white">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">{description}</p></SeoCard>;
}
