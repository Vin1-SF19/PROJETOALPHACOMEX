"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, RefreshCw } from "lucide-react";
import { getMeusHolerites } from "@/actions/Holerites";
import HeatmapAnual from "./HeatmapAnual";
import CardHolerite from "./CardHolerite";
import ModalUploadHolerite from "./ModalUploadHolerite";

type HoleriteItem = {
  id: number;
  mes: number;
  ano: number;
  competencia: string;
  arquivoNome: string;
  arquivoTamanho: number;
  assinado: boolean;
  status: string;
  motivoRejeicao: string | null;
  uploadedAt: Date | string;
};

type MesHeatmap = {
  mes: number;
  status: "VALIDADO" | "PENDENTE" | "REJEITADO" | "AUSENTE" | "FUTURO";
};

interface MeusHoleritesViewProps {
  userId: number;
  anoInicial?: number;
}

export default function MeusHoleritesView({ userId, anoInicial }: MeusHoleritesViewProps) {
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;
  const [ano, setAno] = useState(anoInicial ?? anoAtual);
  const [holerites, setHolerites] = useState<HoleriteItem[]>([] as HoleriteItem[]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [substituindo, setSubstituindo] = useState<{ id: number; mes: number; ano: number } | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMeusHolerites(ano);
      if (res.success) setHolerites(res.data);
    } finally {
      setLoading(false);
    }
  }, [ano]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const mesesHeatmap: MesHeatmap[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const h = holerites.find((x) => x.mes === m);
    if (m >= mesAtual && ano === anoAtual) return { mes: m, status: "FUTURO" };
    if (!h) return { mes: m, status: "AUSENTE" };
    return { mes: m, status: h.status as MesHeatmap["status"] };
  });

  const anos = [anoAtual - 1, anoAtual, anoAtual + 1];

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {anos.map((a) => (
            <button
              key={a}
              onClick={() => setAno(a)}
              className={`h-8 px-4 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all
                ${ano === a
                  ? "bg-teal-500/20 border-teal-500/50 text-teal-300"
                  : "bg-white/5 border-white/10 text-slate-500 hover:text-white"}`}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={carregar}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-all disabled:opacity-40"
            title="Atualizar"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="h-9 px-4 flex items-center gap-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 transition-all text-[10px] font-black uppercase tracking-widest"
          >
            <Plus size={14} /> Enviar Holerite
          </button>
        </div>
      </div>

      {/* Heatmap */}
      <HeatmapAnual ano={ano} meses={mesesHeatmap} />

      {/* Lista */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-500 text-xs font-black uppercase">
            Carregando...
          </div>
        ) : holerites.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 py-12 text-slate-600"
          >
            <span className="text-3xl">📄</span>
            <p className="text-[10px] font-black uppercase tracking-widest">
              Nenhum holerite enviado em {ano}
            </p>
          </motion.div>
        ) : (
          holerites.map((h, i) => (
            <CardHolerite
              key={h.id}
              holerite={h}
              index={i}
              onSubstituir={h.status === "REJEITADO" ? () => setSubstituindo({ id: h.id, mes: h.mes, ano: h.ano }) : undefined}
            />
          ))
        )}
      </div>

      <ModalUploadHolerite
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        colaboradorId={userId}
        onSucesso={carregar}
      />

      {substituindo && (
        <ModalUploadHolerite
          open
          onClose={() => setSubstituindo(null)}
          colaboradorId={userId}
          onSucesso={() => { setSubstituindo(null); void carregar(); }}
          substituirId={substituindo.id}
          mesFixo={substituindo.mes}
          anoFixo={substituindo.ano}
        />
      )}
    </div>
  );
}
