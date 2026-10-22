"use client";
import { create } from "zustand";
import type { AlertaLeadBpm } from "@/lib/bpm/notificacoes-leads";

interface EstadoLeads {
  usuarioId: number;
  notificacoes: AlertaLeadBpm[];
  vistas: Set<string>;
  iniciarUsuario: (usuarioId: number) => void;
  sincronizar: (usuarioId: number, alertas: AlertaLeadBpm[]) => AlertaLeadBpm[];
}
const chave = (id: number) => `bpm_leads_vistos_v1_${id}`;
function carregar(id: number): Set<string> {
  if (typeof window === "undefined" || id <= 0) return new Set();
  try {
    const dados: unknown = JSON.parse(window.localStorage.getItem(chave(id)) ?? "[]");
    return new Set(Array.isArray(dados) ? dados.filter((v): v is string => typeof v === "string") : []);
  } catch { return new Set(); }
}

/** Somente o snapshot autorizado resolve pendências. Storage guarda apenas IDs de toasts vistos. */
export const useBpmLeadsNotificacoes = create<EstadoLeads>((set, get) => ({
  usuarioId: 0, notificacoes: [], vistas: new Set(),
  iniciarUsuario: (usuarioId) => {
    if (get().usuarioId !== usuarioId) set({ usuarioId, notificacoes: [], vistas: carregar(usuarioId) });
  },
  sincronizar: (usuarioId, alertas) => {
    const atual = get();
    if (atual.usuarioId !== usuarioId || usuarioId <= 0) return [];
    const notificacoes = [...new Map(alertas.map((item) => [item.id, item])).values()];
    const vistas = new Set([...carregar(usuarioId), ...atual.vistas]);
    const novas = notificacoes.filter((item) => !vistas.has(item.id));
    for (const item of notificacoes) vistas.add(item.id);
    try { window.localStorage.setItem(chave(usuarioId), JSON.stringify([...vistas])); } catch { /* Sem storage: dedupe em memória. */ }
    set({ notificacoes, vistas });
    return novas;
  },
}));
