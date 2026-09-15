import { create } from "zustand";

import type { PendenciaUltimoCs } from "@/lib/cs-nps/alertas-ultimo-cs";

interface CsNpsNotificacoesStore {
  pendencias: PendenciaUltimoCs[];
  carregando: boolean;
  erro: string | null;
  lida: boolean;
  modalAberto: boolean;
  definirCarregando: (carregando: boolean) => void;
  definirPendencias: (pendencias: PendenciaUltimoCs[]) => void;
  definirErro: (erro: string | null) => void;
  marcarComoLida: () => void;
  abrirModal: () => void;
  fecharModal: () => void;
  limpar: () => void;
}

function assinatura(pendencias: PendenciaUltimoCs[]): string {
  return pendencias
    .map((item) => `${item.clienteServicoId}:${item.ultimoCsEm}`)
    .sort()
    .join("|");
}

export const useCsNpsNotificacoes = create<CsNpsNotificacoesStore>((set) => ({
  pendencias: [],
  carregando: false,
  erro: null,
  lida: false,
  modalAberto: false,
  definirCarregando: (carregando) => set({ carregando }),
  definirPendencias: (pendencias) => set((state) => ({
    pendencias,
    lida: pendencias.length === 0
      ? false
      : assinatura(pendencias) === assinatura(state.pendencias) && state.lida,
  })),
  definirErro: (erro) => set({ erro }),
  marcarComoLida: () => set({ lida: true }),
  abrirModal: () => set({ modalAberto: true, lida: true }),
  fecharModal: () => set({ modalAberto: false }),
  limpar: () => set({
    pendencias: [],
    carregando: false,
    erro: null,
    lida: false,
    modalAberto: false,
  }),
}));
