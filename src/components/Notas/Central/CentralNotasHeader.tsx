import { motion } from "framer-motion";
import { Plus, Search, StickyNote } from "lucide-react";

interface CentralNotasHeaderProps {
  accent: string;
  total: number;
  query: string;
  onQueryChange: (query: string) => void;
  onCriarNota: () => void;
}

export function CentralNotasHeader({ accent, total, query, onQueryChange, onCriarNota }: CentralNotasHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="relative z-10 mx-4 mt-4 flex shrink-0 items-center gap-4 overflow-hidden rounded-3xl border p-4 shadow-2xl backdrop-blur-2xl md:mx-6 md:mt-6"
      style={{
        background: `linear-gradient(135deg, rgba(${accent},0.14) 0%, rgba(2,6,23,0.55) 55%, rgba(2,6,23,0.35) 100%)`,
        borderColor: `rgba(${accent},0.22)`,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="rounded-2xl border p-2.5"
          style={{ background: `rgba(${accent},0.2)`, borderColor: `rgba(${accent},0.25)` }}
        >
          <StickyNote className="h-6 w-6" style={{ color: `rgba(${accent},1)` }} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-black uppercase italic leading-none tracking-tighter text-white sm:text-3xl">
            Bloco de notas <span style={{ color: `rgba(${accent},1)` }}>ALpha</span>
          </h1>
          <p className="ml-0.5 mt-1 text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">
            {total} nota{total === 1 ? "" : "s"} no painel
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div
          className="flex items-center gap-2 rounded-2xl border bg-slate-950/50 px-3 py-2 backdrop-blur-xl"
          style={{ borderColor: `rgba(${accent},0.18)` }}
        >
          <Search size={14} className="text-slate-500" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Pesquisar notas..."
            aria-label="Pesquisar notas"
            className="w-44 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600 sm:w-56"
          />
        </div>
        <button
          type="button"
          onClick={onCriarNota}
          className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-transform active:scale-95"
          style={{ background: `rgba(${accent},0.9)`, boxShadow: `0 10px 30px -10px rgba(${accent},0.6)` }}
        >
          <Plus size={14} strokeWidth={3} /> Nova nota
        </button>
      </div>
    </motion.header>
  );
}

