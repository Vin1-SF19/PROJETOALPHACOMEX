"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConcluirTarefaBpm } from "@/actions/bpm/Tarefas";

type TarefaConclusao = { id: string; status: string; concluidaEm: Date | null };
type Confirmacao = { cardId: string; instante: Date; salvando: boolean };

export function useConclusaoTarefasBpm<T extends TarefaConclusao>(cardId: string, tarefas: T[], onAtualizado: () => void) {
  const [confirmacoes, setConfirmacoes] = useState<Record<string, Confirmacao>>({});
  const travas = useRef(new Set<string>());
  const cardAtual = useRef(cardId);
  useEffect(() => { cardAtual.current = cardId; }, [cardId]);
  useEffect(() => {
    // A confirmação local permanece até o servidor confirmar; snapshots antigos
    // ainda pendentes não devem desmarcar uma tarefa recém-concluída.
    setConfirmacoes((atuais) => {
      const proximas = { ...atuais };
      let alterou = false;
      for (const [id, item] of Object.entries(atuais)) {
        const tarefa = tarefas.find((t) => t.id === id);
        if (item.cardId !== cardId || (!item.salvando && (!tarefa || tarefa.status !== "PENDENTE"))) {
          delete proximas[id]; travas.current.delete(`${item.cardId}:${id}`); alterou = true;
        }
      }
      return alterou ? proximas : atuais;
    });
  }, [cardId, tarefas]);

  async function concluir(tarefa: T) {
    const chave = `${cardId}:${tarefa.id}`;
    if (tarefa.status !== "PENDENTE" || travas.current.has(chave)) return;
    travas.current.add(chave);
    const instante = new Date();
    setConfirmacoes((atuais) => ({ ...atuais, [tarefa.id]: { cardId, instante, salvando: true } }));
    try {
      const resultado = await ConcluirTarefaBpm({ tarefaId: tarefa.id });
      if (!resultado.success) throw new Error(typeof resultado.error === "string" ? resultado.error : "Não foi possível concluir a tarefa. Tente novamente.");
      if (cardAtual.current !== cardId) return;
      setConfirmacoes((atuais) => ({ ...atuais, [tarefa.id]: { cardId, instante, salvando: false } }));
      // Falha ao atualizar a lista não desfaz uma conclusão já persistida.
      try { void Promise.resolve(onAtualizado()).catch((error) => console.error("[TarefaBpm/atualizar-lista]", error)); }
      catch (error) { console.error("[TarefaBpm/atualizar-lista]", error); }
    } catch (error) {
      travas.current.delete(chave);
      if (cardAtual.current !== cardId) return;
      setConfirmacoes((atuais) => { const proximas = { ...atuais }; delete proximas[tarefa.id]; return proximas; });
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a tarefa. Tente novamente.");
    }
  }
  return {
    tarefas: tarefas.map((tarefa) => {
      const local = confirmacoes[tarefa.id];
      return local?.cardId === cardId && tarefa.status === "PENDENTE"
        ? { ...tarefa, status: "CONCLUIDA", concluidaEm: local.instante } : tarefa;
    }),
    salvando: (id: string) => confirmacoes[id]?.cardId === cardId && confirmacoes[id].salvando,
    concluir,
  };
}
