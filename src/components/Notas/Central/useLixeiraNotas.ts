"use client";

import { useState } from "react";
import { toast } from "sonner";
import { EsvaziarLixeira, ExcluirNotasDefinitivamente, RestaurarNota } from "@/actions/Notas";
import { limparRascunhoLocalDaNota } from "@/lib/notas-tabs";
import { useNotasNotificacoes } from "@/store/useNotasNotificacoes";
import { useNotasWorkspace } from "@/store/useNotasWorkspace";
import type { NotaListada } from "./ListaNotas";
import { notificarWorkspaceNotasAtualizado } from "@/lib/notas-workspace-messages";

interface UseLixeiraNotasParams {
  notas: NotaListada[];
  onRecarregar: () => void;
  onLimparNotaAberta: () => void;
  onVoltarPrimeiraPagina: () => void;
}

export function useLixeiraNotas({
  notas,
  onRecarregar,
  onLimparNotaAberta,
  onVoltarPrimeiraPagina,
}: UseLixeiraNotasParams) {
  const [modoSelecao, setModoSelecao] = useState(false);
  const [notasSelecionadas, setNotasSelecionadas] = useState<Set<string>>(new Set());
  const [processando, setProcessando] = useState(false);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const removerAbaPorNota = useNotasWorkspace((state) => state.removerAbaPorNota);
  const removerNotificacoesDaNota = useNotasNotificacoes((state) => state.removerNotificacoesDaNota);

  function limparReferenciasLocais(noteIds: Iterable<string>) {
    for (const noteId of noteIds) {
      removerAbaPorNota(noteId);
      removerNotificacoesDaNota(noteId);
      limparRascunhoLocalDaNota(noteId);
    }
  }

  function ativarSelecao() {
    setModoSelecao(true);
    setNotasSelecionadas(new Set());
    onLimparNotaAberta();
  }

  function cancelarSelecao() {
    setModoSelecao(false);
    setNotasSelecionadas(new Set());
  }

  function toggleSelecionada(noteId: string) {
    setNotasSelecionadas((atuais) => {
      const proximas = new Set(atuais);
      if (proximas.has(noteId)) proximas.delete(noteId);
      else proximas.add(noteId);
      return proximas;
    });
  }

  async function restaurar(noteId: string) {
    if (processando) return;

    setProcessando(true);
    setRestaurandoId(noteId);
    try {
      const res = await RestaurarNota(noteId);
      if (!res.success) {
        toast.error(res.error ?? "Não foi possível restaurar a nota");
        return;
      }

      notificarWorkspaceNotasAtualizado();
      cancelarSelecao();
      onLimparNotaAberta();
      onVoltarPrimeiraPagina();
      onRecarregar();
      toast.success("Nota restaurada");
    } catch {
      toast.error("Não foi possível restaurar a nota");
    } finally {
      setRestaurandoId(null);
      setProcessando(false);
    }
  }

  async function excluirSelecionadas() {
    const noteIds = [...notasSelecionadas];
    if (noteIds.length === 0) return;

    setProcessando(true);
    const res = await ExcluirNotasDefinitivamente({ noteIds });
    setProcessando(false);
    if (!res.success) {
      toast.error(res.error ?? "Não foi possível excluir as notas selecionadas");
      return;
    }

    limparReferenciasLocais(noteIds);
    notificarWorkspaceNotasAtualizado();
    cancelarSelecao();
    onVoltarPrimeiraPagina();
    onRecarregar();
    toast.success(`${res.count} nota${res.count === 1 ? " excluída" : "s excluídas"} definitivamente`);
  }

  async function esvaziar() {
    setProcessando(true);
    const res = await EsvaziarLixeira();
    setProcessando(false);
    if (!res.success) {
      toast.error(res.error ?? "Não foi possível esvaziar a lixeira");
      return;
    }

    limparReferenciasLocais(notas.map((nota) => nota.id));
    notificarWorkspaceNotasAtualizado();
    cancelarSelecao();
    onLimparNotaAberta();
    onVoltarPrimeiraPagina();
    onRecarregar();
    toast.success(res.count === 0 ? "A lixeira já estava vazia" : `Lixeira esvaziada: ${res.count} nota${res.count === 1 ? " removida" : "s removidas"}`);
  }

  return {
    modoSelecao,
    notasSelecionadas,
    processando,
    restaurandoId,
    ativarSelecao,
    cancelarSelecao,
    toggleSelecionada,
    restaurar,
    excluirSelecionadas,
    esvaziar,
  };
}
