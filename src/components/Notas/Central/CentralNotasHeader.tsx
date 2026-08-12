import { motion } from "framer-motion";
import { CircleHelp, ListFilter, Plus, Search, StickyNote } from "lucide-react";

interface CentralNotasHeaderProps {
  accent: string;
  total: number;
  query: string;
  onQueryChange: (query: string) => void;
  onCriarNota: () => void;
  onAbrirTutorial: () => void;
  onAbrirFiltros: () => void;
}

export function CentralNotasHeader({
  accent,
  total,
  query,
  onQueryChange,
  onCriarNota,
  onAbrirTutorial,
  onAbrirFiltros,
}: CentralNotasHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="relative z-10 mx-3 mt-3 flex shrink-0 flex-col gap-3 overflow-hidden rounded-3xl border p-3 shadow-2xl backdrop-blur-2xl sm:p-4 md:mx-6 md:mt-6 lg:flex-row lg:items-center lg:gap-4"
      style={{
        background: `linear-gradient(135deg, rgba(${accent},0.14) 0%, rgba(2,6,23,0.55) 55%, rgba(2,6,23,0.35) 100%)`,
        borderColor: `rgba(${accent},0.22)`,
      }}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onAbrirFiltros}
          title="Seções e etiquetas"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-slate-300 transition-colors hover:text-white lg:hidden"
          style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }}
        >
          <ListFilter size={17} aria-hidden="true" />
        </button>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3" data-guia-notas="visao-geral">
          <div
            className="hidden shrink-0 rounded-2xl border p-2.5 sm:flex"
            style={{ background: `rgba(${accent},0.2)`, borderColor: `rgba(${accent},0.25)` }}
          >
            <StickyNote className="h-6 w-6" style={{ color: `rgba(${accent},1)` }} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black uppercase italic leading-none tracking-tighter text-white sm:text-2xl lg:text-3xl">
              Bloco de notas <span style={{ color: `rgba(${accent},1)` }}>ALpha</span>
            </h1>
            <p className="ml-0.5 mt-1 truncate text-[9px] font-black uppercase tracking-[0.25em] text-slate-500 sm:text-[10px] sm:tracking-[0.35em]">
              {total} nota{total === 1 ? "" : "s"} no painel
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:ml-auto">
        <div
          className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border bg-slate-950/50 px-3 py-2 backdrop-blur-xl lg:flex-none"
          style={{ borderColor: `rgba(${accent},0.18)` }}
          data-guia-notas="busca"
        >
          <Search size={14} className="shrink-0 text-slate-500" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Pesquisar notas..."
            aria-label="Pesquisar notas"
            className="w-full min-w-0 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600 lg:w-44 lg:min-w-[11rem] xl:w-56"
          />
        </div>
        <button
          type="button"
          onClick={onAbrirTutorial}
          title="Como usar o bloco de notas"
          data-guia-notas="tutorial-botao"
          className="flex h-10 shrink-0 items-center gap-2 rounded-2xl px-2.5 text-[10px] font-black uppercase tracking-wider text-slate-300 transition-all hover:text-white sm:h-11 sm:px-3"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <CircleHelp size={15} /> <span className="hidden sm:inline">Como usar</span>
        </button>
        <button
          type="button"
          onClick={onCriarNota}
          data-guia-notas="nova-nota"
          className="flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-transform active:scale-95 sm:px-4"
          style={{ background: `rgba(${accent},0.9)`, boxShadow: `0 10px 30px -10px rgba(${accent},0.6)` }}
        >
          <Plus size={14} strokeWidth={3} /> <span className="hidden sm:inline">Nova nota</span>
        </button>
      </div>
    </motion.header>
  );
}

