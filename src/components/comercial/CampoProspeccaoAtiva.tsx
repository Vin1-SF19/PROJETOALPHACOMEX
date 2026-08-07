"use client";

import { useId, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { normalizarCatalogoProspeccoes } from "@/lib/comercial/prospeccao-ativa";

const OPCAO_NOVA_PROSPECCAO = "__nova_prospeccao__";

interface CampoProspeccaoAtivaProps {
  valor: string;
  opcoes: string[];
  onChange: (valor: string) => void;
  inputClassName: string;
  labelClassName: string;
}

export function CampoProspeccaoAtiva({
  valor,
  opcoes,
  onChange,
  inputClassName,
  labelClassName,
}: CampoProspeccaoAtivaProps) {
  const campoId = useId();
  const [isNovaProspeccao, setIsNovaProspeccao] = useState(false);
  const catalogo = normalizarCatalogoProspeccoes([...opcoes, valor]);
  const temCatalogo = catalogo.length > 0;
  const mostrarInput = isNovaProspeccao || !temCatalogo;

  if (mostrarInput) {
    return (
      <div className="mt-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-3">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={campoId} className={labelClassName}>Qual prospecção? *</label>
          {temCatalogo && (
            <button
              type="button"
              onClick={() => {
                setIsNovaProspeccao(false);
                onChange("");
              }}
              className="mb-1.5 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-blue-400 transition-colors hover:text-blue-300"
            >
              <RotateCcw size={11} /> Usar cadastrada
            </button>
          )}
        </div>
        <input
          id={campoId}
          value={valor}
          onChange={(evento) => {
            setIsNovaProspeccao(true);
            onChange(evento.target.value);
          }}
          maxLength={200}
          autoFocus
          placeholder="Ex.: LinkedIn, lista própria, ligação ativa..."
          className={inputClassName}
        />
        <p className="mt-2 text-[9px] font-semibold leading-relaxed text-slate-500">
          Depois de salvar, esta prospecção ficará disponível na lista para os próximos clientes.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <label htmlFor={campoId} className={labelClassName}>Prospecção *</label>
      <select
        id={campoId}
        value={valor}
        onChange={(evento) => {
          if (evento.target.value === OPCAO_NOVA_PROSPECCAO) {
            setIsNovaProspeccao(true);
            onChange("");
            return;
          }
          onChange(evento.target.value);
        }}
        className={inputClassName}
      >
        <option value="">Selecione a prospecção...</option>
        {catalogo.map((prospeccao) => (
          <option key={prospeccao} value={prospeccao}>{prospeccao}</option>
        ))}
        <option value={OPCAO_NOVA_PROSPECCAO}>+ Adicionar nova prospecção</option>
      </select>
      <button
        type="button"
        onClick={() => {
          setIsNovaProspeccao(true);
          onChange("");
        }}
        className="mt-2 inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-blue-400 transition-colors hover:text-blue-300"
      >
        <Plus size={11} /> Cadastrar outra prospecção
      </button>
    </div>
  );
}
