import { StickyNote } from "lucide-react";

export function EstadoVazioNotas({ onCriarNota }: { onCriarNota: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <StickyNote size={36} className="text-slate-700" aria-hidden="true" />
      <p className="max-w-sm text-sm text-slate-500">
        Você ainda não possui notas. Crie uma anotação ou registre algo diretamente em um módulo do Painel Alpha.
      </p>
      <button
        type="button"
        onClick={onCriarNota}
        className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
      >
        Criar primeira nota
      </button>
    </div>
  );
}
