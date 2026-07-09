"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, Layers, Search, Download, Trash2 } from "lucide-react";
import { formatarMoedaInput, formatarValorBRL } from "./lib/formatters";
import type { TransacaoParaExportar } from "./lib/exportar-excel";
import { modalVariants, MODAL_PERSPECTIVE } from "./lib/modal-variants";

interface LinhaConferencia extends TransacaoParaExportar {
  id?: string;
}

interface ModalConferenciaProps {
  empresa: { razaoSocial: string; cnpj: string };
  linhas: LinhaConferencia[];
  onClose: () => void;
  onExport: (dados: LinhaConferencia[]) => void;
}

type FiltroExportacao = "todos" | "entradas" | "saidas";

export function ModalConferencia({ empresa, linhas, onClose, onExport }: ModalConferenciaProps) {
  const [filtroExportacao, setFiltroExportacao] = useState<FiltroExportacao>("todos");
  const [valorMinimo, setValorMinimo] = useState("");
  const [valorMaximo, setValorMaximo] = useState("");
  const [modalSelecionarAberto, setModalSelecionarAberto] = useState(false);
  const [excluidosTemporarios, setExcluidosTemporarios] = useState<Set<number>>(new Set());
  const [pesquisa, setPesquisa] = useState("");

  const parseValorInput = (val: string) => {
    if (!val) return null;
    const num = Number(val.replace(/\D/g, "")) / 100;
    return isNaN(num) ? null : num;
  };

  const executarExportacao = () => {
    const min = parseValorInput(valorMinimo);
    const max = parseValorInput(valorMaximo);
    const termo = pesquisa.toLowerCase();

    const filtrados = linhas.filter((t, idx) => {
      if (excluidosTemporarios.has(idx)) return false;

      const bateBusca = !pesquisa ||
        t.descricao.toLowerCase().includes(termo) ||
        t.nomeBanco.toLowerCase().includes(termo) ||
        t.data.toLowerCase().includes(termo);
      if (!bateBusca) return false;

      const v = Number(t.valor);
      if (filtroExportacao === "entradas" && v <= 0) return false;
      if (filtroExportacao === "saidas" && v >= 0) return false;

      const valorAbs = Math.abs(v);
      if (min !== null && valorAbs < min) return false;
      if (max !== null && valorAbs > max) return false;

      return true;
    });

    if (filtrados.length === 0) {
      onClose();
      return;
    }

    onExport(filtrados);
  };

  const linhasFiltradasModal = useMemo(() => {
    const termo = pesquisa.toLowerCase();
    return linhas
      .map((t, idx) => ({ t, idx }))
      .filter(({ t, idx }) => {
        if (excluidosTemporarios.has(idx)) return false;
        if (!pesquisa) return true;
        return (
          t.descricao.toLowerCase().includes(termo) ||
          t.nomeBanco.toLowerCase().includes(termo) ||
          t.data.toLowerCase().includes(termo)
        );
      });
  }, [linhas, pesquisa, excluidosTemporarios]);

  const saldoVisivel = linhas.reduce(
    (acc, t, idx) => (!excluidosTemporarios.has(idx) ? acc + Number(t.valor) : acc),
    0,
  );

  return (
    <motion.div
      variants={modalVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ transformStyle: "preserve-3d" }}
      className="bg-[#020617] w-full max-w-7xl max-h-[92vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/10"
    >
      <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-900/40">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Conferência de Lançamentos</h2>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/5">
              {empresa.cnpj}
            </span>
            <p className="text-sm text-slate-400 font-bold uppercase italic">{empresa.razaoSocial}</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Fechar" className="cursor-pointer p-3 hover:bg-white/5 rounded-2xl transition-all text-slate-400 hover:text-rose-500">
          <X size={28} aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8 bg-black/20">
        <table className="w-full border-separate border-spacing-y-2">
          <thead className="sticky top-0 z-20">
            <tr className="bg-slate-900 text-white">
              <th className="p-5 text-left text-[10px] font-black uppercase tracking-[0.2em] first:rounded-l-2xl">Mês Ref.</th>
              <th className="p-5 text-left text-[10px] font-black uppercase tracking-[0.2em]">Instituição</th>
              <th className="p-5 text-left text-[10px] font-black uppercase tracking-[0.2em]">Data</th>
              <th className="p-5 text-left text-[10px] font-black uppercase tracking-[0.2em]">Descrição Detalhada</th>
              <th className="p-5 text-right text-[10px] font-black uppercase tracking-[0.2em] last:rounded-r-2xl">Valor</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((t, i) => (
              <tr key={i} className="group bg-white/[0.02] hover:bg-indigo-500/5 transition-all">
                <td className="p-5 border-y border-l border-white/5 first:rounded-l-2xl text-white font-black italic">{t.mesReferencia}</td>
                <td className="p-5 border-y border-white/5 text-slate-400 font-bold text-xs uppercase">{t.nomeBanco}</td>
                <td className="p-5 border-y border-white/5 text-slate-400 font-bold text-[11px] whitespace-nowrap">{t.data}</td>
                <td className="p-5 border-y border-white/5 text-slate-200 font-medium text-[11px] uppercase leading-tight max-w-md">{t.descricao}</td>
                <td className={`p-5 border-y border-r border-white/5 last:rounded-r-2xl text-right font-black text-sm ${t.valor < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {formatarValorBRL(Number(t.valor))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-8 border-t border-white/5 bg-slate-900/40 flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="space-y-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">1. Filtrar Movimentação</p>
            <div className="flex bg-black/40 p-1.5 rounded-[1.2rem] border border-white/5">
              <button onClick={() => setFiltroExportacao("entradas")} className={`cursor-pointer px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${filtroExportacao === "entradas" ? "bg-emerald-600 text-white shadow-lg scale-105" : "text-slate-500 hover:text-slate-300"}`}>
                <Plus size={14} strokeWidth={3} aria-hidden="true" /> Entradas
              </button>
              <button onClick={() => setFiltroExportacao("saidas")} className={`cursor-pointer px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${filtroExportacao === "saidas" ? "bg-rose-600 text-white shadow-lg scale-105" : "text-slate-500 hover:text-slate-300"}`}>
                <Minus size={14} strokeWidth={3} aria-hidden="true" /> Saídas
              </button>
              <button onClick={() => setFiltroExportacao("todos")} className={`cursor-pointer px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${filtroExportacao === "todos" ? "bg-slate-700 text-white shadow-lg scale-105" : "text-slate-500 hover:text-slate-300"}`}>
                <Layers size={14} strokeWidth={3} aria-hidden="true" /> Tudo
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">2. Faixa de Valor (R$)</p>
            <div className="flex items-center gap-3">
              <input type="text" placeholder="Mínimo R$ 0,00" value={valorMinimo} onChange={(e) => setValorMinimo(formatarMoedaInput(e.target.value))} className="w-40 bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all text-right" />
              <span className="text-slate-500 font-black text-[10px] uppercase italic">até</span>
              <input type="text" placeholder="Máximo R$ 0,00" value={valorMaximo} onChange={(e) => setValorMaximo(formatarMoedaInput(e.target.value))} className="w-40 bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all text-right" />
            </div>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <button onClick={onClose} className="cursor-pointer px-6 py-4 text-slate-400 hover:text-white font-black text-[11px] uppercase tracking-widest transition-all">
              Cancelar
            </button>
            <button
              onClick={() => setModalSelecionarAberto(true)}
              className="group cursor-pointer flex items-center gap-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest border border-amber-500/20 transition-all active:scale-95"
            >
              <Search size={18} aria-hidden="true" className="group-hover:scale-110 transition-transform" />
              Conferir Lançamentos
            </button>
            <button
              onClick={executarExportacao}
              className={`cursor-pointer flex items-center gap-3 px-10 py-5 rounded-[1.5rem] font-black text-xs shadow-2xl transition-all hover:scale-105 text-white active:scale-95 ${filtroExportacao === "entradas" ? "bg-emerald-600" : filtroExportacao === "saidas" ? "bg-rose-600" : "bg-slate-700"}`}
            >
              <Download size={20} strokeWidth={2.5} aria-hidden="true" />
              EXPORTAR {filtroExportacao.toUpperCase()}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {modalSelecionarAberto && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4" style={{ perspective: MODAL_PERSPECTIVE }}>
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ transformStyle: "preserve-3d" }}
              className="bg-[#0f172a] w-full max-w-6xl h-[88vh] rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10 flex flex-col"
            >
              <div className="px-8 py-6 bg-white/[0.02] border-b border-white/5 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="bg-indigo-500/10 p-1.5 rounded-lg">
                      <Layers size={20} aria-hidden="true" className="text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-black text-white tracking-tight uppercase italic">Conferência Geral de Lançamentos</h3>
                  </div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider opacity-60">
                    Revise entradas e saídas. Pesquise por valor, data ou descrição.
                  </p>
                </div>
                <button onClick={() => setModalSelecionarAberto(false)} aria-label="Fechar" className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400">
                  <X size={24} aria-hidden="true" />
                </button>
              </div>

              <div className="px-8 py-4 bg-black/20 border-b border-white/5 flex gap-4 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Pesquisar valor, data ou descrição..."
                    className="w-full pl-10 pr-4 py-3 bg-white/5 text-white border border-white/10 rounded-2xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                    value={pesquisa}
                    onChange={(e) => setPesquisa(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-auto px-8 py-2">
                <table className="w-full text-left border-separate border-spacing-y-2">
                  <thead className="sticky top-0 bg-[#0f172a] z-10">
                    <tr className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                      <th>Instituição</th>
                      <th>Data</th>
                      <th>Descrição Detalhada</th>
                      <th className="text-right pr-6">Valor</th>
                      <th className="text-center w-20">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasFiltradasModal.map(({ t, idx }) => (
                      <tr key={idx} className="group transition-all bg-white/[0.02] border border-white/5 shadow-sm rounded-xl">
                        <td className="p-4 rounded-l-2xl text-[10px] font-black text-slate-400 uppercase italic">{t.nomeBanco}</td>
                        <td className="p-4 text-slate-300 text-xs font-bold">{t.data}</td>
                        <td className="p-4">
                          <div className="text-slate-100 text-[11px] font-bold uppercase leading-tight max-w-md group-hover:text-indigo-400 transition-colors">
                            {t.descricao}
                          </div>
                        </td>
                        <td className={`p-4 text-right font-black text-sm pr-6 ${t.valor < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                          {formatarValorBRL(Number(t.valor))}
                        </td>
                        <td className="p-4 text-center rounded-r-2xl">
                          <button
                            onClick={() => setExcluidosTemporarios((prev) => new Set(prev).add(idx))}
                            aria-label="Remover da exportação"
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-8 bg-black/20 border-t border-white/5 flex justify-between items-center">
                <div className="flex gap-8">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saldo Visível</span>
                    <span className={`text-xl font-black tracking-tighter ${saldoVisivel < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {formatarValorBRL(saldoVisivel)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setExcluidosTemporarios(new Set());
                      setModalSelecionarAberto(false);
                    }}
                    className="cursor-pointer px-8 py-4 bg-white/5 border border-white/10 text-slate-400 text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all"
                  >
                    Resetar e Sair
                  </button>

                  <button
                    onClick={executarExportacao}
                    className={`cursor-pointer flex items-center gap-3 px-10 py-5 rounded-[1.5rem] font-black text-xs shadow-2xl transition-all hover:scale-105 text-white active:scale-95 ${filtroExportacao === "entradas" ? "bg-emerald-600" : filtroExportacao === "saidas" ? "bg-rose-600" : "bg-slate-700"}`}
                  >
                    <Download size={20} strokeWidth={2.5} aria-hidden="true" />
                    EXPORTAR
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
