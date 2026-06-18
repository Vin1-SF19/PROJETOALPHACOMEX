"use client";

import Link from "next/link";
import { Building2, User, Mail, FileText, ArrowRight, Sparkles, Check } from "lucide-react";

export type CardParceiro = {
  id: number;
  tipo: string;
  documento: string;
  nome: string;
  nomeFantasia?: string | null;
  email: string;
  nivel: string;
  comissaoPercentual?: number | null;
  indicacoes?: { id: number; cliente: { id: number; razaoSocial: string; nomeFantasia?: string | null } }[];
};

const COMISSAO_POR_NIVEL: Record<string, number> = { GOLD: 5, PLATINUM: 10, BLACK: 15 };

const NIVEL_STYLE: Record<string, { ring: string; badge: string; glow: string; nameHover: string }> = {
  GOLD: {
    ring: "border-amber-500/40 hover:border-amber-400/80",
    badge: "bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-amber-300 border border-amber-500/50",
    glow: "shadow-[0_8px_30px_rgba(245,158,11,0.12)]",
    nameHover: "group-hover:text-amber-300",
  },
  PLATINUM: {
    ring: "border-slate-300/40 hover:border-slate-200/70",
    badge: "bg-gradient-to-r from-slate-300/25 to-slate-100/15 text-slate-100 border border-slate-300/50",
    glow: "shadow-[0_8px_30px_rgba(203,213,225,0.12)]",
    nameHover: "group-hover:text-slate-100",
  },
  BLACK: {
    ring: "border-white/25 hover:border-white/60",
    badge: "bg-gradient-to-r from-zinc-900 to-black text-white border border-white/30",
    glow: "shadow-[0_8px_30px_rgba(255,255,255,0.08)]",
    nameHover: "group-hover:text-white",
  },
};

function formatDoc(doc: string, tipo: string): string {
  const d = doc.replace(/\D/g, "");
  if (tipo === "PJ" && d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (tipo === "PF" && d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return doc;
}

const NIVEL_ICON: Record<string, string> = { GOLD: "★", PLATINUM: "◆", BLACK: "■" };

export default function ParceiroCard({
  parceiro,
  selecionavel = false,
  selecionado = false,
  onToggleSelect,
}: {
  parceiro: CardParceiro;
  selecionavel?: boolean;
  selecionado?: boolean;
  onToggleSelect?: (id: number) => void;
}) {
  const style = NIVEL_STYLE[parceiro.nivel] ?? NIVEL_STYLE.GOLD;
  const comissao = parceiro.comissaoPercentual ?? COMISSAO_POR_NIVEL[parceiro.nivel] ?? 5;
  const indicacoes = parceiro.indicacoes ?? [];
  const primeira = indicacoes[0];

  const inner = (
    <>
      {/* topo: nível + tipo (+ checkbox no modo seleção) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selecionavel && (
            <span
              className="w-5 h-5 rounded-md grid place-items-center shrink-0 transition-all"
              style={{
                background: selecionado ? "#ef4444" : "rgba(255,255,255,0.05)",
                border: selecionado ? "none" : "1px solid rgba(255,255,255,0.2)",
              }}
            >
              {selecionado && <Check size={13} color="#fff" />}
            </span>
          )}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${style.badge}`}>
            <span>{NIVEL_ICON[parceiro.nivel] ?? "★"}</span>
            {parceiro.nivel}
            <span className="opacity-70">· {comissao}%</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-slate-600 text-[9px] font-black uppercase tracking-widest">
          {parceiro.tipo === "PJ" ? <Building2 size={11} /> : <User size={11} />}
          {parceiro.tipo}
        </div>
      </div>

      {/* nome */}
      <div>
        <h3 className={`text-sm font-black text-white uppercase italic tracking-tight leading-tight line-clamp-2 transition-colors ${style.nameHover}`}>
          {parceiro.nome}
        </h3>
        {parceiro.nomeFantasia && parceiro.nomeFantasia !== parceiro.nome && (
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">{parceiro.nomeFantasia}</p>
        )}
      </div>

      {/* empresa indicada em destaque */}
      {primeira && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
          style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)" }}
        >
          <Sparkles size={11} className="shrink-0" style={{ color: "#a5b4fc" }} />
          <span className="text-[10px] font-bold truncate" style={{ color: "#c7d2fe" }}>
            Indicou: {primeira.cliente.razaoSocial}
            {indicacoes.length > 1 && <span className="opacity-70"> +{indicacoes.length - 1}</span>}
          </span>
        </div>
      )}

      {/* documento + email */}
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
        <FileText size={11} className="shrink-0 text-slate-600" />
        <span className="font-mono">{formatDoc(parceiro.documento, parceiro.tipo)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
        <Mail size={11} className="shrink-0 text-slate-600" />
        <span className="truncate">{parceiro.email}</span>
      </div>
    </>
  );

  const baseClass = `group relative bg-slate-950/60 backdrop-blur-xl border ${style.ring} ${style.glow} rounded-[2rem] p-6 flex flex-col gap-3 transition-all duration-300`;

  // Modo seleção → não navega, só seleciona
  if (selecionavel) {
    return (
      <button
        type="button"
        onClick={() => onToggleSelect?.(parceiro.id)}
        className={`${baseClass} text-left ${selecionado ? "ring-2 ring-red-500/60" : "hover:-translate-y-1"}`}
        style={selecionado ? { borderColor: "rgba(239,68,68,0.6)" } : undefined}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link href={`/PainelAlpha/Parceiros/${parceiro.id}`} className={`${baseClass} hover:-translate-y-1 shadow-lg`}>
      {inner}
      <ArrowRight size={13} className="absolute bottom-5 right-5 text-slate-700 group-hover:text-white group-hover:translate-x-1 transition-all duration-300" />
    </Link>
  );
}
