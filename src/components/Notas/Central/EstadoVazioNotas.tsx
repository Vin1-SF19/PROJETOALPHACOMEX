import { StickyNote } from "lucide-react";

interface EstadoVazioNotasProps {
  onCriarNota: () => void;
  accent: string;
}

export function EstadoVazioNotas({ onCriarNota, accent }: EstadoVazioNotasProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="rounded-2xl border p-4" style={{ background: `rgba(${accent},0.08)`, borderColor: `rgba(${accent},0.15)` }}>
        <StickyNote size={30} style={{ color: `rgba(${accent},0.7)` }} aria-hidden="true" />
      </div>
      <p className="max-w-sm text-sm text-slate-500">
        Você ainda não possui notas. Crie uma anotação ou registre algo diretamente em um módulo do Painel Alpha.
      </p>
      <button
        type="button"
        onClick={onCriarNota}
        className="mt-1 rounded-xl border px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:text-white"
        style={{ borderColor: `rgba(${accent},0.25)`, background: `rgba(${accent},0.08)` }}
      >
        Criar primeira nota
      </button>
    </div>
  );
}
