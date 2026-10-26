"use client";

import { cn } from "@/lib/utils";
import { MESES_PROTOCOLAR, normalizarMesProtocolar } from "@/lib/bpm/mes-protocolar";

type Props = {
  id?: string;
  label?: string;
  value: string;
  onChange: (valor: string) => void;
  onBlur?: () => void;
  className: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  describedBy?: string;
};

export function MesProtocolarSelect({ id, label, value, onChange, onBlur, className,
  required = false, disabled = false, readOnly = false, invalid = false, describedBy }: Props) {
  const mes = normalizarMesProtocolar(value);
  const legadoDesconhecido = Boolean(value.trim()) && !mes;
  return <select id={id} aria-label={label} className={cn(className, "bg-slate-900 text-slate-100")}
    value={mes ?? value} required={required} disabled={disabled || readOnly}
    aria-required={required} aria-readonly={readOnly || undefined}
    aria-invalid={invalid || undefined} aria-describedby={describedBy}
    onChange={(evento) => onChange(evento.target.value)} onBlur={onBlur}>
    <option value="" className="bg-slate-900 text-slate-100">Selecione o mês...</option>
    {legadoDesconhecido && <option value={value} disabled className="bg-slate-900 text-slate-100">
      {value} (registro anterior — selecione um mês)
    </option>}
    {MESES_PROTOCOLAR.map((opcao) => <option key={opcao} value={opcao} className="bg-slate-900 text-slate-100">{opcao}</option>)}
  </select>;
}
