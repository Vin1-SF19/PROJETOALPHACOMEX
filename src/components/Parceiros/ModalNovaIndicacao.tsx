"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Search, Handshake, Building2, Loader2, Check, AlertTriangle } from "lucide-react";
import {
  listarParceirosSimples, listarClientesParaIndicacao, criarIndicacao,
} from "@/actions/parceiros";

type ParceiroSimples = { id: number; nome: string; nomeFantasia: string | null; documento: string; nivel: string };
type ClienteOpt = {
  id: number; razaoSocial: string; nomeFantasia: string | null; cnpj: string;
  indicacao: { parceiroId: number; status: string } | null;
};

export default function ModalNovaIndicacao({
  open, onClose, onDone, accent,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  accent: string;
}) {
  const [parceiros, setParceiros] = useState<ParceiroSimples[]>([]);
  const [parceiroId, setParceiroId] = useState<number | null>(null);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [loadingCli, setLoadingCli] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reset ao abrir o modal */
    setParceiroId(null); setClienteId(null); setBuscaCliente(""); setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    listarParceirosSimples().then(setParceiros).catch(() => setParceiros([]));
  }, [open]);

  const carregarClientes = useCallback((q: string) => {
    setLoadingCli(true);
    listarClientesParaIndicacao(q).then(setClientes).catch(() => setClientes([])).finally(() => setLoadingCli(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => carregarClientes(buscaCliente), 300);
    return () => clearTimeout(t);
  }, [open, buscaCliente, carregarClientes]);

  if (!open) return null;

  const vincular = async () => {
    if (!parceiroId || !clienteId) { setError("Selecione o parceiro e a empresa."); return; }
    setSaving(true); setError(null);
    const res = await criarIndicacao(parceiroId, clienteId);
    setSaving(false);
    if (!res.success) { setError(res.error ?? "Erro ao vincular"); return; }
    onDone();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(2,6,23,0.8)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-3xl overflow-hidden" style={{ background: "#0a1020", border: `1px solid rgba(${accent},0.3)`, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid rgba(${accent},0.15)` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl grid place-items-center" style={{ background: `rgba(${accent},0.15)` }}>
              <Handshake size={16} style={{ color: `rgba(${accent},1)` }} />
            </div>
            <h2 className="text-[15px] font-black text-white">Nova Indicação</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <AlertTriangle size={13} className="text-red-400 shrink-0" /><span className="text-[12px] text-red-300">{error}</span>
            </div>
          )}

          {/* Parceiro */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">1. Parceiro</label>
            <select value={parceiroId ?? ""} onChange={e => setParceiroId(e.target.value ? Number(e.target.value) : null)}
              className="w-full h-12 rounded-xl px-3 text-[13px] outline-none" style={{ background: "rgba(15,23,42,0.6)", border: `1px solid rgba(${accent},0.25)`, color: "#e2e8f0" }}>
              <option value="">Selecione o parceiro…</option>
              {parceiros.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.nivel})</option>)}
            </select>
          </div>

          {/* Empresa CS&NPS */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">2. Empresa indicada (CS &amp; NPS)</label>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} placeholder="Buscar empresa por nome ou CNPJ…"
                className="w-full h-11 rounded-xl pl-9 pr-3 text-[12px] outline-none" style={{ background: "rgba(15,23,42,0.6)", border: `1px solid rgba(${accent},0.2)`, color: "#e2e8f0" }} />
            </div>
            <div className="space-y-1 max-h-[240px] overflow-y-auto">
              {loadingCli ? (
                <div className="flex items-center gap-2 px-3 py-4 text-slate-500 text-[12px]"><Loader2 size={14} className="animate-spin" /> Carregando…</div>
              ) : clientes.length === 0 ? (
                <p className="px-3 py-4 text-[12px] text-slate-500 text-center">Nenhuma empresa encontrada.</p>
              ) : clientes.map(c => {
                const jaVinculada = c.indicacao?.status === "ATIVA";
                const ativo = clienteId === c.id;
                return (
                  <button key={c.id} type="button" disabled={jaVinculada} onClick={() => setClienteId(c.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: ativo ? `rgba(${accent},0.18)` : "rgba(15,23,42,0.5)", border: `1px solid ${ativo ? `rgba(${accent},0.5)` : "rgba(99,102,241,0.12)"}` }}>
                    <Building2 size={14} className="shrink-0 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-bold text-slate-200 truncate">{c.razaoSocial}</p>
                      <p className="text-[10px] text-slate-500 truncate">
                        <span className="font-mono">{c.cnpj}</span>{c.nomeFantasia ? ` · ${c.nomeFantasia}` : ""}
                      </p>
                    </div>
                    {jaVinculada && <span className="text-[9px] font-black uppercase text-amber-400 shrink-0">Já vinculada</span>}
                    {ativo && <Check size={15} style={{ color: `rgba(${accent},1)` }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 shrink-0 flex justify-end gap-2" style={{ borderTop: `1px solid rgba(${accent},0.15)` }}>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[12px] font-bold text-slate-400 hover:text-white">Cancelar</button>
          <button onClick={vincular} disabled={saving || !parceiroId || !clienteId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-widest text-white disabled:opacity-40"
            style={{ background: `rgba(${accent},1)` }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Handshake size={14} />} Vincular indicação
          </button>
        </div>
      </div>
    </div>
  );
}
