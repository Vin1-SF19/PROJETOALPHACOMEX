"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ListarComentariosBlueprint, CriarComentarioBlueprint,
  ResolverComentarioBlueprint, ReabrirComentarioBlueprint, ExcluirComentarioBlueprint,
} from "@/actions/BlueprintComments";

interface Comentario {
  id: string;
  content: string;
  authorId: number;
  resolved: boolean;
  createdAt: string | Date;
}

interface CommentsPanelProps {
  projectId: string;
  accent: string;
  userId: number;
}

export function CommentsPanel({ projectId, accent, userId }: CommentsPanelProps) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [novoComentario, setNovoComentario] = useState("");

  const carregar = useCallback(async () => {
    const res = await ListarComentariosBlueprint(projectId);
    if (res.success && res.data) setComentarios(res.data as unknown as Comentario[]);
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  async function criar() {
    if (!novoComentario.trim()) return;
    const res = await CriarComentarioBlueprint({ projectId, targetType: "PROJETO", content: novoComentario.trim() });
    if (res.success) {
      setNovoComentario("");
      carregar();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao comentar");
    }
  }

  async function alternarResolucao(comentario: Comentario) {
    const res = comentario.resolved ? await ReabrirComentarioBlueprint(comentario.id) : await ResolverComentarioBlueprint(comentario.id);
    if (res.success) carregar();
  }

  async function excluir(id: string) {
    const res = await ExcluirComentarioBlueprint(id);
    if (res.success) carregar();
    else toast.error(typeof res.error === "string" ? res.error : "Erro ao excluir");
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-sm font-semibold text-white">Comentários do projeto</h2>

      <div className="flex gap-2">
        <input
          value={novoComentario}
          onChange={(e) => setNovoComentario(e.target.value)}
          placeholder="Escreva um comentário..."
          className="flex-1 rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none"
          onKeyDown={(e) => e.key === "Enter" && criar()}
        />
        <button onClick={criar} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: `rgba(${accent},0.9)` }}>
          Comentar
        </button>
      </div>

      <div className="space-y-2">
        {comentarios.map((c) => (
          <div key={c.id} className={`rounded-xl border p-3 flex items-start gap-3 ${c.resolved ? "border-white/5 bg-slate-900/20 opacity-60" : "border-white/5 bg-slate-900/40"}`}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ background: `rgba(${accent},0.5)` }}>
              {c.authorId}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200">{c.content}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">{new Date(c.createdAt).toLocaleString("pt-BR")}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => alternarResolucao(c)} className="p-1 text-slate-500 hover:text-white" title={c.resolved ? "Reabrir" : "Resolver"}>
                {c.resolved ? <RotateCcw size={14} /> : <Check size={14} />}
              </button>
              {c.authorId === userId && (
                <button onClick={() => excluir(c.id)} className="p-1 text-slate-500 hover:text-rose-400" title="Excluir">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        {comentarios.length === 0 && <p className="text-sm text-slate-500 text-center py-6">Nenhum comentário ainda</p>}
      </div>
    </div>
  );
}
