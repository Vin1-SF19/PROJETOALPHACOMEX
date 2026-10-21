"use client";
import { create } from "zustand";
import type { AlertaTarefaBpm } from "@/lib/bpm/notificacoes-tarefas";

type Notificacao = AlertaTarefaBpm & { lida: boolean };
type Estado = {
  usuarioId: number; notificacoes: Notificacao[]; vistas: Set<string>; lidas: Set<string>; removidas: Set<string>;
  iniciarUsuario: (id: number) => void;
  sincronizar: (id: number, alertas: AlertaTarefaBpm[]) => Notificacao[];
  removerNotificacao: (id: string) => void;
  marcarLida: (id: string) => void;
  marcarTodasLidas: () => void;
};

const chave = (usuarioId: number) => `bpm_alertas_reconhecidos_v1_${usuarioId}`;
type Reconhecimento = Pick<Estado, "vistas" | "lidas" | "removidas">;
function carregar(usuarioId: number): Reconhecimento {
  const vazio = { vistas: new Set<string>(), lidas: new Set<string>(), removidas: new Set<string>() };
  if (typeof window === "undefined" || usuarioId <= 0) return vazio;
  try {
    const dados = JSON.parse(window.localStorage.getItem(chave(usuarioId)) ?? "null");
    if (!dados || typeof dados !== "object") return vazio;
    for (const campo of ["vistas", "lidas", "removidas"] as const) {
      if (Array.isArray(dados[campo])) vazio[campo] = new Set(dados[campo].filter((id: unknown): id is string => typeof id === "string"));
    }
  } catch { /* Armazenamento indisponível ou inválido: mantém o estado em memória. */ }
  return vazio;
}
function reconhecer(atual: Pick<Estado, "usuarioId"> & Reconhecimento): Reconhecimento {
  const salvo = carregar(atual.usuarioId);
  return {
    vistas: new Set([...salvo.vistas, ...atual.vistas]),
    lidas: new Set([...salvo.lidas, ...atual.lidas]),
    removidas: new Set([...salvo.removidas, ...atual.removidas]),
  };
}
function salvar(usuarioId: number, estado: Reconhecimento) {
  if (typeof window === "undefined" || usuarioId <= 0) return;
  try {
    window.localStorage.setItem(chave(usuarioId), JSON.stringify({
      vistas: [...estado.vistas], lidas: [...estado.lidas], removidas: [...estado.removidas],
    }));
  } catch { /* A falha de armazenamento não bloqueia as notificações. */ }
}

// Apenas identificadores de reconhecimento por usuário; nunca conteúdo de tarefas/clientes.
export const useBpmTarefasNotificacoes = create<Estado>((set, get) => ({
  usuarioId: 0, notificacoes: [], vistas: new Set(), lidas: new Set(), removidas: new Set(),
  iniciarUsuario: (id) => {
    if (get().usuarioId !== id) set({ usuarioId: id, notificacoes: [], ...carregar(id) });
  },
  sincronizar: (id, alertas) => {
    const atual = get();
    if (atual.usuarioId !== id) return [];
    const reconhecidas = reconhecer(atual);
    const unicos = [...new Map(alertas.map((item) => [item.id, item])).values()];
    const notificacoes = unicos.filter((item) => !reconhecidas.removidas.has(item.id))
      .map((item) => ({ ...item, lida: reconhecidas.lidas.has(item.id) }));
    const novas = notificacoes.filter((item) => !reconhecidas.vistas.has(item.id) && !item.lida);
    const proximo = { ...reconhecidas, vistas: new Set([...reconhecidas.vistas, ...unicos.map((item) => item.id)]) };
    salvar(id, proximo);
    set({ notificacoes, ...proximo });
    return novas;
  },
  removerNotificacao: (id) => {
    const atual = get(); const proximo = reconhecer(atual); proximo.removidas.add(id);
    salvar(atual.usuarioId, proximo);
    set({ ...proximo, notificacoes: atual.notificacoes.filter((item) => item.id !== id) });
  },
  marcarLida: (id) => {
    const atual = get(); const proximo = reconhecer(atual); proximo.lidas.add(id); proximo.vistas.add(id);
    salvar(atual.usuarioId, proximo);
    set({ ...proximo, notificacoes: atual.notificacoes.map((item) => item.id === id ? { ...item, lida: true } : item) });
  },
  marcarTodasLidas: () => {
    const atual = get(); const proximo = reconhecer(atual);
    for (const item of atual.notificacoes) { proximo.lidas.add(item.id); proximo.vistas.add(item.id); }
    salvar(atual.usuarioId, proximo);
    set({ ...proximo, notificacoes: atual.notificacoes.map((item) => ({ ...item, lida: true })) });
  },
}));
