"use client";

import { useState } from "react";
import { Pin, Star, Archive, Trash2, Tag as TagIcon, Link2, Share2, History, MessageSquare, Bell } from "lucide-react";
import { toast } from "sonner";
import { FixarNota, FavoritarNota } from "@/actions/NotasBusca";
import { ArquivarNota, MoverNotaParaLixeira, ExcluirNotaDefinitivamente } from "@/actions/Notas";
import { FecharAbaNota } from "@/actions/NotasWorkspace";
import { useNotasWorkspace } from "@/store/useNotasWorkspace";
import { useNotasNotificacoes } from "@/store/useNotasNotificacoes";
import { limparRascunhoLocalDaNota } from "@/lib/notas-tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { NotaListada } from "./ListaNotas";
import { cn } from "@/lib/utils";
import { NoteShareDialog } from "@/components/Notas/Colaboracao/NoteShareDialog";
import { NoteHistoryDialog } from "@/components/Notas/Colaboracao/NoteHistoryDialog";
import { NoteCommentsPanel } from "@/components/Notas/Colaboracao/NoteCommentsPanel";
import { ListaAnexos } from "@/components/Notas/Anexos/ListaAnexos";
import { CriarLembreteDialog } from "@/components/Notas/Lembretes/CriarLembreteDialog";

interface PainelPropriedadesProps {
  nota: NotaListada;
  usuarioAtualId: number;
  onAtualizado: () => void;
  accent: string;
}

export function PainelPropriedades({ nota, usuarioAtualId, onAtualizado, accent }: PainelPropriedadesProps) {
  const [processando, setProcessando] = useState(false);
  const tabs = useNotasWorkspace((state) => state.tabs);
  const fecharAba = useNotasWorkspace((state) => state.fecharAba);
  const removerNotificacoesDaNota = useNotasNotificacoes((state) => state.removerNotificacoesDaNota);

  // Chamado ao arquivar/excluir a partir da Central — a nota pode estar aberta como aba na
  // barra global ao mesmo tempo; sem isso a aba fica "pendurada" apontando para uma nota que
  // não está mais ativa, e notificações/rascunhos antigos continuam referenciando-a.
  function limparResquiciosDaNota(noteId: string) {
    const tabAberta = tabs.find((tab) => tab.noteId === noteId);
    if (tabAberta) {
      fecharAba(tabAberta.id);
      void FecharAbaNota(noteId);
    }
    removerNotificacoesDaNota(noteId);
    limparRascunhoLocalDaNota(noteId);
  }

  async function toggleFixar() {
    setProcessando(true);
    const res = await FixarNota({ noteId: nota.id, fixada: !nota.isPinned });
    setProcessando(false);
    if (!res.success) {
      toast.error(res.error ?? "Não foi possível fixar a nota");
      return;
    }
    onAtualizado();
  }

  async function toggleFavorito() {
    setProcessando(true);
    await FavoritarNota({ noteId: nota.id, favorita: !nota.isFavorite });
    setProcessando(false);
    onAtualizado();
  }

  async function arquivar() {
    setProcessando(true);
    await ArquivarNota(nota.id);
    setProcessando(false);
    limparResquiciosDaNota(nota.id);
    toast.success("Nota arquivada");
    onAtualizado();
  }

  async function moverParaLixeira() {
    setProcessando(true);
    await MoverNotaParaLixeira(nota.id);
    setProcessando(false);
    limparResquiciosDaNota(nota.id);
    toast.success("Nota movida para a lixeira");
    onAtualizado();
  }

  async function excluirDefinitivamente() {
    setProcessando(true);
    const res = await ExcluirNotaDefinitivamente(nota.id);
    setProcessando(false);
    if (!res.success) {
      toast.error(res.error ?? "Não foi possível excluir a nota");
      return;
    }
    limparResquiciosDaNota(nota.id);
    toast.success("Nota excluída definitivamente");
    onAtualizado();
  }

  return (
    <div className="flex h-full w-64 shrink-0 flex-col gap-4 overflow-y-auto p-4">
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-600">Ações</p>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={processando}
            onClick={() => void toggleFixar()}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs",
              !nota.isPinned && "text-slate-400 hover:bg-white/5",
            )}
            style={nota.isPinned ? { color: `rgba(${accent},1)` } : undefined}
          >
            <Pin size={13} /> {nota.isPinned ? "Desafixar" : "Fixar"}
          </button>
          <button
            type="button"
            disabled={processando}
            onClick={() => void toggleFavorito()}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs",
              !nota.isFavorite && "text-slate-400 hover:bg-white/5",
            )}
            style={nota.isFavorite ? { color: `rgba(${accent},1)` } : undefined}
          >
            <Star size={13} /> {nota.isFavorite ? "Remover dos favoritos" : "Favoritar"}
          </button>
          <NoteShareDialog
            noteId={nota.id}
            trigger={
              <button type="button" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-400 hover:bg-white/5">
                <Share2 size={13} /> Compartilhar
              </button>
            }
          />
          <NoteHistoryDialog
            noteId={nota.id}
            onRestaurado={onAtualizado}
            trigger={
              <button type="button" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-400 hover:bg-white/5">
                <History size={13} /> Histórico de versões
              </button>
            }
          />
          <CriarLembreteDialog
            noteId={nota.id}
            trigger={
              <button type="button" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-400 hover:bg-white/5">
                <Bell size={13} /> Lembretes
              </button>
            }
          />
          {nota.status !== "ARQUIVADA" && (
            <button
              type="button"
              disabled={processando}
              onClick={() => void arquivar()}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-400 hover:bg-white/5"
            >
              <Archive size={13} /> Arquivar
            </button>
          )}
          {nota.status !== "LIXEIRA" && (
            <button
              type="button"
              disabled={processando}
              onClick={() => void moverParaLixeira()}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10"
            >
              <Trash2 size={13} /> Mover para a lixeira
            </button>
          )}
          {nota.status === "LIXEIRA" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={processando}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 size={13} /> Excluir definitivamente
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir definitivamente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. A nota e seu histórico serão removidos permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void excluirDefinitivamente()}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {nota.contexts.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-600">
            <Link2 size={11} /> Contexto
          </p>
          {nota.contexts.map((contexto) => (
            <p key={contexto.moduleKey} className="text-xs text-slate-400">
              {contexto.displayName}
            </p>
          ))}
        </div>
      )}

      <div>
        <p className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-600">
          <TagIcon size={11} /> Etiquetas
        </p>
        {nota.tags.length === 0 && <p className="text-xs text-slate-600">Nenhuma etiqueta</p>}
        <div className="flex flex-wrap gap-1">
          {nota.tags.map(({ tag }) => (
            <span
              key={tag.id}
              className="rounded-full border px-2 py-0.5 text-[10px]"
              style={{ borderColor: tag.color, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      </div>

      <ListaAnexos noteId={nota.id} />

      {nota.visibility !== "PRIVADA" && (
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-600">
          <MessageSquare size={11} /> Comentários
        </div>
      )}
      {nota.visibility !== "PRIVADA" && <NoteCommentsPanel noteId={nota.id} usuarioAtualId={usuarioAtualId} />}

      <div className="mt-auto text-[10px] text-slate-600">
        <p>Autor: {nota.owner.nome}</p>
        <p>Criada em: {new Date(nota.createdAt).toLocaleDateString("pt-BR")}</p>
        <p>Atualizada em: {new Date(nota.updatedAt).toLocaleDateString("pt-BR")}</p>
      </div>
    </div>
  );
}
