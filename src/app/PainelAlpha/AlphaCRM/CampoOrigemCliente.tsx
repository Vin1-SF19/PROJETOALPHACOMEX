"use client";

import { useEffect, useState } from "react";
import { Compass, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectLabel, SelectGroup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SeletorParceiroPesquisavel, type ParceiroOpcao } from "@/components/comercial/SeletorParceiroPesquisavel";
import { CANAIS_AQUISICAO } from "@/lib/comercial/origens-lead";
import { criarRascunhoOrigem, lerRascunhoOrigem, origemEhParceiro } from "@/lib/bpm/origem-cliente";

const ORIGEM_VAZIA = "__origem_nao_informada__";
const estiloOpcao = "min-h-10 cursor-pointer rounded-lg px-3 pr-9 text-slate-200 focus:bg-sky-400/10 focus:text-sky-100 data-[state=checked]:bg-sky-400/15 data-[state=checked]:text-sky-100 [&_svg]:text-sky-300";

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
    <Select value={origem} disabled={disabled} required={required}
      onValueChange={(valor) => {
        const proximaOrigem = valor === ORIGEM_VAZIA ? "" : valor;
        if (proximaOrigem !== origem) onChange(criarRascunhoOrigem(proximaOrigem, null));
      }}>
      <SelectTrigger id={id} aria-label="Origem do cliente" onBlur={onBlur}
        aria-required={required} aria-invalid={invalid || undefined} aria-describedby={describedBy}
        className={cn(className, "min-h-11 w-full min-w-0 rounded-xl border border-slate-700/80 bg-slate-950 px-3 text-left text-sm text-slate-100 shadow-sm transition-colors hover:border-slate-500 hover:bg-slate-900 data-[placeholder]:text-slate-400 focus-visible:border-sky-400/70 focus-visible:ring-2 focus-visible:ring-sky-400/20 dark:bg-slate-950 dark:hover:bg-slate-900 [&>svg]:text-slate-400")}>
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <Compass size={16} aria-hidden="true" className="shrink-0 text-sky-300" />
          <span className="min-w-0 flex-1 truncate"><SelectValue placeholder="Selecione a origem..." /></span>
        </span>
      </SelectTrigger>
      <SelectContent position="popper" align="start" sideOffset={6}
        className="z-[100] max-h-80 w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-700 bg-slate-950 p-1 text-slate-100 shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
        <SelectGroup>
          <SelectLabel className="px-3 pb-2 pt-1 text-[11px] font-medium tracking-wide text-slate-400">Origem do cliente</SelectLabel>
          <SelectItem value={ORIGEM_VAZIA} className={cn(estiloOpcao, "text-slate-400")}>Não informado</SelectItem>
          {origem && !CANAIS_AQUISICAO.some((item) => item.value === origem)
            && <SelectItem value={origem} className={estiloOpcao}>{origem}</SelectItem>}
          {CANAIS_AQUISICAO.map((item) => <SelectItem key={item.value} value={item.value} className={estiloOpcao}>{item.label}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
    {ehParceiro && <div className="space-y-2.5 rounded-xl border border-sky-400/15 bg-sky-400/[0.04] p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
        <Users size={14} aria-hidden="true" className="text-sky-300" />
        <p>Parceiro que indicou <span className="text-sky-300">*</span></p>
      </div>
      <SeletorParceiroPesquisavel parceiros={parceiros ?? []} value={parceiroId}
        onChange={(id) => onChange(criarRascunhoOrigem(origem, id))}
        disabled={disabled || erro || parceiros === null} carregando={parceiros === null && !erro} />
      <p className="text-xs leading-relaxed text-slate-400">
        Pesquise pelo nome, nome fantasia ou representante. A indicação é registrada ao salvar.
      </p>
      {erro && <div role="alert" className="text-xs text-rose-300">
        Não foi possível carregar os parceiros. <button type="button" disabled={disabled}
          onClick={() => setTentativa((n) => n + 1)} className="underline">Tentar novamente</button>
      </div>}
    </div>}
  </div>;
}
