import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HoleriteAlertaPayload } from '@/actions/HoleriteAlertas';

interface HoleriteNotificacoesStore {
  alertaAtivo: HoleriteAlertaPayload | null;
  alertaLido: boolean;
  idsDescartados: number[];
  setAlerta: (alerta: HoleriteAlertaPayload) => void;
  marcarAlertaComoLido: () => void;
  descartarAlerta: (id: number) => void;
}

export const useHoleriteNotificacoes = create<HoleriteNotificacoesStore>()(
  persist(
    (set, get) => ({
      alertaAtivo: null,
      alertaLido: false,
      idsDescartados: [],
      setAlerta: (alerta) => {
        if (!get().idsDescartados.includes(alerta.id)) {
          const mesmoAlerta = get().alertaAtivo?.id === alerta.id;
          set({
            alertaAtivo: alerta,
            alertaLido: mesmoAlerta ? get().alertaLido : false,
          });
        }
      },
      marcarAlertaComoLido: () => set({ alertaLido: true }),
      descartarAlerta: (id) =>
        set((state) => ({
          alertaAtivo: state.alertaAtivo?.id === id ? null : state.alertaAtivo,
          alertaLido: state.alertaAtivo?.id === id ? true : state.alertaLido,
          idsDescartados: [...state.idsDescartados.slice(-99), id],
        })),
    }),
    { name: 'holerite-notificacoes' }
  )
);
