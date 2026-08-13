"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Building2, Globe, MapPin, Hash, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ExtratosClientes } from "@/actions/Extratos";
import { modalVariants, MODAL_PERSPECTIVE } from "./lib/modal-variants";

interface DadosEmpresa {
  razaoSocial: string;
  nomeFantasia?: string;
  dataConstituicao?: string;
  municipio?: string;
  uf?: string;
  regimeTributario?: string;
}

interface ModalNovaEmpresaProps {
  isOpen: boolean;
  onClose: () => void;
  aoSucesso: () => void;
}

/** O erro de ExtratosClientes pode ser uma string simples ou o field-errors do Zod (flatten). */
function extrairMensagemErro(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const valores = Object.values(error as Record<string, string[] | undefined>)
      .flat()
      .filter(Boolean);
    if (valores.length > 0) return valores.join(" ");
  }
  return "Dados inválidos.";
}

export function ModalNovaEmpresa({ isOpen, onClose, aoSucesso }: ModalNovaEmpresaProps) {
  const [cnpj, setCnpj] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [dadosEmpresa, setDadosEmpresa] = useState<DadosEmpresa | null>(null);

  // Busca na Receita Federal é só confirmação visual (mostra qual empresa é o
  // CNPJ informado) — desde a Fase 3.3 do Cliente Master, o vínculo real exige
  // que a empresa já esteja cadastrada no CRM/CS&NPS, essa consulta não cria
  // cadastro nenhum.
  const handleConsultarCNPJ = async () => {
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) return toast.error("CNPJ Inválido!");

    setCarregando(true);
    try {
      const res = await fetch(`/api/ReceitaFederal?cnpj=${cnpjLimpo}`);
      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
      } else {
        setDadosEmpresa({
          razaoSocial: data.razaoSocial,
          nomeFantasia: data.nomeFantasia,
          dataConstituicao: data.dataConstituicao,
          municipio: data.municipio,
          uf: data.uf,
          regimeTributario: data.regimeTributario,
        });
        toast.success("Dados localizados!");
      }
    } catch {
      toast.error("Erro ao conectar com a API");
    } finally {
      setCarregando(false);
    }
  };

  const handleFinalizar = async () => {
    if (!dadosEmpresa || !dadosEmpresa.razaoSocial) {
      return toast.error("Por favor, consulte um CNPJ válido primeiro!");
    }

    setCarregando(true);
    try {
      const res = await ExtratosClientes({ cnpj });

      if (res.success) {
        toast.success("Empresa vinculada — análise de extrato iniciada!");
        onClose();
        aoSucesso();
      } else {
        toast.error(extrairMensagemErro(res.error));
      }
    } catch {
      toast.error("Erro ao vincular empresa");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4"
          style={{ perspective: MODAL_PERSPECTIVE }}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ transformStyle: "preserve-3d" }}
            className="bg-[#0b1220] border border-white/10 w-full max-w-4xl rounded-[3rem] shadow-2xl relative overflow-hidden"
          >
        <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">
              Vincular <span className="text-indigo-500">Empresa</span>
            </h2>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.3em] mt-2 italic">Alpha Financial Intelligence</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="cursor-pointer p-3 hover:bg-red-500/10 hover:text-red-500 rounded-2xl transition-all text-slate-500">
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        <div className="p-10 space-y-10">
          <div className="space-y-4">
            <label htmlFor="empresa-cnpj" className="text-[10px] font-black uppercase text-indigo-500 tracking-widest ml-1">Documento de Identificação (CNPJ)</label>
            <p className="text-[11px] text-slate-500 -mt-2 ml-1">A empresa precisa já estar cadastrada no Alpha CRM. Esta consulta só confirma visualmente qual empresa é.</p>
            <div className="flex gap-4">
              <div className="relative flex-1 group">
                <Hash aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-all" size={20} />
                <input
                  id="empresa-cnpj"
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  className="w-full bg-slate-950 border border-white/5 rounded-2xl py-5 pl-14 pr-4 text-sm text-white outline-none focus:border-indigo-500 transition-all font-bold tracking-widest"
                />
              </div>
              <button
                onClick={handleConsultarCNPJ}
                disabled={carregando}
                className="bg-white text-black hover:bg-indigo-500 hover:text-white px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-20"
              >
                {carregando ? "..." : "CONSULTAR"}
              </button>
            </div>
          </div>

          {dadosEmpresa && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: "Razão Social", val: dadosEmpresa.razaoSocial, icon: Building2 },
                { label: "Nome Fantasia", val: dadosEmpresa.nomeFantasia || "N/A", icon: Globe },
                { label: "Localização", val: `${dadosEmpresa.municipio} - ${dadosEmpresa.uf || "Brasil"}`, icon: MapPin },
                { label: "Regime", val: dadosEmpresa.regimeTributario || "Simples/Geral", icon: ShieldCheck },
              ].map((info) => (
                <div key={info.label} className="bg-white/[0.03] border border-white/5 p-6 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-indigo-500">
                    <info.icon size={14} aria-hidden="true" />
                    <span className="text-[9px] font-black uppercase tracking-widest">{info.label}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-300 uppercase truncate">{info.val}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-4">
            <button onClick={onClose} className="cursor-pointer flex-1 py-5 bg-slate-900 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-slate-800 transition-all italic">Abortar</button>
            <button
              onClick={handleFinalizar}
              disabled={!dadosEmpresa || carregando}
              className="cursor-pointer flex-[2] py-5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-500/20 disabled:opacity-10 italic"
            >
              {carregando ? "Vinculando..." : "Confirmar e Vincular"}
            </button>
          </div>
        </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
