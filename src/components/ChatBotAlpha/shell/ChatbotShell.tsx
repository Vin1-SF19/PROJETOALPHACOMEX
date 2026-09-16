"use client";

import { useEffect, useState } from "react";
import { Bot, Menu, Radio } from "lucide-react";
import { usePathname } from "next/navigation";
import { FlowButton } from "@/components/ui/flow-button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { OperationalState } from "../shared/OperationalState";
import { useChatbotStore } from "@/store/useChatbotStore";
import { CHATBOT_NAVIGATION } from "./navigation";

interface ChatbotShellProps { children: React.ReactNode; accent: string }

export function ChatbotShell({ children, accent }: ChatbotShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const loadState = useChatbotStore((state) => state.loadState);
  const error = useChatbotStore((state) => state.error);
  const initialize = useChatbotStore((state) => state.initialize);
  const retry = useChatbotStore((state) => state.retry);
  useEffect(() => { void initialize().catch(() => undefined); }, [initialize]);
  const activeItem = CHATBOT_NAVIGATION.flatMap((group) => group.items).find((item) => pathname === item.href);
  const nav = (
    <>
      <div className="flex h-14 items-center gap-3 border-b border-white/5 px-4">
        <span className="grid size-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04]" style={{ color: `rgb(${accent})` }}><Bot className="size-4" /></span>
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-100">ChatBot Alpha</p><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Central operacional</p></div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Navegação do ChatBot Alpha">
        {CHATBOT_NAVIGATION.map((group) => <div key={group.group}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">{group.group}</p>
          <div className="space-y-1">{group.items.map((item) => <FlowButton key={item.href} href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} accent={accent} onClick={() => setIsMenuOpen(false)} className="min-h-11 px-3 py-2.5 md:min-h-9 md:py-2" />)}</div>
        </div>)}
      </nav>
      <div className="border-t border-white/5 p-3"><div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-slate-400"><Radio className="size-3.5 text-emerald-400" /><span>Dados simulados</span><span className="ml-auto rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">MOCK</span></div></div>
    </>
  );
  return <div className="flex h-full min-h-0 overflow-hidden bg-[#020617] text-slate-100" style={{ "--alpha-primary": accent } as React.CSSProperties}>
    <aside className="hidden w-56 shrink-0 flex-col border-r border-white/5 bg-slate-950 md:flex">{nav}</aside>
    <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}><SheetContent side="left" className="w-64 gap-0 p-0 md:hidden"><SheetTitle className="sr-only">Navegação do ChatBot Alpha</SheetTitle><SheetDescription className="sr-only">Escolha uma área do módulo</SheetDescription>{nav}</SheetContent></Sheet>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/5 bg-slate-950/80 px-4">
        <button type="button" className="grid size-11 place-items-center rounded-lg text-slate-300 hover:bg-white/5 md:hidden" onClick={() => setIsMenuOpen(true)} aria-label="Abrir navegação"><Menu className="size-5" /></button>
        <div><h1 className="text-sm font-semibold text-slate-100">{activeItem?.label ?? "ChatBot Alpha"}</h1><p className="hidden text-xs text-slate-500 sm:block">Operação frontend segura, sem conexões externas</p></div>
        <div className="ml-auto flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-400"><span className="size-1.5 rounded-full bg-emerald-400" /> Ambiente de demonstração</div>
      </header>
      <main className="min-h-0 flex-1 overflow-auto" aria-label={`Área ${activeItem?.label ?? "ChatBot Alpha"}`}>
        {loadState === "success" ? children : loadState === "error"
          ? <OperationalState state="error" description={error ?? "Não foi possível carregar os dados simulados."} onRetry={() => { void retry().catch(() => undefined); }} />
          : <OperationalState state="loading" />}
      </main>
    </div>
  </div>;
}
