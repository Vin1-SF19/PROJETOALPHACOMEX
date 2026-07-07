"use client";

import { useState } from "react";
import { User, Building2 } from "lucide-react";
import { CardSecao, BotoesNavegacao } from "./shared";

interface Props {
  tipoRecebimento: "PF" | "PJ" | "";
  onChange: (patch: { tipoRecebimento: "PF" | "PJ" }) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function StepTipoPessoa({ tipoRecebimento, onChange, onBack, onNext }: Props) {
  const [tentouAvancar, setTentouAvancar] = useState(false);

  function handleContinuar() {
    setTentouAvancar(true);
    if (tipoRecebimento) onNext();
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      <CardSecao>
        <h2 className="text-[13px] font-black uppercase tracking-wider text-slate-300">Deseja receber comissões como PF ou PJ?</h2>
        <p className="text-[11px] text-slate-500 -mt-2">Selecione como prefere receber suas comissões de parceria.</p>

        <div className="grid sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChange({ tipoRecebimento: "PF" })}
            className="flex flex-col items-center gap-2 px-4 py-6 rounded-2xl transition-all"
            style={{
              background: tipoRecebimento === "PF" ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.03)",
              border: tipoRecebimento === "PF" ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(255,255,255,0.08)",
              color: tipoRecebimento === "PF" ? "#93c5fd" : "#94a3b8",
            }}
          >
            <User size={22} />
            <span className="text-[13px] font-black uppercase tracking-wider">Pessoa Física</span>
          </button>
          <button
            type="button"
            onClick={() => onChange({ tipoRecebimento: "PJ" })}
            className="flex flex-col items-center gap-2 px-4 py-6 rounded-2xl transition-all"
            style={{
              background: tipoRecebimento === "PJ" ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.03)",
              border: tipoRecebimento === "PJ" ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(255,255,255,0.08)",
              color: tipoRecebimento === "PJ" ? "#93c5fd" : "#94a3b8",
            }}
          >
            <Building2 size={22} />
            <span className="text-[13px] font-black uppercase tracking-wider">Pessoa Jurídica</span>
          </button>
        </div>

        {tentouAvancar && !tipoRecebimento && (
          <p className="text-[11px] text-rose-400">Selecione uma opção para continuar.</p>
        )}
      </CardSecao>

      <BotoesNavegacao onBack={onBack} onNext={handleContinuar} />
    </div>
  );
}
