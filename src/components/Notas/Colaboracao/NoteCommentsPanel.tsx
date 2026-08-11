"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Trash2 } from "lucide-react";
import { CriarComentarioNota, ListarComentariosNota, ResolverComentario, ExcluirComentarioNota } from "@/actions/NotasColaboracao";
import { Skeleton } from "@/components/ui/skeleton";

interface ComentarioListado {
  id: string;
  content: string;
  isResolved: boolean;
  createdAt: Date | string;
  author: { id: number; nome: string };
}

interface NoteCommentsPanelProps {
  noteId: string;
  usuarioAtualId: number;
}

export function NoteCommentsPanel({ noteId, usuarioAtualId }: NoteCommentsPanelProps) {
  const [comentarios, setComentarios] = useState<ComentarioListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState("");

  async function carregar() {
    const res = await ListarComentariosNota(noteId);
    if (res.success) setComentarios(res.data);
    setCarregando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregando(true);
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  async function enviar() {
    if (!texto.trim()) return;
    const res = await CriarComentarioNota({ noteId, content: texto.trim() });
    if (!res.success) {
      toast.error(res.error ?? "Não foi possível comentar");
      return;
    }
    setTexto("");
    await carregar();
  }

  async function resolver(commentId: string) {
    await ResolverComentario(commentId);
    await carregar();
  }

  async function excluir(commentId: string) {
    await ExcluirComentarioNota(commentId);
    await carregar();
  }

  return (
    <div className="flex flex-col gap-2 border-t border-white/5 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-600">Comentários</p>

      <div className="flex flex-col gap-2">
        {carregando && (
          <>
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </>
        )}
        {!carregando && comentarios.map((comentario) => (
          <div key={comentario.id} className={`rounded-lg p-2 text-xs ${comentario.isResolved ? "bg-white/[0.02] opacity-60" : "bg-white/[0.04]"}`}>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium text-slate-300">{comentario.author.nome}</span>
              <div className="flex items-center gap-1">
                {!comentario.isResolved && (
                  <button type="button" title="Resolver" onClick={() => void resolver(comentario.id)} className="text-slate-600 hover:text-emerald-400">
                    <CheckCircle2 size={12} />
                  </button>
                )}
                {comentario.author.id === usuarioAtualId && (
                  <button type="button" title="Excluir" onClick={() => void excluir(comentario.id)} className="text-slate-600 hover:text-rose-400">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-slate-400">{comentario.content}</p>
          </div>
        ))}
        {!carregando && comentarios.length === 0 && <p className="text-xs text-slate-600">Nenhum comentário ainda.</p>}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void enviar();
          }}
          placeholder="Comentar..."
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-600"
        />
        <button type="button" onClick={() => void enviar()} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5">
          Enviar
        </button>
      </div>
    </div>
  );
}
