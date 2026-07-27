"use client";

import type { Node } from "@xyflow/react";
import { Trash2, Copy } from "lucide-react";
import { CORES_DESTAQUE, CATEGORIAS_FORMA, VARIANTE_LABEL, type CorDestaqueId, type PlataformaTela } from "./tipos-node";

interface CanvasPropertiesPanelProps {
  node: Node;
  onAtualizar: (patch: Record<string, unknown>) => void;
  onExcluir: () => void;
  onDuplicar: () => void;
}

export function CanvasPropertiesPanel({ node, onAtualizar, onExcluir, onDuplicar }: CanvasPropertiesPanelProps) {
  const data = node.data as Record<string, unknown>;

  return (
    <div className="absolute top-3 right-3 z-10 w-56 max-h-[70vh] overflow-y-auto rounded-xl border border-white/10 bg-slate-950/95 backdrop-blur-xl p-3 space-y-3 shadow-xl">
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Propriedades</p>

      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-500">Cor</label>
        <div className="flex gap-1.5">
          {CORES_DESTAQUE.map((c) => (
            <button
              key={c.id}
              onClick={() => onAtualizar({ cor: c.id as CorDestaqueId })}
              className="w-5 h-5 rounded-full transition-transform"
              style={{
                background: `rgb(${c.rgb})`,
                transform: data.cor === c.id ? "scale(1.2)" : "scale(1)",
                boxShadow: data.cor === c.id ? `0 0 0 2px rgba(2,6,23,1), 0 0 0 3px rgb(${c.rgb})` : "none",
              }}
              title={c.id}
            />
          ))}
        </div>
      </div>

      {node.type === "textoNode" && (
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-500">Tamanho da fonte</label>
          <div className="flex gap-1">
            {(["sm", "md", "lg"] as const).map((t) => (
              <button
                key={t}
                onClick={() => onAtualizar({ tamanhoFonte: t })}
                className="flex-1 text-[11px] py-1 rounded-lg border transition-colors"
                style={{
                  borderColor: data.tamanhoFonte === t ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)",
                  color: data.tamanhoFonte === t ? "#fff" : "#64748b",
                }}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {node.type === "linhaNode" && (
        <>
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-500">Orientação</label>
            <div className="flex gap-1">
              {(["horizontal", "vertical"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => onAtualizar({ orientacao: o })}
                  className="flex-1 text-[11px] py-1 rounded-lg border capitalize transition-colors"
                  style={{
                    borderColor: data.orientacao === o ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)",
                    color: data.orientacao === o ? "#fff" : "#64748b",
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={!!data.comPonta}
              onChange={(e) => onAtualizar({ comPonta: e.target.checked })}
              className="rounded border-white/20"
            />
            Com ponta de seta
          </label>
        </>
      )}

      {node.type === "formaNode" && (
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-500">Forma</label>
          <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto pr-0.5">
            {CATEGORIAS_FORMA.flatMap((cat) => cat.variantes).map((v) => (
              <button
                key={v}
                onClick={() => onAtualizar({ variante: v })}
                className="text-[10px] py-1 rounded-lg border transition-colors truncate px-1"
                style={{
                  borderColor: data.variante === v ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)",
                  color: data.variante === v ? "#fff" : "#64748b",
                }}
                title={VARIANTE_LABEL[v]}
              >
                {VARIANTE_LABEL[v]}
              </button>
            ))}
          </div>
        </div>
      )}

      {node.type === "imagemNode" && (
        <p className="text-[11px] text-slate-500">
          {data.url ? "Passe o mouse sobre a imagem e clique em \"Substituir\" para trocar." : "Clique no elemento no canvas para escolher uma imagem do seu computador."}
        </p>
      )}

      {node.type === "telaNode" && (
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-500">Plataforma</label>
          <div className="flex gap-1">
            {(["desktop", "mobile"] as PlataformaTela[]).map((p) => (
              <button
                key={p}
                onClick={() => onAtualizar({ plataforma: p })}
                className="flex-1 text-[11px] py-1 rounded-lg border capitalize transition-colors"
                style={{
                  borderColor: data.plataforma === p ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)",
                  color: data.plataforma === p ? "#fff" : "#64748b",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1.5 pt-1 border-t border-white/5">
        <button
          onClick={onDuplicar}
          className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Copy size={12} /> Duplicar
        </button>
        <button
          onClick={onExcluir}
          className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 size={12} /> Excluir
        </button>
      </div>
    </div>
  );
}
