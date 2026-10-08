'use client';
import { useState } from 'react';
import type { TemaAlpha } from '@/lib/temas';
import { janelaMeses, dataMaximaColeta } from '@/lib/alpha-catcher/logcomex-input';

export type IntervaloColeta = { dataInicio: string; dataFinal: string };
export default function CalendarioColeta({ value, onChange, disabled, visual }: { value: IntervaloColeta; onChange: (value: IntervaloColeta) => void; disabled: boolean; visual: TemaAlpha }) {
  const [mes, setMes] = useState(() => value.dataFinal.slice(0, 7));
  const [ancora, setAncora] = useState('');
  const [referencia, setReferencia] = useState(value.dataFinal);
  const maxima = dataMaximaColeta();
  const primeiro = new Date(`${mes}-01T00:00:00Z`);
  const quantidade = new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + 1, 0)).getUTCDate();
  const titulo = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(primeiro);
  const button = 'rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-40 focus-visible:outline focus-visible:outline-2';
  function mover(delta: number) {
    const d = new Date(primeiro); d.setUTCMonth(d.getUTCMonth() + delta); setMes(d.toISOString().slice(0, 7));
  }
  function selecionar(data: string) {
    if (disabled || data > maxima) return;
    setReferencia(data);
    if (!ancora) { setAncora(data); onChange({ dataInicio: data, dataFinal: data }); }
    else { onChange({ dataInicio: ancora < data ? ancora : data, dataFinal: ancora > data ? ancora : data }); setAncora(''); }
  }
  function janelaAtiva(meses: 3 | 6) {
    const janela = janelaMeses(referencia, meses);
    return !ancora && value.dataInicio === janela.dataInicio && value.dataFinal === janela.dataFinal;
  }
  function atalho(meses: 3 | 6) {
    if (disabled || referencia > maxima) return;
    onChange(janelaAtiva(meses) ? { dataInicio: referencia, dataFinal: referencia } : janelaMeses(referencia, meses));
    setAncora('');
  }
  const formatar = (data: string) => data.split('-').reverse().join('/');
  return <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900 p-3">
    <div className="flex items-center justify-between gap-2"><button type="button" className={button} disabled={disabled} aria-label="Mês anterior" onClick={() => mover(-1)}>‹</button><span className="text-sm capitalize">{titulo}</span><button type="button" className={button} disabled={disabled || mes >= maxima.slice(0, 7)} aria-label="Próximo mês" onClick={() => mover(1)}>›</button></div>
    <div className="grid grid-cols-7 gap-1 text-center text-xs">
      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <span key={d} className="py-1 text-slate-400">{d}</span>)}
      {Array.from({ length: primeiro.getUTCDay() }, (_, i) => <span key={`vazio-${i}`} />)}
      {Array.from({ length: quantidade }, (_, i) => {
        const data = `${mes}-${String(i + 1).padStart(2, '0')}`;
        const selecionado = data >= value.dataInicio && data <= value.dataFinal;
        return <button key={data} type="button" disabled={disabled || data > maxima} aria-label={formatar(data)} aria-pressed={selecionado} onClick={() => selecionar(data)} className={`rounded-lg py-2 focus-visible:outline focus-visible:outline-2 disabled:opacity-40 ${selecionado ? `${visual.bg} text-white` : 'hover:bg-white/10'}`}>{i + 1}</button>;
      })}
    </div>
    <p role="status" className="text-xs text-slate-300">{formatar(value.dataInicio)} até {formatar(value.dataFinal)}{ancora ? ' · Selecione o último dia; repita o dia para consultar apenas ele.' : ''}</p>
    <div className="flex gap-2">{([3, 6] as const).map(meses => <button key={meses} type="button" className={`${button} ${janelaAtiva(meses) ? `${visual.bg} text-white` : ''}`} aria-pressed={janelaAtiva(meses)} disabled={disabled} onClick={() => atalho(meses)}>Janela de {meses} meses</button>)}</div>
    <p className="text-xs text-slate-400">Selecione datas até {formatar(maxima)} (sete dias antes de hoje). Clique no primeiro e no último dia. Dois cliques no mesmo dia selecionam apenas ele. Atalhos contam para trás a partir do último dia clicado. Clique novamente no atalho ativo para voltar a esse dia.</p>
  </div>;
}
