import type { TabelaComponente } from "@/lib/validations/slide-componentes";

/** Edição via texto simples (1 linha por linha da tabela, células separadas por " | ") — mantém a UI enxuta para uma estrutura tabular. */
export function TabelaProps({ componente, onChange }: { componente: TabelaComponente; onChange: (patch: Partial<TabelaComponente>) => void }) {
  const colunasTexto = componente.colunas.join(" | ");
  const linhasTexto = componente.linhas.map((l) => l.join(" | ")).join("\n");

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Cabeçalhos (separados por &quot;|&quot;)</label>
        <input
          type="text"
          value={colunasTexto}
          onChange={(e) => onChange({ colunas: e.target.value.split("|").map((s) => s.trim()) })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Linhas (1 por linha, células separadas por &quot;|&quot;)</label>
        <textarea
          value={linhasTexto}
          onChange={(e) => onChange({ linhas: e.target.value.split("\n").filter(Boolean).map((l) => l.split("|").map((s) => s.trim())) })}
          rows={5}
          className="w-full resize-none rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Cor do cabeçalho</label>
        <input
          type="text"
          value={componente.corCabecalho ?? ""}
          onChange={(e) => onChange({ corCabecalho: e.target.value })}
          placeholder="#1e293b"
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
    </>
  );
}
