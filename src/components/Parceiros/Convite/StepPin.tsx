"use client";

import { useState } from "react";
import Image from "next/image";
import { KeyRound } from "lucide-react";
import { Campo, inputCls, CardSecao, BotoesNavegacao } from "./shared";

interface Props {
  token: string;
  pin: string;
  onChange: (patch: { pin: string }) => void;
  onNext: () => void;
}

export default function StepPin({ token, pin, onChange, onNext }: Props) {
  const [tentouAvancar, setTentouAvancar] = useState(false);
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pinValido = /^\d{4}$/.test(pin);

  async function handleContinuar() {
    setTentouAvancar(true);
    setErro(null);
    if (!pinValido) return;

    setValidando(true);
    try {
      const r = await fetch("/api/convite/validar-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, pin }),
      });
      const d = await r.json();
      if (r.ok) {
        onNext();
      } else {
        setErro(d.error || "PIN incorreto");
      }
    } catch {
      setErro("Erro ao validar PIN. Tente novamente.");
    } finally {
      setValidando(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-5">
      <div className="flex justify-center">
        <Image src="/Logotipo-1.png" alt="Alpha Comex & Compliance" width={200} height={70} priority className="h-auto w-[200px]" />
      </div>

      <CardSecao>
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-blue-400" />
          <h2 className="text-[13px] font-black uppercase tracking-wider text-slate-300">Acesso ao convite</h2>
        </div>

        <Campo
          label="PIN de 4 dígitos"
          obrigatorio
          dica="Digite o PIN que você recebeu junto com o link deste convite."
        >
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              onChange({ pin: e.target.value.replace(/\D/g, "").slice(0, 4) });
              setErro(null);
            }}
            className={`${inputCls} text-center text-lg tracking-[0.5em] font-black`}
            placeholder="0000"
          />
          {tentouAvancar && !pinValido && <p className="text-[11px] text-rose-400 mt-1">Informe os 4 dígitos do PIN.</p>}
          {erro && <p className="text-[11px] text-rose-400 mt-1">{erro}</p>}
        </Campo>
      </CardSecao>

      <BotoesNavegacao
        onNext={handleContinuar}
        labelNext="Acessar"
        loadingNext={validando}
      />
    </div>
  );
}
