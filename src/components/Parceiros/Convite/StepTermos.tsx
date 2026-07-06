"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { CardSecao } from "./shared";

interface Props {
  termo: { versao: string; conteudo: string };
  aceito: boolean;
  onChange: (patch: { termoAceito: boolean }) => void;
  onBack: () => void;
  onSubmit: () => void;
  enviando: boolean;
  erro: string | null;
}

export default function StepTermos({ termo, aceito, onChange, onBack, onSubmit, enviando, erro }: Props) {
  const [tentouEnviar, setTentouEnviar] = useState(false);

  function handleEnviar() {
    setTentouEnviar(true);
    if (aceito) onSubmit();
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      <CardSecao>
        <h2 className="text-[13px] font-black uppercase tracking-wider text-slate-300">Termos e Condições de Parceria</h2>
        <div
          className="max-h-72 overflow-y-auto rounded-xl p-4 text-[12px] text-slate-400 leading-relaxed whitespace-pre-wrap"
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          {termo.conteudo}
        </div>
        <p className="text-[10px] text-slate-600">Versão do termo: <span className="font-bold text-slate-500">{termo.versao}</span></p>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={aceito}
            onChange={(e) => onChange({ termoAceito: e.target.checked })}
            className="mt-0.5 w-4 h-4 accent-blue-500"
          />
          <span className="text-[12px] text-slate-300">
            Declaro que li e concordo com os termos e condições de parceria (Revisão de RADAR). <span className="text-rose-400">*</span>
          </span>
        </label>
        {tentouEnviar && !aceito && <p className="text-[11px] text-rose-400">É necessário aceitar os termos para enviar o cadastro.</p>}
      </CardSecao>

      {erro && (
        <div className="rounded-xl px-4 py-3 text-[12px] font-bold text-rose-300" style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)" }}>
          {erro}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 h-12 rounded-2xl text-[12px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={handleEnviar}
          disabled={enviando}
          className="flex-1 h-12 rounded-2xl text-white text-[12px] font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", boxShadow: "0 8px 30px rgba(37,99,235,0.3)" }}
        >
          {enviando ? <><Loader2 size={14} className="animate-spin" /> Enviando...</> : "Enviar cadastro"}
        </button>
      </div>
    </div>
  );
}
