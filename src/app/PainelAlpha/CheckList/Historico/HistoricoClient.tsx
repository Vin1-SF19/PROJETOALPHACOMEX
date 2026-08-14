"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, History, Search, FileText, Trash2,
  ExternalLink, Clock, User, Building2,
} from "lucide-react";
import type { DocHistorico } from "@/actions/checklist";

function fmt(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function HistoricoClient({ docs }: { docs: DocHistorico[] }) {
  const [busca, setBusca] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState<"todos" | "cliente" | "analista">("todos");

  const filtrado = useMemo(() => {
    const q = busca.toLowerCase();
    return docs.filter((d) => {
      const matchBusca =
        !q ||
        d.nome.toLowerCase().includes(q) ||
        d.razaoSocial.toLowerCase().includes(q) ||
        d.cnpj?.includes(q) ||
        d.clienteNome.toLowerCase().includes(q) ||
        d.itemDescricao.toLowerCase().includes(q);
      const matchOrigem =
        filtroOrigem === "todos" ||
        (filtroOrigem === "cliente" && d.uploadedByCliente) ||
        (filtroOrigem === "analista" && !d.uploadedByCliente);
      return matchBusca && matchOrigem;
    });
  }, [docs, busca, filtroOrigem]);

  return (
    <div className="relative min-h-screen text-white pb-24">

      {/* HEADER */}
      <div className="sticky top-0 z-30 border-b border-slate-700/60 backdrop-blur-2xl"
        style={{ background: "rgba(2,6,23,0.88)" }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/PainelAlpha/CheckList"
            className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all active:scale-95"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30">
              <History size={16} className="text-rose-400" />
            </div>
            <div>
              <h1 className="text-base font-black text-white italic uppercase tracking-tight leading-none">
                Histórico de Documentos
              </h1>
              <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                Todos os documentos excluídos do checklist RADAR
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase">
              {docs.length} registros
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-8 space-y-6">

        {/* CONTROLES */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Busca */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Empresa, CNPJ, arquivo ou item..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-2xl py-3 pl-10 pr-4 text-sm bg-slate-800/60 border border-slate-700/60 outline-none text-white placeholder:text-slate-600 focus:border-slate-500 transition-all"
            />
          </div>

          {/* Filtro origem */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800/60 border border-slate-700/60">
            {(["todos", "cliente", "analista"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFiltroOrigem(v)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  filtroOrigem === v
                    ? "bg-slate-600 text-white"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <span className="text-[10px] font-bold text-slate-600 ml-auto">
            {filtrado.length} resultado{filtrado.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* TABELA */}
        {filtrado.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <History size={40} className="text-slate-700" />
            <p className="text-slate-600 text-xs font-black uppercase tracking-widest">
              Nenhum documento encontrado
            </p>
          </div>
        ) : (
          <div className="rounded-[1.5rem] overflow-hidden border border-slate-700/60"
            style={{ background: "rgba(10,18,38,0.92)", backdropFilter: "blur(24px)" }}>

            {/* Cabeçalho da tabela */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-700/60"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Documento / Item</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 w-36">Empresa</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 w-24">Origem</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 w-32">Excluído em</span>
            </div>

            {/* Linhas */}
            <div className="divide-y divide-slate-700/40">
              {filtrado.map((doc, idx) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02, duration: 0.2 }}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-4 hover:bg-white/[0.025] transition-colors group"
                >
                  {/* Col 1: arquivo + item */}
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 flex-shrink-0 mt-0.5">
                      <Trash2 size={12} className="text-rose-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-black text-white hover:text-blue-300 underline underline-offset-2 decoration-slate-700 hover:decoration-blue-400 truncate transition-colors"
                        >
                          {doc.nome}
                        </a>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:border-blue-400/60 transition-all text-[9px] font-black uppercase tracking-wider"
                        >
                          <ExternalLink size={10} />
                          Abrir
                        </a>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[9px] text-slate-600">{doc.itemCodigo}</span>
                        <span className="text-[9px] text-slate-500 truncate">{doc.itemDescricao}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Clock size={9} className="text-slate-700" />
                        <span className="text-[9px] text-slate-600">Enviado em {fmt(doc.criadoEm)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Col 2: empresa */}
                  <div className="w-36 flex flex-col justify-center gap-0.5">
                    <Link
                      href={`/PainelAlpha/CheckList/${doc.empresaId}`}
                      className="text-[10px] font-black text-slate-200 hover:text-white transition-colors truncate flex items-center gap-1 group/link"
                    >
                      <Building2 size={9} className="text-slate-500 flex-shrink-0" />
                      <span className="truncate">{doc.razaoSocial}</span>
                    </Link>
                    <div className="flex items-center gap-1">
                      <User size={9} className="text-slate-600" />
                      <span className="text-[9px] text-slate-500 truncate">{doc.clienteNome}</span>
                    </div>
                  </div>

                  {/* Col 3: origem */}
                  <div className="w-24 flex items-center">
                    {doc.uploadedByCliente ? (
                      <span className="px-2 py-1 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase">
                        Cliente
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-lg border border-slate-600/50 bg-slate-700/40 text-slate-400 text-[9px] font-black uppercase">
                        Analista
                      </span>
                    )}
                  </div>

                  {/* Col 4: data exclusão */}
                  <div className="w-32 flex items-center">
                    <div>
                      <p className="text-[10px] font-black text-rose-400">{fmt(doc.deletadoEm)}</p>
                      {doc.deletadoPorCliente && (
                        <p className="text-[8px] text-rose-500/60 font-bold mt-0.5">pelo cliente</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
