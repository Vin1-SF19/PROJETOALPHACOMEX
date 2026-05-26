"use client";

import { motion } from "framer-motion";
import { fmtDate } from "@/lib/format-date";
import { ArrowLeft, FileText, CheckCircle, Clock, XCircle, Shield } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import PreviewPdfHolerite from "@/components/holerites/PreviewPdfHolerite";
import BotoesValidacao from "@/components/holerites/BotoesValidacao";
import { useRouter } from "next/navigation";

type HoleriteDetalhe = {
  id: number;
  competencia: string;
  mes: number;
  ano: number;
  arquivoNome: string;
  arquivoTamanho: number;
  assinado: boolean;
  assinadoEm?: Date | string | null;
  status: string;
  motivoRejeicao?: string | null;
  observacao?: string | null;
  uploadedAt: Date | string;
  colaborador: { id: number; nome: string; imagemUrl?: string | null; cargo?: string | null };
  uploadedBy?: { nome?: string | null } | null;
};

const STATUS_MAP: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; color: string }> = {
  PENDENTE:  { icon: Clock,       label: "Pendente",  color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  VALIDADO:  { icon: CheckCircle, label: "Validado",  color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  REJEITADO: { icon: XCircle,     label: "Rejeitado", color: "text-red-400 bg-red-500/10 border-red-500/30" },
};

interface HoleriteDetalheClientProps {
  holerite: HoleriteDetalhe;
  isGestao: boolean;
}

export default function HoleriteDetalheClient({ holerite, isGestao }: HoleriteDetalheClientProps) {
  const router = useRouter();
  const s = STATUS_MAP[holerite.status] ?? STATUS_MAP.PENDENTE;
  const Icon = s.icon;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-6">
      {/* Back + title */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <Link
          href="/PainelAlpha/Holerites"
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Alpha Holerites</p>
          <h1 className="text-lg font-black text-white">{holerite.competencia}</h1>
        </div>
        <div className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase ${s.color}`}>
          <Icon size={12} />
          {s.label}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Info card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-xl p-5"
        >
          {/* Colaborador */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 shrink-0">
              {holerite.colaborador.imagemUrl ? (
                <Image
                  src={holerite.colaborador.imagemUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm font-black text-slate-400">
                  {holerite.colaborador.nome.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-black text-white">{holerite.colaborador.nome}</p>
              <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider">
                {holerite.colaborador.cargo ?? "—"}
              </p>
            </div>
          </div>

          <hr className="border-white/5" />

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Arquivo", value: holerite.arquivoNome },
              { label: "Tamanho", value: `${Math.round(holerite.arquivoTamanho / 1024)} KB` },
              { label: "Enviado por", value: holerite.uploadedBy?.nome ?? "—" },
              { label: "Enviado em", value: fmtDate(holerite.uploadedAt) },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-600">{item.label}</p>
                <p className="text-[10px] font-black text-slate-300 truncate">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Assinatura Gov.br */}
          <div className={`flex items-center gap-2 p-3 rounded-xl border text-[9px] font-black uppercase
            ${holerite.assinado ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-red-500/5 border-red-500/20 text-red-400"}`}>
            <Shield size={12} />
            {holerite.assinado ? "Declarado assinado via Gov.br" : "Assinatura não declarada"}
          </div>

          {holerite.observacao && (
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-600 mb-1">Observação</p>
              <p className="text-[10px] text-slate-400 leading-relaxed">{holerite.observacao}</p>
            </div>
          )}

          {holerite.motivoRejeicao && (
            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20">
              <p className="text-[8px] font-black uppercase tracking-widest text-red-500 mb-1">Motivo da Rejeição</p>
              <p className="text-[10px] text-red-300 leading-relaxed">{holerite.motivoRejeicao}</p>
            </div>
          )}

          {isGestao && holerite.status === "PENDENTE" && (
            <BotoesValidacao
              holeriteId={holerite.id}
              onAtualizado={() => router.refresh()}
            />
          )}
        </motion.div>

        {/* PDF Preview */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <FileText size={14} className="text-slate-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Prévia do PDF</span>
          </div>
          <PreviewPdfHolerite holeriteId={holerite.id} />
        </motion.div>
      </div>
    </div>
  );
}
