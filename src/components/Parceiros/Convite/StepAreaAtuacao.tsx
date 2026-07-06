"use client";

import { CheckCircle2 } from "lucide-react";
import { CardSecao, BotoesNavegacao, AREAS } from "./shared";

interface Props {
  areasAtuacao: string[];
  onChange: (patch: { areasAtuacao: string[] }) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function StepAreaAtuacao({ areasAtuacao, onChange, onBack, onNext }: Props) {
  const toggleArea = (a: string) =>
    onChange({ areasAtuacao: areasAtuacao.includes(a) ? areasAtuacao.filter((x) => x !== a) : [...areasAtuacao, a] });

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      <CardSecao>
        <h2 className="text-[13px] font-black uppercase tracking-wider text-slate-300">Área de Atuação de sua empresa</h2>
        <p className="text-[11px] text-slate-500 -mt-2">Selecione a(s) sua(s) área(s) de atuação.</p>

        <div className="grid sm:grid-cols-2 gap-2">
          {AREAS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => toggleArea(a)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold text-left transition-all"
              style={{
                background: areasAtuacao.includes(a) ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.03)",
                border: areasAtuacao.includes(a) ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(255,255,255,0.08)",
                color: areasAtuacao.includes(a) ? "#93c5fd" : "#94a3b8",
              }}
            >
              <span
                className="w-3.5 h-3.5 rounded grid place-items-center shrink-0"
                style={{ border: areasAtuacao.includes(a) ? "none" : "1px solid #475569", background: areasAtuacao.includes(a) ? "#3b82f6" : "transparent" }}
              >
                {areasAtuacao.includes(a) && <CheckCircle2 size={11} className="text-white" />}
              </span>
              {a}
            </button>
          ))}
        </div>
      </CardSecao>

      <BotoesNavegacao onBack={onBack} onNext={onNext} />
    </div>
  );
}
