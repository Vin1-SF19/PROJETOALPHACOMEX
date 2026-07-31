"use client";

import { useState, type ReactNode } from "react";
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

import type { CalendarioSelecionadoView } from "./lib/tipos";
import { MiniCalendarioAgenda } from "./MiniCalendarioAgenda";

interface ColegaAgendaSidebar {
  colegaId: number;
  cor: string;
  visivel: boolean;
  colega: { id: number; nome: string; email: string };
}

interface AgendaSidebarProps {
  tema: TemaAlpha;
  dataReferencia: Date;
  calendarios: CalendarioSelecionadoView[];
  colegas: ColegaAgendaSidebar[];
  isAdmin: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onCriar: () => void;
  onSelecionarDia: (data: Date) => void;
  onGerenciarCalendarios: () => void;
  onGerenciarColegas: () => void;
  onGerenciarPermissoes: () => void;
  onAlternarCalendario: (calendario: CalendarioSelecionadoView) => void;
  onAlternarColega: (colegaId: number, visivel: boolean) => void;
  footer?: ReactNode;
}

function MarcadorSelecao({
  selecionado,
  cor,
  label,
}: {
  selecionado: boolean;
  cor: string | null;
  label: string;
}) {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-md border border-white/10"
      style={cor ? { backgroundColor: cor } : undefined}
      aria-hidden="true"
      title={label}
    >
      {selecionado && <Check className="size-3 text-white drop-shadow" />}
    </span>
  );
}

function GrupoAgenda({
  titulo,
  children,
  recolhida,
}: {
  titulo: string;
  children: ReactNode;
  recolhida: boolean;
}) {
  if (recolhida) return <div className="space-y-1">{children}</div>;
  return (
    <section aria-labelledby={`agenda-grupo-${titulo}`}>
      <h3
        id={`agenda-grupo-${titulo}`}
        className="mb-1.5 px-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600"
      >
        {titulo}
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function AgendaSidebarContent({
  tema,
  dataReferencia,
  calendarios,
  colegas,
  isAdmin,
  recolhida,
  onCriar,
  onSelecionarDia,
  onGerenciarCalendarios,
  onGerenciarColegas,
  onGerenciarPermissoes,
  onAlternarCalendario,
  onAlternarColega,
  footer,
}: Omit<AgendaSidebarProps, "mobileOpen" | "onMobileOpenChange"> & { recolhida: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Button
        type="button"
        onClick={onCriar}
        aria-label="Criar evento"
        className={cn("min-h-11 w-full gap-2 rounded-xl text-white lg:min-h-10", tema.bg, recolhida && "px-0")}
      >
        <CalendarPlus className="size-4" />
        {!recolhida && "Criar"}
      </Button>

      {!recolhida && (
        <MiniCalendarioAgenda dataReferencia={dataReferencia} tema={tema} onSelecionarDia={onSelecionarDia} />
      )}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-0.5 [@media(max-height:760px)]:space-y-2">
        <GrupoAgenda titulo="Minhas agendas" recolhida={recolhida}>
          {calendarios.map((calendario) => (
            <button
              key={calendario.id}
              type="button"
              onClick={() => onAlternarCalendario(calendario)}
              aria-pressed={calendario.visivel}
              aria-label={`${calendario.visivel ? "Ocultar" : "Mostrar"} ${calendario.nome}`}
              title={recolhida ? calendario.nome : undefined}
              className={cn(
                "flex min-h-11 w-full items-center gap-2 rounded-xl border border-transparent px-2 text-left text-sm text-slate-400 transition-colors hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                calendario.visivel && cn(tema.border, tema.glow, "text-slate-100"),
                recolhida && "justify-center px-0",
              )}
            >
              <MarcadorSelecao selecionado={calendario.visivel} cor={calendario.corHex} label={calendario.nome} />
              {!recolhida && <span className="truncate">{calendario.nome}</span>}
            </button>
          ))}
          <button
            type="button"
            onClick={onGerenciarCalendarios}
            title={recolhida ? "Gerenciar agendas" : undefined}
            className={cn(
              "flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-xs font-semibold text-slate-500 hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
              recolhida && "justify-center px-0",
            )}
          >
            <Plus className="size-4" />
            {!recolhida && "Gerenciar agendas"}
          </button>
        </GrupoAgenda>

        <GrupoAgenda titulo="Compartilhadas" recolhida={recolhida}>
          {colegas.map((item) => (
            <button
              key={item.colegaId}
              type="button"
              onClick={() => onAlternarColega(item.colegaId, !item.visivel)}
              aria-pressed={item.visivel}
              aria-label={`${item.visivel ? "Ocultar" : "Mostrar"} agenda de ${item.colega.nome}`}
              title={recolhida ? item.colega.nome : undefined}
              className={cn(
                "flex min-h-11 w-full items-center gap-2 rounded-xl border border-transparent px-2 text-left text-sm text-slate-400 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                item.visivel && cn(tema.border, "text-slate-100"),
                recolhida && "justify-center px-0",
              )}
            >
              <MarcadorSelecao selecionado={item.visivel} cor={item.cor} label={item.colega.nome} />
              {!recolhida && <span className="truncate">{item.colega.nome}</span>}
            </button>
          ))}
          <button
            type="button"
            onClick={onGerenciarColegas}
            title={recolhida ? "Gerenciar colegas" : undefined}
            className={cn(
              "flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-xs font-semibold text-slate-500 hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
              recolhida && "justify-center px-0",
            )}
          >
            <Users className="size-4" />
            {!recolhida && "Gerenciar colegas"}
          </button>
        </GrupoAgenda>
      </div>

      <div className="space-y-2 border-t border-white/5 pt-3">
        {isAdmin && (
          <button
            type="button"
            onClick={onGerenciarPermissoes}
            title={recolhida ? "Permissões" : undefined}
            className={cn(
              "flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-xs font-semibold text-slate-500 hover:bg-white/5 hover:text-slate-200",
              recolhida && "justify-center px-0",
            )}
          >
            <ShieldCheck className="size-4" />
            {!recolhida && "Permissões"}
          </button>
        )}
        {!recolhida && footer}
      </div>
    </div>
  );
}

export function AgendaSidebar(props: AgendaSidebarProps) {
  const [recolhida, setRecolhida] = useState(false);

  return (
    <>
      <aside
        aria-label="Agendas"
        className={cn(
          "hidden h-full min-h-0 shrink-0 flex-col rounded-[1.75rem] border border-white/10 bg-slate-950/65 p-2.5 shadow-2xl backdrop-blur-2xl transition-[width] duration-300 lg:flex xl:p-3",
          recolhida ? "w-[4.25rem]" : "w-60 xl:w-64 2xl:w-72",
        )}
      >
        <AgendaSidebarContent {...props} recolhida={recolhida} />
        <button
          type="button"
          onClick={() => setRecolhida((valor) => !valor)}
          aria-label={recolhida ? "Expandir barra de agendas" : "Recolher barra de agendas"}
          className="mt-2 flex min-h-10 items-center justify-center rounded-xl text-slate-500 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          {recolhida ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </aside>

      <Sheet open={props.mobileOpen} onOpenChange={props.onMobileOpenChange}>
        <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-[2rem]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings2 className={cn("size-4", props.tema.text)} /> Agendas
            </SheetTitle>
            <SheetDescription>Escolha o que aparece na grade da Agenda Alpha.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-5 pb-5">
            <AgendaSidebarContent {...props} recolhida={false} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
