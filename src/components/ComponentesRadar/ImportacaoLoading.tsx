type Props = {
  totalLote: number;
  processadas: number;
  statusLote: string;
  processando: boolean;
  pausado?: boolean;
  onPausar?: () => void;
  onRetomar?: () => void;
  onCancelar: () => void;
};

export default function LoadingImport({
  totalLote,
  processadas,
  statusLote,
  processando,
  pausado = false,
  onPausar,
  onRetomar,
  onCancelar,
}: Props) {
  const progresso = totalLote > 0 ? Math.min(Math.round((processadas / totalLote) * 100), 100) : 0;

  const isBanco = statusLote?.toLowerCase().includes("banco") || statusLote?.toLowerCase().includes("sincronizando");
  const isReceita = statusLote?.toLowerCase().includes("receita");

  const corDot = pausado
    ? "bg-amber-400"
    : isBanco
    ? "bg-purple-500"
    : "bg-blue-500";

  const corTexto = pausado
    ? "text-amber-400"
    : isBanco
    ? "text-purple-400"
    : "text-blue-400";

  const corBarra = pausado
    ? "from-amber-600 via-amber-400 to-yellow-300"
    : isBanco
    ? "from-purple-600 via-fuchsia-500 to-purple-400"
    : isReceita
    ? "from-cyan-700 via-cyan-500 to-teal-400"
    : "from-blue-700 via-blue-500 to-cyan-400";

  if (!processando && processadas === 0) {
    return (
      <div className="mt-6 p-4 rounded-xl border border-white/5 bg-slate-900/50 text-sm text-zinc-500 italic text-center">
        {statusLote || "Aguardando início do lote..."}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3 w-full animate-in fade-in slide-in-from-top-2 duration-500">

      {/* Status label */}
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${corDot} ${pausado ? "" : "animate-ping"}`}
          />
          <span className={`text-[10px] uppercase tracking-widest font-black ${corTexto}`}>
            {pausado
              ? "PAUSADO"
              : statusLote || (processando ? "Processando..." : "Finalizado")}
          </span>
        </div>
        <span className="text-xs font-mono font-black text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
          {progresso}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-4 w-full bg-slate-950/80 rounded-full border border-white/10 overflow-hidden p-[3px] shadow-inner">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-in-out bg-gradient-to-r ${corBarra}`}
          style={{ width: `${progresso}%` }}
        >
          {!pausado && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite] skew-x-[-20deg]" />
          )}
        </div>
      </div>

      {/* Counter + controls */}
      <div className="flex items-center justify-between gap-2 bg-slate-900/40 px-3 py-2 rounded-xl border border-white/5">
        <div className="flex flex-col">
          <span className="text-[9px] text-zinc-500 font-black uppercase tracking-tight">
            {pausado ? "Progresso pausado em" : "Progresso"}
          </span>
          <span className="text-xs text-zinc-300 font-mono font-bold">
            {processadas.toLocaleString()}
            <span className="text-zinc-600"> / </span>
            {totalLote.toLocaleString()}
            <small className="text-[9px] text-zinc-500 ml-1">registros</small>
          </span>
        </div>

        {processando && (
          <div className="flex items-center gap-2">
            {/* Pause / Resume */}
            {pausado ? (
              <button
                onClick={onRetomar}
                className="flex items-center gap-1.5 text-[10px] bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white px-3 py-1.5 rounded-lg border border-emerald-500/30 transition-all font-black uppercase"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <polygon points="2,1 9,5 2,9" />
                </svg>
                Retomar
              </button>
            ) : (
              onPausar && (
                <button
                  onClick={onPausar}
                  className="flex items-center gap-1.5 text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-lg border border-amber-500/30 transition-all font-black uppercase"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <rect x="1" y="1" width="3" height="8" rx="0.5" />
                    <rect x="6" y="1" width="3" height="8" rx="0.5" />
                  </svg>
                  Pausar
                </button>
              )
            )}

            {/* Cancel */}
            <button
              onClick={onCancelar}
              className="flex items-center gap-1.5 text-[10px] bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white px-3 py-1.5 rounded-lg border border-rose-500/30 transition-all font-black uppercase"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Indicators */}
      {processando && (
        <div className="flex items-center justify-center gap-4 py-1 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                pausado ? "bg-zinc-700" : isReceita ? "bg-cyan-500 animate-pulse" : "bg-zinc-700"
              }`}
            />
            <span className={`text-[8px] font-bold ${pausado || !isReceita ? "text-zinc-600" : "text-cyan-500"}`}>
              API RECEITA
            </span>
          </div>
          <div className="h-1 w-1 rounded-full bg-zinc-800" />
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                pausado ? "bg-zinc-700" : isBanco ? "bg-purple-500 animate-pulse" : "bg-zinc-700"
              }`}
            />
            <span className={`text-[8px] font-bold ${pausado || !isBanco ? "text-zinc-600" : "text-purple-500"}`}>
              DATABASE SYNC
            </span>
          </div>
          {pausado && (
            <>
              <div className="h-1 w-1 rounded-full bg-zinc-800" />
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[8px] font-bold text-amber-400">AGUARDANDO</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
