"use client";
import { useEffect, useState } from "react";
import { useChecklistNotificacoes } from "@/store/useChecklistNotificacoes";
interface Props {
  onAbrir: (url: string, label: string) => void;
}
export default function ChecklistNotificationToast({ onAbrir }: Props) {
  const latest = useChecklistNotificacoes((s) => s.ultimoEventoId),
    [dismissed, setDismissed] = useState<string | null>(null);
  const store = useChecklistNotificacoes();
  useEffect(() => {
    const timer = setTimeout(() => setDismissed(latest), 6000);
    return () => clearTimeout(timer);
  }, [latest]);
  const n = store.notificacoes.find((n) => n.id === latest && n.id !== dismissed && !n.lida);
  if (!n) return null;
  return (
    <aside role="status" className="fixed bottom-6 right-6 z-[200] w-80 rounded-2xl border border-white/15 bg-slate-950 p-4 text-white shadow-2xl">
      <div className="flex items-start gap-2">
        <button
          className="flex-1 text-left"
          onClick={() =>
            void store.marcarLida(n.id).then((ok) => {
              if (ok) {
                setDismissed(latest);
                onAbrir(`/PainelAlpha/CheckList/${encodeURIComponent(n.empresaId)}`, "Checklist");
              }
            })
          }
        >
          <p className="text-xs font-semibold text-slate-400">Checklist atualizado</p>
          <p className="mt-2 text-sm">{n.titulo}</p>
        </button>
        <button aria-label="Fechar aviso" onClick={() => setDismissed(latest)}>
          ×
        </button>
      </div>
      {store.erro && (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          {store.erro}
        </p>
      )}
    </aside>
  );
}
