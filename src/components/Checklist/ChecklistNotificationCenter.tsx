"use client";
import { useState } from "react";
import { Bell } from "lucide-react";
import { useChecklistNotificacoes } from "@/store/useChecklistNotificacoes";
import { abrirChecklistNoPainel } from "@/lib/checklist/client/notificacoes";
export default function ChecklistNotificationCenter() {
  const [open, setOpen] = useState(false);
  const store = useChecklistNotificacoes();
  return (
    <div className="relative">
      <button aria-label="Alertas do checklist" onClick={() => setOpen((v) => !v)} className="rounded-xl p-2 text-slate-300">
        <Bell size={18} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 w-80 space-y-3 rounded-2xl border border-white/10 bg-slate-950 p-4">
          <p className="text-sm text-white">Atualizações de checklist</p>
          {store.erro && (
            <p role="alert" className="text-xs text-rose-300">
              {store.erro}
            </p>
          )}
          {!store.notificacoes.length && <p className="text-xs text-slate-400">Nenhuma atualização.</p>}
          {store.notificacoes.map((n) => (
            <button
              key={n.id}
              onClick={() =>
                void store.marcarLida(n.id).then((ok) => {
                  if (ok) {
                    setOpen(false);
                    abrirChecklistNoPainel(n.empresaId);
                  }
                })
              }
              className="block w-full rounded-lg p-2 text-left text-xs text-slate-300 hover:bg-white/5"
            >
              {n.titulo}
              {!n.lida && " · não lida"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
