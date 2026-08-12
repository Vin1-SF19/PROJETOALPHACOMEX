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
import { Dock, DockItem, DockIcon, DockLabel } from "@/components/ui/dock";
import { NoteShareDialog } from "@/components/Notas/Colaboracao/NoteShareDialog";
import { NoteHistoryDialog } from "@/components/Notas/Colaboracao/NoteHistoryDialog";
import { NoteCommentsPanel } from "@/components/Notas/Colaboracao/NoteCommentsPanel";
import { ListaAnexos } from "@/components/Notas/Anexos/ListaAnexos";
import { CriarLembreteDialog } from "@/components/Notas/Lembretes/CriarLembreteDialog";
import { notificarWorkspaceNotasAtualizado } from "@/lib/notas-workspace-messages";

interface PainelPropriedadesProps {
  nota: NotaListada;
  usuarioAtualId: number;
  onAtualizado: () => void;
  accent: string;
}

export function PainelPropriedades({ nota, usuarioAtualId, onAtualizado, accent }: PainelPropriedadesProps) {
  const [processando, setProcessando] = useState(false);
  const tabs = useNotasWorkspace((state) => state.tabs);
  const removerAbaPorNota = useNotasWorkspace((state) => state.removerAbaPorNota);
  const abrirAba = useNotasWorkspace((state) => state.abrirAba);
  const definirPinnedAba = useNotasWorkspace((state) => state.definirPinnedAba);
  const removerNotificacoesDaNota = useNotasNotificacoes((state) => state.removerNotificacoesDaNota);

  // Chamado ao arquivar/excluir a partir da Central — a nota pode estar aberta como aba na
  // barra global ao mesmo tempo; sem isso a aba fica "pendurada" apontando para uma nota que
  // não está mais ativa, e notificações/rascunhos antigos continuam referenciando-a.
  function limparResquiciosDaNota(noteId: string) {
    const tabAberta = tabs.find((tab) => tab.noteId === noteId);
    if (tabAberta) {
      removerAbaPorNota(noteId);
      void FecharAbaNota(noteId);
    }
    removerNotificacoesDaNota(noteId);
    limparRascunhoLocalDaNota(noteId);
    notificarWorkspaceNotasAtualizado();
  }

  async function toggleFixar() {
    const fixada = !nota.isPinned;
    setProcessando(true);
    const res = await FixarNota({ noteId: nota.id, fixada });
    setProcessando(false);
    if (!res.success) {
      toast.error(res.error ?? "Não foi possível fixar a nota");
      return;
    }
    if (fixada && !tabs.some((tab) => tab.noteId === nota.id)) {
      abrirAba(nota.id, nota.title, { pinned: true, color: nota.color });
    }
    definirPinnedAba(nota.id, fixada);
    notificarWorkspaceNotasAtualizado();
    toast.success(fixada ? "Nota fixada na barra de tarefas" : "Nota desafixada");
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
    <aside
      aria-label="Ações e propriedades da nota"
      className="custom-scrollbar flex h-full min-h-0 w-64 shrink-0 flex-col gap-4 overflow-y-auto overscroll-contain p-4 pr-3 [scrollbar-gutter:stable]"
    >
      <div data-guia-notas="propriedades-acoes">
        <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-600">Ações</p>
        <Dock orientation="vertical" magnification={40} distance={70} className="gap-0.5">
          <DockItem>
            <button
              type="button"
              disabled={processando}
              onClick={() => void toggleFixar()}
              data-guia-notas="acao-fixar"
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 h-8 text-left text-xs",
                !nota.isPinned && "text-slate-400 hover:bg-white/5",
              )}
              style={nota.isPinned ? { color: `rgba(${accent},1)` } : undefined}
            >
              <DockIcon><Pin size={13} /></DockIcon>
              <DockLabel>{nota.isPinned ? "Desafixar" : "Fixar"}</DockLabel>
            </button>
          </DockItem>

          <DockItem>
            <button
              type="button"
              disabled={processando}
              onClick={() => void toggleFavorito()}
              data-guia-notas="acao-favoritar"
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 h-8 text-left text-xs",
                !nota.isFavorite && "text-slate-400 hover:bg-white/5",
              )}
              style={nota.isFavorite ? { color: `rgba(${accent},1)` } : undefined}
            >
              <DockIcon><Star size={13} /></DockIcon>
              <DockLabel>{nota.isFavorite ? "Remover dos favoritos" : "Favoritar"}</DockLabel>
            </button>
          </DockItem>

          <DockItem>
            <NoteShareDialog
              noteId={nota.id}
              trigger={
                <button type="button" data-guia-notas="acao-compartilhar" className="flex w-full items-center gap-2 rounded-lg px-2 h-8 text-left text-xs text-slate-400 hover:bg-white/5">
                  <DockIcon><Share2 size={13} /></DockIcon>
                  <DockLabel>Compartilhar</DockLabel>
                </button>
              }
            />
          </DockItem>

          <DockItem>
            <NoteHistoryDialog
              noteId={nota.id}
              onRestaurado={onAtualizado}
              trigger={
                <button type="button" data-guia-notas="acao-historico" className="flex w-full items-center gap-2 rounded-lg px-2 h-8 text-left text-xs text-slate-400 hover:bg-white/5">
                  <DockIcon><History size={13} /></DockIcon>
                  <DockLabel>Histórico de versões</DockLabel>
                </button>
              }
            />
          </DockItem>

          <DockItem>
            <CriarLembreteDialog
              noteId={nota.id}
              trigger={
                <button type="button" data-guia-notas="acao-lembretes" className="flex w-full items-center gap-2 rounded-lg px-2 h-8 text-left text-xs text-slate-400 hover:bg-white/5">
                  <DockIcon><Bell size={13} /></DockIcon>
                  <DockLabel>Lembretes</DockLabel>
                </button>
              }
            />
          </DockItem>

          {nota.status !== "ARQUIVADA" && (
            <DockItem>
              <button
                type="button"
                disabled={processando}
                onClick={() => void arquivar()}
                data-guia-notas="acao-arquivar"
                className="flex w-full items-center gap-2 rounded-lg px-2 h-8 text-left text-xs text-slate-400 hover:bg-white/5"
              >
                <DockIcon><Archive size={13} /></DockIcon>
                <DockLabel>Arquivar</DockLabel>
              </button>
            </DockItem>
          )}

          {nota.status !== "LIXEIRA" && (
            <DockItem>
              <button
                type="button"
                disabled={processando}
                onClick={() => void moverParaLixeira()}
                data-guia-notas="acao-lixeira"
                className="flex w-full items-center gap-2 rounded-lg px-2 h-8 text-left text-xs text-rose-400 hover:bg-rose-500/10"
              >
                <DockIcon><Trash2 size={13} /></DockIcon>
                <DockLabel>Mover para a lixeira</DockLabel>
              </button>
            </DockItem>
          )}

          {nota.status === "LIXEIRA" && (
            <DockItem>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={processando}
                    data-guia-notas="acao-excluir-definitivo"
                    className="flex w-full items-center gap-2 rounded-lg px-2 h-8 text-left text-xs text-rose-400 hover:bg-rose-500/10"
                  >
                    <DockIcon><Trash2 size={13} /></DockIcon>
                    <DockLabel>Excluir definitivamente</DockLabel>
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
            </DockItem>
          )}
        </Dock>
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

      <div data-guia-notas="propriedades-etiquetas">
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

      <div data-guia-notas="propriedades-anexos">
        <ListaAnexos noteId={nota.id} accent={accent} />
      </div>

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
    </aside>
  );
}
