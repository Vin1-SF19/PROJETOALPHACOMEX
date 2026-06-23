"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Handshake, Plus, Settings, Trash2, X, Loader2, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";
import ParceiroCard, { type CardParceiro } from "./ParceiroCard";
import ModalNovaIndicacao from "./ModalNovaIndicacao";
import ModalEngrenagem from "./ModalEngrenagem";
import ModalTermo from "./ModalTermo";
import { excluirParceiros } from "@/actions/parceiros";
import { getTema } from "@/lib/temas";

type Permissao = { isAdmin: boolean; podeEditar: boolean; podeExcluir: boolean };

type Props = {
  parceiros: CardParceiro[];
  temaName: string;
  busca?: string;
  nivel?: string;
  permissao: Permissao;
};

export default function ParceirosClient({ parceiros, temaName, busca, nivel, permissao }: Props) {
  const tema = getTema(temaName);
  const accent = tema.accent;
  const router = useRouter();

  const [novaIndicacaoOpen, setNovaIndicacaoOpen] = useState(false);
  const [engrenagemOpen, setEngrenagemOpen] = useState(false);
  const [termoOpen, setTermoOpen] = useState(false);
  const [modoExclusao, setModoExclusao] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const toggleSelect = (id: number) =>
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const sairExclusao = () => { setModoExclusao(false); setSelecionados(new Set()); };

  const confirmarExclusao = async () => {
    setExcluindo(true);
    const res = await excluirParceiros([...selecionados]);
    setExcluindo(false);
    setConfirmOpen(false);
    if (res.success) {
      toast.success(`${res.count} parceiro(s) excluído(s)`);
      sairExclusao();
      router.refresh();
    } else {
      toast.error(res.error ?? "Erro ao excluir");
    }
  };

  const selecionadosNomes = parceiros.filter(p => selecionados.has(p.id)).map(p => p.nome);

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl border" style={{ background: `rgba(${accent}, 0.1)`, borderColor: `rgba(${accent}, 0.25)` }}>
              <Handshake size={22} style={{ color: `rgba(${accent}, 1)` }} />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase italic tracking-tight text-white">Parceiros</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                {parceiros.length} parceiro{parceiros.length !== 1 ? "s" : ""} cadastrado{parceiros.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Engrenagem — só Admin */}
            {permissao.isAdmin && (
              <button onClick={() => setEngrenagemOpen(true)} title="Controle de acesso"
                className="h-11 w-11 grid place-items-center rounded-2xl border text-slate-400 hover:text-white transition-all"
                style={{ borderColor: `rgba(${accent}, 0.25)`, background: `rgba(${accent}, 0.06)` }}>
                <Settings size={17} />
              </button>
            )}

            {/* Excluir parceiro — quem pode excluir */}
            {permissao.podeExcluir && !modoExclusao && (
              <button onClick={() => setModoExclusao(true)}
                className="h-11 px-4 flex items-center gap-2 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all"
                style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5" }}>
                <Trash2 size={14} /> Excluir parceiro
              </button>
            )}

            {/* Atualizar termo — só Admin */}
            {permissao.isAdmin && (
              <button onClick={() => setTermoOpen(true)}
                className="h-11 px-4 flex items-center gap-2 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all text-slate-200"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <FileText size={14} /> Atualizar termo
              </button>
            )}

            {/* Nova Indicação — quem pode editar */}
            {permissao.podeEditar && (
              <button onClick={() => setNovaIndicacaoOpen(true)}
                className="h-11 px-4 flex items-center gap-2 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all text-white"
                style={{ background: `rgba(${accent}, 0.85)` }}>
                <Handshake size={14} /> Nova Indicação
              </button>
            )}

            <Link href="/PainelAlpha/Parceiros/novo"
              className="h-11 px-4 flex items-center gap-2 font-black uppercase text-[11px] tracking-widest rounded-2xl transition-all text-black"
              style={{ background: `rgba(${accent}, 1)` }}>
              <Plus size={14} /> Novo Parceiro
            </Link>
          </div>
        </header>

        {/* Barra do modo exclusão */}
        {modoExclusao && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <span className="text-[12px] font-bold text-red-300">
              {selecionados.size === 0 ? "Selecione os parceiros que deseja excluir" : `${selecionados.size} selecionado(s)`}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={sairExclusao} className="h-9 px-3 flex items-center gap-1.5 rounded-xl text-[11px] font-bold text-slate-300 bg-white/5 hover:bg-white/10">
                <X size={13} /> Cancelar
              </button>
              <button onClick={() => setConfirmOpen(true)} disabled={selecionados.size === 0}
                className="h-9 px-3 flex items-center gap-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-40"
                style={{ background: "#dc2626" }}>
                <Trash2 size={13} /> Apagar selecionados
              </button>
            </div>
          </div>
        )}

        {/* Filtros */}
        {!modoExclusao && (
          <form method="GET" className="flex flex-wrap gap-3">
            <input name="busca" defaultValue={busca ?? ""} placeholder="Buscar por nome, documento ou e-mail..."
              className="flex-1 min-w-[200px] h-11 bg-black/40 border border-white/10 rounded-2xl px-4 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none" />
            <select name="nivel" defaultValue={nivel ?? ""} className="h-11 bg-black/40 border border-white/10 rounded-2xl px-4 text-xs text-slate-400 uppercase font-black focus:outline-none">
              <option value="">Todos os Níveis</option>
              <option value="GOLD">★ GOLD</option>
              <option value="PLATINUM">◆ PLATINUM</option>
              <option value="BLACK">■ BLACK</option>
            </select>
            <button type="submit" className="h-11 px-5 text-white font-black uppercase text-xs tracking-widest rounded-2xl" style={{ background: `rgba(${accent}, 0.85)` }}>Filtrar</button>
          </form>
        )}

        {/* Lista */}
        {parceiros.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-600">
            <Handshake size={48} strokeWidth={1} />
            <p className="text-sm font-bold uppercase tracking-widest">Nenhum parceiro encontrado</p>
            <Link href="/PainelAlpha/Parceiros/novo" className="text-xs font-black uppercase tracking-widest hover:underline" style={{ color: `rgba(${accent}, 1)` }}>
              + Cadastrar primeiro parceiro
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {parceiros.map(p => (
              <ParceiroCard key={p.id} parceiro={p} selecionavel={modoExclusao} selecionado={selecionados.has(p.id)} onToggleSelect={toggleSelect} />
            ))}
          </div>
        )}
      </div>

      {/* Modais */}
      <ModalNovaIndicacao open={novaIndicacaoOpen} onClose={() => setNovaIndicacaoOpen(false)} onDone={() => router.refresh()} accent={accent} />
      <ModalEngrenagem open={engrenagemOpen} onClose={() => setEngrenagemOpen(false)} accent={accent} />
      <ModalTermo open={termoOpen} onClose={() => setTermoOpen(false)} accent={accent} />

      {/* Confirmação de exclusão */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(2,6,23,0.85)", backdropFilter: "blur(6px)" }} onClick={() => !excluindo && setConfirmOpen(false)}>
          <div className="w-full max-w-md rounded-3xl p-5" style={{ background: "#0a1020", border: "1px solid rgba(239,68,68,0.35)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: "rgba(239,68,68,0.12)" }}>
                <AlertTriangle size={17} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-[14px] font-black text-white">Excluir {selecionados.size} parceiro(s)?</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Esta ação é permanente e não pode ser desfeita.</p>
              </div>
            </div>
            <div className="max-h-32 overflow-y-auto mb-3 px-3 py-2 rounded-xl text-[11px] text-slate-300 space-y-0.5" style={{ background: "rgba(15,23,42,0.6)" }}>
              {selecionadosNomes.map((n, i) => <p key={i} className="truncate">• {n}</p>)}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} disabled={excluindo} className="px-4 py-2 rounded-xl text-[12px] font-bold text-slate-400 hover:text-white">Cancelar</button>
              <button onClick={confirmarExclusao} disabled={excluindo}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-[12px] font-black uppercase tracking-wider text-white disabled:opacity-60" style={{ background: "#dc2626" }}>
                {excluindo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
