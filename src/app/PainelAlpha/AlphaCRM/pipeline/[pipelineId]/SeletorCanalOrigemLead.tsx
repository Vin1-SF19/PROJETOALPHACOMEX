"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CampoOrigemCliente } from "../../CampoOrigemCliente";
import { lerRascunhoOrigem } from "@/lib/bpm/origem-cliente";
import { CANAIS_ORIGEM_PADRAO } from "@/lib/comercial/canais-origem";

interface SeletorCanalOrigemLeadProps {
  id: string;
  value: string;
  onChange: (valor: string) => void;
  className: string;
  disabled?: boolean;
}

export function SeletorCanalOrigemLead({ id, value, onChange, className, disabled }: SeletorCanalOrigemLeadProps) {
  const [personalizando, setPersonalizando] = useState(false);
  const [novoCanal, setNovoCanal] = useState("");
  const [personalizados, setPersonalizados] = useState<string[]>([]);
  const origem = lerRascunhoOrigem(value)?.origem ?? value;
  const opcoes = [...new Set<string>([...CANAIS_ORIGEM_PADRAO, ...personalizados, ...(origem ? [origem] : [])])];
  const texto = novoCanal.trim().replace(/\s+/g, " ");

  function cancelar() {
    setPersonalizando(false);
    setNovoCanal("");
  }

  function adicionar() {
    if (disabled || !texto || texto.length > 120) return;
    const existente = opcoes.find((opcao) => opcao.toLocaleLowerCase("pt-BR") === texto.toLocaleLowerCase("pt-BR"));
    const canal = existente ?? texto;
    if (!existente) setPersonalizados((anteriores) => [...anteriores, canal]);
    onChange(canal);
    cancelar();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1"><CampoOrigemCliente id={id} value={value} onChange={onChange}
          className={className} disabled={Boolean(disabled)} required={false} invalid={false}
          nativo opcoesAdicionais={personalizados} /></div>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={personalizando}
          aria-controls={`${id}-personalizacao`}
          onClick={() => personalizando ? cancelar() : setPersonalizando(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
        >
          <Plus size={13} aria-hidden="true" /> Personalizar
        </button>
      </div>
      {personalizando && (
        <div id={`${id}-personalizacao`} className="space-y-2 rounded-xl border border-white/10 p-3">
          <label htmlFor={`${id}-novo`} className="text-[11px] font-medium text-slate-400">Novo canal de origem</label>
          <input
            id={`${id}-novo`}
            className={className}
            value={novoCanal}
            onChange={(event) => setNovoCanal(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); adicionar(); }
              if (event.key === "Escape") { event.stopPropagation(); cancelar(); }
            }}
            maxLength={120}
            placeholder="Informe o nome do canal"
            disabled={disabled}
            autoFocus
          />
          <div className="flex gap-2">
            <button type="button" onClick={adicionar} disabled={disabled || !texto || texto.length > 120} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-50">Adicionar canal</button>
            <button type="button" onClick={cancelar} disabled={disabled} className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white disabled:opacity-50">Cancelar personalização</button>
          </div>
        </div>
      )}
    </div>
  );
}
