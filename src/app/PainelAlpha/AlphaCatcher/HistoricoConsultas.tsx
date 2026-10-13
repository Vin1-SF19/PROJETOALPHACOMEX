'use client';
import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { historicoImportacaoSchema, type HistoricoImportacao } from '@/lib/alpha-catcher/historico-tipos';
import { formatarDataInclusaoCatcher, formatarDataOpcaoCatcher } from '@/lib/alpha-catcher/resultados';
import ModalHistorico from './ModalHistorico';
import type { getTema } from '@/lib/temas';
const nomes: Record<HistoricoImportacao['estado'], string> = { em_andamento: 'Em andamento', pendente: 'Processamento pendente', concluido: 'Concluída', erro: 'Coleta parcial ou com erro', cancelado: 'Coleta cancelada', interrompido: 'Execução interrompida' };
const motivos: Record<NonNullable<HistoricoImportacao['motivoInterrupcao']>, string> = {
  limite_execucao: 'A coleta atingiu o limite de duração. Os resultados recebidos foram preservados.',
  inatividade: 'A coleta ficou sem progresso pelo tempo permitido. Os resultados recebidos foram preservados.',
  cancelada: 'A coleta foi cancelada.',
  falha: 'A automação encontrou uma falha. Os resultados recebidos foram preservados.',
  worker_encerrado: 'O processo da automação encerrou antes de concluir.',
};
export default function HistoricoConsultas({ visual, emAndamento, aviso, onRetomar, podeRetomar = false }: { visual: ReturnType<typeof getTema>; emAndamento: boolean; aviso: string; onRetomar?: (id: string) => void; podeRetomar?: boolean }) {
  const [selecionada, setSelecionada] = useState<HistoricoImportacao | null>(null);
  const [lista, setLista] = useState<HistoricoImportacao[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [atualizacao, setAtualizacao] = useState(0);
  const ampliado = useRef(false);
  const cardAtivo = useRef<HTMLElement | null>(null);
  const acompanhar = emAndamento || lista.some(item => item.estado === 'em_andamento');
  useEffect(() => {
    const controller = new AbortController();
    async function carregar() {
      try {
        const res = await fetch('/api/alpha-catcher/historico', { cache: 'no-store', signal: controller.signal });
        const dados = await res.json();
        if (!res.ok) throw new Error();
        const recentes: HistoricoImportacao[] = [];
        for (const raw of dados.importacoes || []) { const item = historicoImportacaoSchema.safeParse(raw); if (item.success) recentes.push(item.data); }
        if (controller.signal.aborted) return;
        setLista(prev => [...recentes, ...prev.filter(item => !recentes.some(r => (r.registroId ?? r.id) === (item.registroId ?? item.id)))]);
        if (!ampliado.current) setCursor(dados.proximoCursor ?? null); setErro('');
      } catch { if (!controller.signal.aborted) setErro('Não foi possível carregar o histórico. Tente atualizar.'); }
      finally { if (!controller.signal.aborted) setCarregando(false); }
    }
    void carregar();
    const timer = acompanhar ? setInterval(() => { void carregar(); }, 5000) : undefined;
    return () => { controller.abort(); if (timer) clearInterval(timer); };
  }, [acompanhar, atualizacao]);
  async function mais() {
    if (!cursor || carregando) return;
    setCarregando(true);
    try {
      const res = await fetch(`/api/alpha-catcher/historico?cursor=${cursor}`, { cache: 'no-store' });
      const dados = await res.json(); if (!res.ok) throw new Error();
      const itens: HistoricoImportacao[] = [];
      for (const raw of dados.importacoes || []) { const item = historicoImportacaoSchema.safeParse(raw); if (item.success) itens.push(item.data); }
      ampliado.current = true;
      setLista(prev => [...prev, ...itens.filter(item => !prev.some(p => (p.registroId ?? p.id) === (item.registroId ?? item.id)))]); setCursor(dados.proximoCursor ?? null); setErro('');
    } catch { setErro('Não foi possível carregar mais importações.'); }
    finally { setCarregando(false); }
  }
  return <section aria-label="Histórico de consultas" className="space-y-3 border-t border-white/10 pt-4">
    <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-bold uppercase tracking-wider">Histórico de consultas</h3>
      <button type="button" onClick={() => setAtualizacao(v => v + 1)} className={`inline-flex items-center gap-1 text-xs ${visual.text} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4`}><RefreshCw size={13} />Atualizar</button></div>
    {aviso && <p role="alert" className="text-xs text-amber-300">{aviso}</p>}
    {erro && <p role="alert" className="text-xs text-amber-300">{erro}</p>}
    {!lista.length && <p className="text-xs text-slate-400">{carregando ? 'Carregando histórico…' : 'Nenhuma importação registrada.'}</p>}
    <ol className="max-h-96 space-y-3 overflow-y-auto">{lista.map(item => <li key={item.registroId ?? item.id} className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 transition hover:border-white/25 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" role="button" tabIndex={0} aria-label={`Abrir lista da importação de ${formatarDataInclusaoCatcher(item.inicio)}`} aria-haspopup="dialog" onClick={e => { cardAtivo.current = e.currentTarget; setSelecionada(item); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardAtivo.current = e.currentTarget; setSelecionada(item); } }}>
      <div className="flex justify-between gap-2"><span className="text-xs font-bold">{item.origem === 'JSON' ? `JSON · ${item.arquivo || 'Arquivo importado'}` : 'Logcomex · Shipment Intel'}</span><span className={`text-xs ${visual.text}`}>{nomes[item.estado]}</span></div>
      <p className="text-xs text-slate-400">Por {item.autor?.usuario ? <span className={visual.text}>@{item.autor.usuario}</span> : 'autor indisponível'}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div><dt className="text-slate-400">Início</dt><dd>{item.inicio ? <time dateTime={item.inicio}>{formatarDataInclusaoCatcher(item.inicio)}</time> : 'Não registrado'}</dd></div>
        <div><dt className="text-slate-400">Fim</dt><dd>{item.fim ? <time dateTime={item.fim}>{formatarDataInclusaoCatcher(item.fim)}</time> : item.recuperadoEm ? 'Não registrado' : item.estado === 'em_andamento' ? 'Em andamento' : 'Não concluída'}</dd></div>
        {item.origem === 'LOGCOMEX' && item.fimColeta && <div><dt className="text-slate-400">Fim da coleta</dt><dd><time dateTime={item.fimColeta}>{formatarDataInclusaoCatcher(item.fimColeta)}</time></dd></div>}
        <div><dt className="text-slate-400">Empresas coletadas (inclui já salvas)</dt><dd className="font-semibold">{item.totalColetadas}</dd></div>
        <div><dt className="text-slate-400">Novas adicionadas ao banco</dt><dd className="font-semibold text-emerald-300">{item.novasSalvas ?? 'Não registrado'}</dd></div>
        <div className="col-span-2"><dt className="text-slate-400">{item.origem === 'JSON' ? 'Data da consulta escolhida' : 'Janela de datas'}</dt><dd>{item.origem === 'JSON' ? item.dataConsultaJson ? formatarDataOpcaoCatcher(item.dataConsultaJson) : 'Data do processamento' : `${formatarDataOpcaoCatcher(item.dataInicio)} a ${formatarDataOpcaoCatcher(item.dataFinal)}`}</dd></div>
        {item.origem === 'LOGCOMEX' && <div><dt className="text-slate-400">Embarques mínimos</dt><dd>{item.embarquesMin}</dd></div>}
        {item.origem === 'LOGCOMEX' && <div><dt className="text-slate-400">Embarques máximos</dt><dd>{item.embarquesMax}</dd></div>}
      </dl>
      {item.motivoInterrupcao && <p className="text-xs text-amber-300">{motivos[item.motivoInterrupcao]}</p>}
      {item.etapaColeta && <p className="text-xs text-slate-400">Última etapa registrada: {item.etapaColeta}</p>}
      {item.tentativas && item.tentativas.length > 1 && <p className="text-xs text-slate-400">{item.tentativas.length} tentativas de coleta nesta importação. A última começou em {formatarDataInclusaoCatcher(item.tentativas.at(-1)?.inicio)}.</p>}
      {item.origem === 'LOGCOMEX' && item.podeRetomar && podeRetomar && onRetomar && <div className="space-y-1"><button type="button" className={`rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold ${visual.text} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`} onKeyDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onRetomar(item.id); }}>Continuar coleta</button><p className="text-xs text-slate-400">O ranking será relido; perfis já registrados serão aproveitados.</p></div>}
      {item.recuperadoEm && <p className="text-xs text-amber-300">Histórico recuperado em {formatarDataInclusaoCatcher(item.recuperadoEm)}. A lista mostra os cadastros atuais; horários e quantidade de novas empresas da execução original não foram registrados.</p>}
    </li>)}</ol>
    {cursor && <button type="button" disabled={carregando} onClick={() => void mais()} className={`text-xs ${visual.text} disabled:opacity-40`}>{carregando ? 'Carregando…' : 'Carregar mais importações'}</button>}
    <ModalHistorico importacao={selecionada} visual={visual} onFechar={() => setSelecionada(null)} onRestaurarFoco={() => cardAtivo.current?.focus()} />
  </section>;
}
