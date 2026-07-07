"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { Campo, inputCls, CardSecao, BotoesNavegacao, UFS } from "./shared";

interface EnderecoData {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface Props extends EnderecoData {
  onChange: (patch: Partial<EnderecoData>) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function StepEndereco({ cep, logradouro, numero, complemento, bairro, cidade, uf, onChange, onBack, onNext }: Props) {
  const [buscando, setBuscando] = useState(false);
  const [erroCep, setErroCep] = useState<string | null>(null);
  const [tentouAvancar, setTentouAvancar] = useState(false);

  async function buscarCep() {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      setErroCep("CEP deve ter 8 dígitos");
      return;
    }
    setErroCep(null);
    setBuscando(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const d = await r.json();
      if (d.erro) {
        setErroCep("CEP não encontrado");
        return;
      }
      onChange({
        logradouro: d.logradouro || "",
        bairro: d.bairro || "",
        cidade: d.localidade || "",
        uf: d.uf || "",
      });
    } catch {
      setErroCep("Erro ao buscar CEP");
    } finally {
      setBuscando(false);
    }
  }

  const enderecoCompleto =
    cep.trim() && logradouro.trim() && numero.trim() && complemento.trim() && bairro.trim() && cidade.trim() && uf.trim();

  function handleContinuar() {
    setTentouAvancar(true);
    if (enderecoCompleto) onNext();
  }

  const erroCampo = (v: string) => tentouAvancar && !v.trim();

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      <CardSecao>
        <h2 className="text-[13px] font-black uppercase tracking-wider text-slate-300">Endereço para receber brindes e presentes</h2>

        <Campo label="CEP" obrigatorio>
          <div className="flex gap-2">
            <input
              type="text"
              value={cep}
              onChange={(e) => onChange({ cep: e.target.value })}
              className={inputCls}
              placeholder="00000-000"
              maxLength={9}
            />
            <button
              type="button"
              onClick={buscarCep}
              disabled={buscando}
              className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shrink-0 transition-all disabled:opacity-50 flex items-center justify-center"
            >
              {buscando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            </button>
          </div>
          {erroCep && <p className="text-[11px] text-rose-400 mt-1">{erroCep}</p>}
          {erroCampo(cep) && <p className="text-[11px] text-rose-400 mt-1">Informe o CEP.</p>}
        </Campo>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Campo label="Logradouro" obrigatorio>
              <input type="text" value={logradouro} onChange={(e) => onChange({ logradouro: e.target.value })} className={inputCls} placeholder="Rua / Av." />
              {erroCampo(logradouro) && <p className="text-[11px] text-rose-400 mt-1">Informe o logradouro.</p>}
            </Campo>
          </div>
          <Campo label="Número" obrigatorio>
            <input type="text" value={numero} onChange={(e) => onChange({ numero: e.target.value })} className={inputCls} placeholder="Nº" />
            {erroCampo(numero) && <p className="text-[11px] text-rose-400 mt-1">Informe o número.</p>}
          </Campo>
        </div>

        <Campo label="Complemento" obrigatorio>
          <input type="text" value={complemento} onChange={(e) => onChange({ complemento: e.target.value })} className={inputCls} placeholder="Apto, sala, bloco..." />
          {erroCampo(complemento) && <p className="text-[11px] text-rose-400 mt-1">Informe o complemento.</p>}
        </Campo>

        <Campo label="Bairro" obrigatorio>
          <input type="text" value={bairro} onChange={(e) => onChange({ bairro: e.target.value })} className={inputCls} />
          {erroCampo(bairro) && <p className="text-[11px] text-rose-400 mt-1">Informe o bairro.</p>}
        </Campo>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Campo label="Cidade" obrigatorio>
              <input type="text" value={cidade} onChange={(e) => onChange({ cidade: e.target.value })} className={inputCls} />
              {erroCampo(cidade) && <p className="text-[11px] text-rose-400 mt-1">Informe a cidade.</p>}
            </Campo>
          </div>
          <Campo label="UF" obrigatorio>
            <div className="relative">
              <select
                value={uf}
                onChange={(e) => onChange({ uf: e.target.value })}
                className={`${inputCls} appearance-none pr-9`}
              >
                <option value="">Selecione...</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
            {erroCampo(uf) && <p className="text-[11px] text-rose-400 mt-1">Selecione a UF.</p>}
          </Campo>
        </div>
      </CardSecao>

      <BotoesNavegacao onBack={onBack} onNext={handleContinuar} />
    </div>
  );
}
