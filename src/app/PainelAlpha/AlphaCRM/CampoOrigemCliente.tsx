"use client";

import { useEffect, useState } from "react";
import { SeletorParceiroPesquisavel, type ParceiroOpcao } from "@/components/comercial/SeletorParceiroPesquisavel";
import { CANAIS_AQUISICAO } from "@/lib/comercial/origens-lead";
import { criarRascunhoOrigem, lerRascunhoOrigem, origemEhParceiro } from "@/lib/bpm/origem-cliente";

export function CampoOrigemCliente({ id, value, onChange, onBlur, className, disabled, required, invalid, describedBy }: {
  id: string; value: string; onChange: (value: string) => void; onBlur?: () => void;
  className: string; disabled: boolean; required: boolean; invalid: boolean; describedBy?: string;
}) {
  const rascunho = lerRascunhoOrigem(value);
  const origem = rascunho?.origem ?? value;
  const parceiroId = rascunho?.parceiroId ?? null;
  const ehParceiro = origemEhParceiro(origem);
  const [parceiros, setParceiros] = useState<ParceiroOpcao[] | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!ehParceiro) return;
    let ativo = true;
    import("@/actions/parceiros").then(({ listarParceirosSimples }) => listarParceirosSimples()).then((lista) => {
      if (ativo) {
        setParceiros(lista.map((p) => ({ ...p, representantes: p.representantes.map((r) => r.nome) })));
        setErro(false);
      }
    }).catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [ehParceiro, tentativa]);

  return <div className="space-y-3">
    <select id={id} value={origem} className={className} disabled={disabled}
      required={required} aria-required={required} aria-invalid={invalid || undefined} aria-describedby={describedBy}
      onBlur={onBlur} onChange={(event) => onChange(criarRascunhoOrigem(event.target.value, null))}>
      <option value="">Selecione...</option>
      {origem && !CANAIS_AQUISICAO.some((item) => item.value === origem) && <option value={origem}>{origem}</option>}
      {CANAIS_AQUISICAO.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
    {ehParceiro && <div className="space-y-1.5">
      <p className="text-xs text-slate-400">Parceiro que indicou *</p>
      <SeletorParceiroPesquisavel parceiros={parceiros ?? []} value={parceiroId}
        onChange={(id) => onChange(criarRascunhoOrigem(origem, id))}
        disabled={disabled || erro || parceiros === null} carregando={parceiros === null && !erro} />
      {erro && <div role="alert" className="text-xs text-rose-300">
        Não foi possível carregar os parceiros. <button type="button" disabled={disabled}
          onClick={() => setTentativa((n) => n + 1)} className="underline">Tentar novamente</button>
      </div>}
    </div>}
  </div>;
}
