import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HoleriteAlertaPayload } from '@/actions/HoleriteAlertas';

interface HoleriteNotificacoesStore {
  alertaAtivo: HoleriteAlertaPayload | null;
  idsDescartados: number[];
  setAlerta: (alerta: HoleriteAlertaPayload) => void;
  descartarAlerta: (id: number) => void;
}

export const useHoleriteNotificacoes = create<HoleriteNotificacoesStore>()(
  persist(
    (set, get) => ({
      alertaAtivo: null,
      idsDescartados: [],
      setAlerta: (alerta) => {
        if (!get().idsDescartados.includes(alerta.id)) {
          set({ alertaAtivo: alerta });
        }
      },
      descartarAlerta: (id) =>
        set((state) => ({
          alertaAtivo: state.alertaAtivo?.id === id ? null : state.alertaAtivo,
          idsDescartados: [...state.idsDescartados.slice(-99), id],
        })),
    }),
    { name: 'holerite-notificacoes' }
  )
);
