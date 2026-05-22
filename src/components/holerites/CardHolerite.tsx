"use client";

import { motion } from "framer-motion";
import { FileText, CheckCircle, Clock, XCircle, Download, Eye, RefreshCw } from "lucide-react";

type HoleriteCard = {
  id: number;
  mes: number;
  ano: number;
  competencia: string;
  arquivoNome: string;
  arquivoTamanho: number;
  assinado: boolean;
  status: string;
  uploadedAt: Date | string;
  motivoRejeicao?: string | null;
};

interface CardHoleriteProps {
  holerite: HoleriteCard;
  index?: number;
  onSubstituir?: () => void;
}

const STATUS_MAP: Record<string, {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  color: string;
}> = {
  PENDENTE:  { icon: Clock,       label: "Pendente",  color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  VALIDADO:  { icon: CheckCircle, label: "Validado",  color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  REJEITADO: { icon: XCircle,     label: "Rejeitado", color: "text-red-400 bg-red-500/10 border-red-500/30" },
};

export default function CardHolerite({ holerite, index = 0, onSubstituir }: CardHoleriteProps) {
  const s = STATUS_MAP[holerite.status] ?? STATUS_MAP.PENDENTE;
  const Icon = s.icon;
  const tamanhoKB = Math.round(holerite.arquivoTamanho / 1024);
  const isRejeitado = holerite.status === "REJEITADO";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`group rounded-2xl border bg-slate-900/40 backdrop-blur-xl p-4 flex flex-col gap-3 transition-all
        ${isRejeitado ? "border-red-500/20 hover:border-red-500/30" : "border-white/5 hover:border-white/10"}`}
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl border shrink-0 ${isRejeitado ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-white/5 border-white/10 text-slate-400"}`}>
          <FileText size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-white truncate">
            {holerite.competencia}
          </p>
          <p className="text-[9px] text-slate-500 truncate mt-0.5">
            {holerite.arquivoNome} · {tamanhoKB} KB
          </p>
        </div>

        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase shrink-0 ${s.color}`}>
          <Icon size={11} />
          {s.label}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
          <a
            href={`/api/holerites/${holerite.id}/download`}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:border-white/20 transition-all"
            title="Visualizar PDF"
          >
            <Eye size={14} />
          </a>
          <a
            href={`/api/holerites/${holerite.id}/download`}
            download
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:border-white/20 transition-all"
            title="Baixar PDF"
          >
            <Download size={14} />
          </a>
        </div>
      </div>

      {/* Motivo rejeição + botão substituir */}
      {isRejeitado && (
        <div className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl bg-red-500/5 border border-red-500/15">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-0.5">Motivo da rejeição</p>
            <p className="text-[10px] text-red-300 leading-relaxed">{holerite.motivoRejeicao}</p>
          </div>
          {onSubstituir && (
            <button
              onClick={onSubstituir}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all text-[9px] font-black uppercase tracking-widest"
            >
              <RefreshCw size={11} />
              Substituir
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
