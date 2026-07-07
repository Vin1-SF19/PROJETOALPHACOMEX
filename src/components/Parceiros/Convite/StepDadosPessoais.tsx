"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Campo, inputCls, CardSecao, BotoesNavegacao } from "./shared";

function formatarCpf(v: string): string {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3}\.\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3}\.\d{3}\.\d{3})(\d)/, "$1-$2");
}

interface Props {
  token: string;
  pin: string;
  nomeCompleto: string;
  cpf: string;
  dataNascimento: string;
  whatsapp: string;
  onChange: (patch: {
    nomeCompleto?: string;
    cpf?: string;
    dataNascimento?: string;
    dadosConsultaCpf?: string;
    whatsapp?: string;
  }) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function StepDadosPessoais({
  token,
  pin,
  nomeCompleto,
  cpf,
  dataNascimento,
  whatsapp,
  onChange,
  onBack,
  onNext,
}: Props) {
  const [tentouAvancar, setTentouAvancar] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  const valido = nomeCompleto.trim().length >= 2 && whatsapp.trim().length >= 8;

  function handleContinuar() {
    setTentouAvancar(true);
    if (valido) onNext();
  }

  async function buscarCpf() {
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      setErroBusca("Informe um CPF válido (11 dígitos)");
      return;
    }
    if (!dataNascimento.trim()) {
      setErroBusca("Informe a data de nascimento para buscar");
      return;
    }
    setErroBusca(null);
    setBuscando(true);
    try {
      const r = await fetch("/api/convite/consulta-cpf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, pin, cpf: cpfLimpo, dataNascimento }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErroBusca(d.error || "Não foi possível buscar os dados");
        return;
      }
      onChange({
        nomeCompleto: nomeCompleto.trim() ? nomeCompleto : d.nome || nomeCompleto,
        dadosConsultaCpf: JSON.stringify(d.dadosBrutos ?? d),
      });
    } catch {
      setErroBusca("Erro ao buscar CPF. Tente novamente.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      <CardSecao>
        <h2 className="text-[13px] font-black uppercase tracking-wider text-slate-300">Seus dados pessoais</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <Campo label="CPF" dica="Preencha e use a lupa para buscar seus dados automaticamente.">
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => onChange({ cpf: formatarCpf(e.target.value) })}
                className={inputCls}
                placeholder="000.000.000-00"
              />
              <button
                type="button"
                onClick={buscarCpf}
                disabled={buscando}
                className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shrink-0 transition-all disabled:opacity-50 flex items-center justify-center"
              >
                {buscando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              </button>
            </div>
          </Campo>

          <Campo label="Data de Nascimento" dica="Necessária para a busca automática pelo CPF.">
            <input
              type="date"
              value={dataNascimento}
              onChange={(e) => onChange({ dataNascimento: e.target.value })}
              className={inputCls}
            />
          </Campo>
        </div>
        {erroBusca && <p className="text-[11px] text-rose-400 -mt-2">{erroBusca}</p>}

        <Campo label="Nome Completo" obrigatorio dica="Por gentileza, preencha com seu nome completo.">
          <input
            type="text"
            value={nomeCompleto}
            onChange={(e) => onChange({ nomeCompleto: e.target.value })}
            className={inputCls}
          />
          {tentouAvancar && nomeCompleto.trim().length < 2 && (
            <p className="text-[11px] text-rose-400 mt-1">Informe seu nome completo.</p>
          )}
        </Campo>

        <Campo label="WhatsApp" obrigatorio dica="Por gentileza, preencha com seu WhatsApp.">
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => onChange({ whatsapp: e.target.value })}
            className={inputCls}
            placeholder="(00) 00000-0000"
          />
          {tentouAvancar && whatsapp.trim().length < 8 && (
            <p className="text-[11px] text-rose-400 mt-1">Informe um WhatsApp válido.</p>
          )}
        </Campo>
      </CardSecao>

      <BotoesNavegacao onBack={onBack} onNext={handleContinuar} />
    </div>
  );
}
