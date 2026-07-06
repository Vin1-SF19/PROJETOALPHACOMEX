"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Campo, inputCls, CardSecao, BotoesNavegacao } from "./shared";

interface Props {
  pin: string;
  onChange: (patch: { pin: string }) => void;
  onNext: () => void;
}

export default function StepPin({ pin, onChange, onNext }: Props) {
  const [tentouAvancar, setTentouAvancar] = useState(false);

  const pinValido = /^\d{4}$/.test(pin);

  function handleContinuar() {
    setTentouAvancar(true);
    if (pinValido) onNext();
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-5">
      <CardSecao>
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-blue-400" />
          <h2 className="text-[13px] font-black uppercase tracking-wider text-slate-300">Acesso ao convite</h2>
        </div>

        <Campo
          label="PIN de 4 dígitos"
          obrigatorio
          dica="Digite o PIN que você recebeu junto com o link deste convite. Você poderá confirmar o PIN novamente ao usar a busca automática de CPF."
        >
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => onChange({ pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            className={`${inputCls} text-center text-lg tracking-[0.5em] font-black`}
            placeholder="0000"
          />
          {tentouAvancar && !pinValido && <p className="text-[11px] text-rose-400 mt-1">Informe os 4 dígitos do PIN.</p>}
        </Campo>
      </CardSecao>

      <BotoesNavegacao onNext={handleContinuar} labelNext="Acessar" />
    </div>
  );
}
