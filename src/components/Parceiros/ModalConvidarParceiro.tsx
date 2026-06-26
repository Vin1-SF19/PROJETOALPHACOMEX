"use client";

import { useEffect, useState } from "react";
import { X, Link2, Copy, Check, Loader2, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { gerarConvite, listarConvites, revogarConvite } from "@/actions/convites-parceiro";

const VALIDADES = [
  { dias: 1, label: "1 dia" },
  { dias: 3, label: "3 dias" },
  { dias: 7, label: "7 dias" },
  { dias: 15, label: "15 dias" },
  { dias: 30, label: "30 dias" },
];

type ConviteItem = {
  id: number;
  token: string;
  status: string;
  expiraEm: string | Date;
  createdAt: string | Date;
  criadoPorUser: { nome: string } | null;
  criadoPorParceiro: { nome: string } | null;
  _count: { preCadastros: number };
};

export default function ModalConvidarParceiro({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [validade, setValidade] = useState(7);
  const [gerando, setGerando] = useState(false);
  const [convites, setConvites] = useState<ConviteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [agora, setAgora] = useState(0); // timestamp capturado no fetch (evita Date.now no render)

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const recarregar = () => {
    setLoading(true);
    setAgora(Date.now());
    listarConvites()
      .then(({ convites }) => setConvites(convites as ConviteItem[]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) recarregar();
  }, [open]);

  if (!open) return null;

  const linkDe = (token: string) => `${baseUrl}/convite/parceiro/${token}`;

  const handleGerar = async () => {
    setGerando(true);
    const res = await gerarConvite({ validadeDias: validade });
    setGerando(false);
    if (res.success && res.convite) {
      const link = linkDe(res.convite.token);
      await navigator.clipboard.writeText(link).catch(() => {});
      toast.success("Link gerado e copiado!");
      recarregar();
    } else {
      toast.error(res.error ?? "Falha ao gerar convite");
    }
  };

  const copiar = async (token: string) => {
    await navigator.clipboard.writeText(linkDe(token)).catch(() => {});
    setCopiado(token);
    setTimeout(() => setCopiado(null), 1800);
  };

  const handleRevogar = async (id: number) => {
    const res = await revogarConvite(id);
    if (res.success) { toast.success("Convite revogado"); recarregar(); }
    else toast.error("Falha ao revogar");
  };

  const fmtData = (d: string | Date) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const expirado = (c: ConviteItem) => agora > 0 && new Date(c.expiraEm).getTime() < agora;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl overflow-hidden" style={{ background: "#0a1020", border: "1px solid rgba(255,255,255,0.1)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20"><Link2 size={16} className="text-blue-400" /></div>
            <h2 className="text-sm font-black text-white uppercase tracking-tight">Convidar Parceiro</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all"><X size={16} /></button>
        </div>

        {/* Gerar novo */}
        <div className="px-6 py-4 border-b border-white/5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Validade do link</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {VALIDADES.map((v) => (
              <button
                key={v.dias}
                onClick={() => setValidade(v.dias)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                style={{
                  background: validade === v.dias ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.03)",
                  border: validade === v.dias ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  color: validade === v.dias ? "#93c5fd" : "#64748b",
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleGerar}
            disabled={gerando}
            className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {gerando ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            Gerar link de convite
          </button>
        </div>

        {/* Lista de convites */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Convites gerados</p>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-slate-500" /></div>
          ) : convites.length === 0 ? (
            <p className="text-[12px] text-slate-600 py-6 text-center">Nenhum convite gerado ainda.</p>
          ) : (
            convites.map((c) => {
              const status = c.status === "REVOGADO" ? "REVOGADO" : c.status === "USADO" ? "USADO" : expirado(c) ? "EXPIRADO" : "ATIVO";
              const cor = status === "ATIVO" ? "#34d399" : status === "USADO" ? "#60a5fa" : "#f87171";
              return (
                <div key={c.id} className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: `${cor}1a`, color: cor }}>{status}</span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1"><Clock size={9} /> expira {fmtData(c.expiraEm)}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 truncate mt-1">
                      por {c.criadoPorUser?.nome ?? c.criadoPorParceiro?.nome ?? "—"} · {c._count.preCadastros} resposta(s)
                    </p>
                  </div>
                  {status === "ATIVO" && (
                    <button onClick={() => copiar(c.token)} className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-white/5 transition-all" title="Copiar link">
                      {copiado === c.token ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  )}
                  {(status === "ATIVO" || status === "EXPIRADO") && (
                    <button onClick={() => handleRevogar(c.id)} className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-white/5 transition-all" title="Revogar">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
