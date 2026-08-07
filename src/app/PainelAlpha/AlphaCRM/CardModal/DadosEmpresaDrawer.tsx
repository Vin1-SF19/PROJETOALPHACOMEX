"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, ChevronDown, Loader2, RefreshCw, X } from "lucide-react";

import { ObterDadosEmpresaCardBpm } from "@/actions/bpm/Empresas";

import { DadosEmpresaConteudo } from "./DadosEmpresaConteudo";

type DadosEmpresa = NonNullable<Awaited<ReturnType<typeof ObterDadosEmpresaCardBpm>>["data"]>;

interface DadosEmpresaToggleProps {
  aberto: boolean;
  empresaNome: string;
  onToggle: () => void;
}

interface DadosEmpresaDrawerProps {
  accent: string;
  carregando: boolean;
  dados: DadosEmpresa | null;
  erro: string | null;
  onFechar: () => void;
  onRecarregar: () => void;
}

export function useDadosEmpresaDrawer(cardId: string) {
  const [cardAberto, setCardAberto] = useState<string | null>(null);
  const [cardCarregado, setCardCarregado] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosEmpresa | null>(null);

  const abertoNesteCard = aberto && cardAberto === cardId;

  async function carregarDados() {
    setCarregando(true);
    setErro(null);

    const resultado = await ObterDadosEmpresaCardBpm(cardId);
    if (resultado.success && resultado.data) {
      setDados(resultado.data);
      setCardCarregado(cardId);
    } else {
      setDados(null);
      setErro(resultado.error || "Não foi possível carregar os dados da empresa");
    }

    setCarregando(false);
  }

  function alternar() {
    if (abertoNesteCard) {
      setAberto(false);
      return;
    }

    setCardAberto(cardId);
    setAberto(true);
    if (cardCarregado !== cardId) void carregarDados();
  }

  return {
    aberto: abertoNesteCard,
    carregando,
    dados: cardCarregado === cardId ? dados : null,
    erro,
    alternar,
    fechar: () => setAberto(false),
    recarregar: () => void carregarDados(),
  };
}

export function DadosEmpresaToggle({ aberto, empresaNome, onToggle }: DadosEmpresaToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={aberto}
      aria-controls="gaveta-dados-empresa"
      aria-label={`${aberto ? "Fechar" : "Abrir"} dados completos de ${empresaNome}`}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    >
      Dados da empresa
      <ChevronDown size={14} className={aberto ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden="true" />
    </button>
  );
}

export function DadosEmpresaDrawer({
  accent,
  carregando,
  dados,
  erro,
  onFechar,
  onRecarregar,
}: DadosEmpresaDrawerProps) {
  return (
    <motion.section
      id="gaveta-dados-empresa"
      aria-label="Dados completos da empresa"
      initial={{ opacity: 0, y: -28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.045] to-transparent"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `rgba(${accent},0.16)`, color: `rgb(${accent})` }}
          >
            <Building2 size={15} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xs font-black uppercase tracking-wider text-white">Dados da empresa</h2>
            <p className="mt-0.5 truncate text-[10px] text-slate-500">Pré‑Análise · CS&amp;NPS · RADAR · CRM</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar gaveta de dados da empresa"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {carregando ? (
          <div role="status" className="flex min-h-64 flex-col items-center justify-center gap-3 px-5 text-center text-xs text-slate-400">
            <Loader2 size={24} className="animate-spin" style={{ color: `rgb(${accent})` }} aria-hidden="true" />
            Consolidando dados da empresa...
          </div>
        ) : erro ? (
          <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-4 px-5 text-center">
            <p className="text-xs text-rose-300">{erro}</p>
            <button
              type="button"
              onClick={onRecarregar}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              <RefreshCw size={13} aria-hidden="true" /> Tentar novamente
            </button>
          </div>
        ) : dados ? (
          <DadosEmpresaConteudo dados={dados} accent={accent} />
        ) : null}
      </div>
    </motion.section>
  );
}
