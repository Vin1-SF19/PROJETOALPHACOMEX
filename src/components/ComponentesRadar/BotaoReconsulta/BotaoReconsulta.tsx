import { AlertCircle, RefreshCw, ShieldAlert, X } from "lucide-react";

type TipoReconsulta = "ERROS" | "NAO_HABILITADOS";

interface ModalOpcoesReconsultaProps {
  isOpen: boolean;
  onClose: () => void;
  onExecutar: (tipo: TipoReconsulta) => void;
}

export default function ModalOpcoesReconsulta({
  isOpen,
  onClose,
  onExecutar,
}: ModalOpcoesReconsultaProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-[#0b1220] border border-white/10 w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h2 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <RefreshCw size={14} /> Gestão de Reconsulta
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-4">
          <button
            onClick={() => onExecutar("ERROS")}
            className="w-full py-5 bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 text-rose-500 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 group"
          >
            <AlertCircle size={16} className="group-hover:animate-bounce" />
            Reconsultar Erros
          </button>

          <button
            onClick={() => onExecutar("NAO_HABILITADOS")}
            className="w-full py-5 bg-orange-500/10 hover:bg-orange-600 border border-orange-500/20 text-orange-400 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 group"
          >
            <ShieldAlert size={16} className="group-hover:animate-bounce" />
            Reconsultar Não Habilitados
          </button>

          <p className="text-[9px] text-slate-600 uppercase font-bold text-center leading-relaxed px-4">
            * Os registros selecionados serão consultados novamente na Receita Federal e no RADAR.
          </p>
        </div>
      </div>
    </div>
  );
}
