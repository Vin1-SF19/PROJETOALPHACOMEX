"use client";

import { X, Database } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BuscarTransacoesPorBanco, DeletarTransacoesLote } from "@/actions/transacao";
import { TabelaTransacoesPaginada } from "./TabelaTransacoesPaginada";
import { modalVariants } from "./lib/modal-variants";

interface ModalTransacoesSalvasProps {
  bancoId: number;
  onClose: () => void;
}

export function ModalTransacoesSalvas({ bancoId, onClose }: ModalTransacoesSalvasProps) {
  const carregarPagina = async (params: { page: number; pageSize: number; busca: string }) => {
    const res = await BuscarTransacoesPorBanco(bancoId, params);
    return res;
  };

  const handleExcluir = async (ids: string[]) => {
    const res = await DeletarTransacoesLote(ids);
    if (res.success) {
      toast.success(`${ids.length} registro(s) removido(s).`);
    } else {
      toast.error(res.error || "Erro ao excluir.");
    }
  };

  return (
    <motion.div
      variants={modalVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ transformStyle: "preserve-3d" }}
      className="bg-[#020617] border border-white/10 w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl"
    >
      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
            <Database size={20} aria-hidden="true" />
          </div>
          <h3 className="text-lg font-black text-white uppercase italic">Registros no Banco de Dados</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-all"
        >
          <X size={24} aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <TabelaTransacoesPaginada carregarPagina={carregarPagina} onSelecaoExcluir={handleExcluir} />
      </div>
    </motion.div>
  );
}
