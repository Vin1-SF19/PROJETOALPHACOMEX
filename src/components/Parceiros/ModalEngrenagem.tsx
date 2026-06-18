"use client";

import { useEffect, useState } from "react";
import { X, Settings, Loader2, Pencil, Trash2, Shield } from "lucide-react";
import { listarAcessosParceiros, salvarAcessoParceiro } from "@/actions/parceiros";

type Usuario = { id: number; nome: string; email: string; role: string };
type Acesso = { userId: number; podeEditar: boolean; podeExcluir: boolean };

export default function ModalEngrenagem({
  open, onClose, accent,
}: {
  open: boolean;
  onClose: () => void;
  accent: string;
}) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [acessos, setAcessos] = useState<Record<number, Acesso>>({});
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    listarAcessosParceiros()
      .then(({ acessos, usuarios }) => {
        setUsuarios(usuarios);
        const map: Record<number, Acesso> = {};
        for (const a of acessos) map[a.userId] = { userId: a.userId, podeEditar: a.podeEditar, podeExcluir: a.podeExcluir };
        setAcessos(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const isAdminRole = (r: string) => r === "Admin" || r === "CEO";

  const toggle = async (userId: number, campo: "podeEditar" | "podeExcluir") => {
    const atual = acessos[userId] ?? { userId, podeEditar: false, podeExcluir: false };
    const novo = { ...atual, [campo]: !atual[campo] };
    // exclusão implica edição liberada (não dá pra excluir sem ver/editar)
    if (campo === "podeExcluir" && novo.podeExcluir) novo.podeEditar = true;
    setAcessos(prev => ({ ...prev, [userId]: novo }));
    setSavingId(userId);
    await salvarAcessoParceiro(userId, novo.podeEditar, novo.podeExcluir);
    setSavingId(null);
  };

  const filtrados = usuarios.filter(u =>
    !busca.trim() || u.nome.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(2,6,23,0.8)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-3xl overflow-hidden" style={{ background: "#0a1020", border: `1px solid rgba(${accent},0.3)`, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid rgba(${accent},0.15)` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl grid place-items-center" style={{ background: `rgba(${accent},0.15)` }}>
              <Settings size={16} style={{ color: `rgba(${accent},1)` }} />
            </div>
            <div>
              <h2 className="text-[15px] font-black text-white">Controle de Acesso</h2>
              <p className="text-[10px] text-slate-500">Quem pode editar e excluir parceiros</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>

        <div className="px-5 pt-3 shrink-0">
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar usuário…"
            className="w-full h-10 rounded-xl px-3 text-[12px] outline-none" style={{ background: "rgba(15,23,42,0.6)", border: `1px solid rgba(${accent},0.2)`, color: "#e2e8f0" }} />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 size={22} className="animate-spin" style={{ color: `rgba(${accent},1)` }} /></div>
          ) : filtrados.map(u => {
            const admin = isAdminRole(u.role);
            const a = acessos[u.id] ?? { userId: u.id, podeEditar: false, podeExcluir: false };
            return (
              <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(15,23,42,0.5)", border: "1px solid rgba(99,102,241,0.12)" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-bold text-slate-200 truncate flex items-center gap-1.5">
                    {u.nome}
                    {admin && <span className="flex items-center gap-0.5 text-[8.5px] font-black uppercase text-amber-400"><Shield size={9} /> {u.role}</span>}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                </div>
                {savingId === u.id && <Loader2 size={12} className="animate-spin text-slate-500" />}
                {admin ? (
                  <span className="text-[9px] font-black uppercase text-emerald-400">Acesso total</span>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {([["podeEditar", Pencil, "Editar"], ["podeExcluir", Trash2, "Excluir"]] as const).map(([campo, Icon, label]) => {
                      const on = a[campo];
                      return (
                        <button key={campo} type="button" onClick={() => toggle(u.id, campo)}
                          title={label}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                          style={{
                            background: on ? (campo === "podeExcluir" ? "rgba(239,68,68,0.2)" : `rgba(${accent},0.2)`) : "rgba(255,255,255,0.04)",
                            border: `1px solid ${on ? (campo === "podeExcluir" ? "rgba(239,68,68,0.5)" : `rgba(${accent},0.5)`) : "rgba(255,255,255,0.1)"}`,
                            color: on ? (campo === "podeExcluir" ? "#fca5a5" : `rgba(${accent},1)`) : "#64748b",
                          }}>
                          <Icon size={11} /> {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
