interface ControleOpacidadeProps {
  elementoId: string;
  percentual: number;
  quantidadeSelecionada: number;
  onChange: (percentual: number) => void;
  onIniciarAlteracao: () => void;
  onFinalizarAlteracao: () => void;
}

export function ControleOpacidade({
  elementoId,
  percentual,
  quantidadeSelecionada,
  onChange,
  onIniciarAlteracao,
  onFinalizarAlteracao,
}: ControleOpacidadeProps) {
  const inputId = `opacidade-${elementoId}`;

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-[11px] font-medium text-slate-300">
          Opacidade
        </label>
        <output
          htmlFor={inputId}
          className="min-w-11 rounded-md bg-white/5 px-2 py-1 text-center text-[11px] font-semibold tabular-nums text-white"
        >
          {percentual}%
        </output>
      </div>
      <input
        id={inputId}
        type="range"
        min={0}
        max={100}
        step={1}
        value={percentual}
        aria-label="Opacidade do elemento"
        aria-valuetext={`${percentual}%`}
        onPointerDown={(evento) => {
          evento.currentTarget.setPointerCapture(evento.pointerId);
          onIniciarAlteracao();
        }}
        onPointerUp={(evento) => {
          if (evento.currentTarget.hasPointerCapture(evento.pointerId)) evento.currentTarget.releasePointerCapture(evento.pointerId);
          onFinalizarAlteracao();
        }}
        onPointerCancel={onFinalizarAlteracao}
        onBlur={onFinalizarAlteracao}
        onChange={(evento) => onChange(Number(evento.target.value))}
        className="h-1.5 w-full cursor-pointer accent-indigo-500"
      />
      {quantidadeSelecionada > 1 && (
        <p className="text-[10px] leading-relaxed text-slate-500">O valor será aplicado aos {quantidadeSelecionada} elementos selecionados.</p>
      )}
    </div>
  );
}
