"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Campo, inputCls, CardSecao, BotoesNavegacao } from "./shared";

interface Props {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  sobre: string;
  onChange: (patch: {
    cnpj?: string;
    razaoSocial?: string;
    nomeFantasia?: string;
    dadosConsultaCnpj?: string;
    sobre?: string;
  }) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function StepEmpresa({ cnpj, razaoSocial, nomeFantasia, sobre, onChange, onBack, onNext }: Props) {
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  async function buscarCnpj() {
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) {
      setErroBusca("Informe um CNPJ válido (14 dígitos)");
      return;
    }
    setErroBusca(null);
    setBuscando(true);
    try {
      const r = await fetch(`/api/ReceitaFederal?cnpj=${cnpjLimpo}`);
      const d = await r.json();
      if (!r.ok || d.error) {
        setErroBusca(d.error || "Não foi possível buscar os dados do CNPJ");
        return;
      }
      onChange({
        razaoSocial: d.razaoSocial || razaoSocial,
        nomeFantasia: d.nomeFantasia || nomeFantasia,
        dadosConsultaCnpj: JSON.stringify(d),
      });
    } catch {
      setErroBusca("Erro ao buscar CNPJ. Tente novamente.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      <CardSecao>
        <h2 className="text-[13px] font-black uppercase tracking-wider text-slate-300">Dados da sua empresa</h2>

        <Campo label="CNPJ da sua empresa" dica="Opcional. Preencha e use a lupa para buscar os dados automaticamente.">
          <div className="flex gap-2">
            <input
              type="text"
              value={cnpj}
              onChange={(e) => onChange({ cnpj: e.target.value })}
              className={inputCls}
              placeholder="00.000.000/0000-00"
            />
            <button
              type="button"
              onClick={buscarCnpj}
              disabled={buscando}
              className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shrink-0 transition-all disabled:opacity-50 flex items-center justify-center"
            >
              {buscando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            </button>
          </div>
          {erroBusca && <p className="text-[11px] text-rose-400 mt-1">{erroBusca}</p>}
        </Campo>

        <div className="grid sm:grid-cols-2 gap-4">
          <Campo label="Razão Social" dica="Preenchido automaticamente pela busca de CNPJ.">
            <input
              type="text"
              value={razaoSocial}
              onChange={(e) => onChange({ razaoSocial: e.target.value })}
              className={inputCls}
            />
          </Campo>
          <Campo label="Nome Fantasia">
            <input
              type="text"
              value={nomeFantasia}
              onChange={(e) => onChange({ nomeFantasia: e.target.value })}
              className={inputCls}
            />
          </Campo>
        </div>

        <Campo
          label="Gostaria de falar mais sobre você e sua empresa?"
          dica="Use esse espaço para falar mais sobre você e sobre sua empresa, gostamos de conhecer bem os nossos parceiros."
        >
          <textarea value={sobre} onChange={(e) => onChange({ sobre: e.target.value })} rows={4} className={`${inputCls} resize-none py-2.5`} />
        </Campo>
      </CardSecao>

      <BotoesNavegacao onBack={onBack} onNext={onNext} />
    </div>
  );
}
