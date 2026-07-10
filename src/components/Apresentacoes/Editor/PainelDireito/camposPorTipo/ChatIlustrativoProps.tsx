import { Plus, Trash2 } from "lucide-react";
import type { ChatIlustrativoComponente } from "@/lib/validations/slide-componentes";

export function ChatIlustrativoProps({ componente, onChange }: { componente: ChatIlustrativoComponente; onChange: (patch: Partial<ChatIlustrativoComponente>) => void }) {
  function atualizarMsg(i: number, patch: Partial<ChatIlustrativoComponente["mensagens"][number]>) {
    onChange({ mensagens: componente.mensagens.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) });
  }
  function adicionar() {
    onChange({ mensagens: [...componente.mensagens, { autor: "usuario", texto: "Nova mensagem" }] });
  }
  function remover(i: number) {
    onChange({ mensagens: componente.mensagens.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-2 border-t border-white/5 pt-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-slate-400">Mensagens</label>
        <button type="button" onClick={adicionar} aria-label="Adicionar mensagem" className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400">
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
      {componente.mensagens.map((msg, i) => (
        <div key={i} className="space-y-1 rounded-lg border border-white/5 p-2">
          <div className="flex gap-1.5">
            <select
              value={msg.autor}
              onChange={(e) => atualizarMsg(i, { autor: e.target.value as "usuario" | "ia" })}
              aria-label={`Autor da mensagem ${i + 1}`}
              className="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
            >
              <option value="usuario">Usuário</option>
              <option value="ia">IA</option>
            </select>
            <button type="button" onClick={() => remover(i)} aria-label={`Remover mensagem ${i + 1}`} className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
              <Trash2 size={12} aria-hidden="true" />
            </button>
          </div>
          <textarea
            value={msg.texto}
            onChange={(e) => atualizarMsg(i, { texto: e.target.value })}
            aria-label={`Texto da mensagem ${i + 1}`}
            rows={2}
            className="w-full resize-none rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
          />
        </div>
      ))}
    </div>
  );
}
