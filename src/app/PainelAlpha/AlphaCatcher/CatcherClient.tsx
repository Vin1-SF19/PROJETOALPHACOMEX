'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowLeft, Radar, Upload, Play, Pause, Square, RefreshCw, Loader2, Database, X } from 'lucide-react';
import { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import RadarBackground from '@/components/ComponentesRadar/RadarBackground';
import { CardComScan } from '@/components/ComponentesRadar/CardComScan';
import { getTema } from '@/lib/temas';
import { importarEmpresas, normalizarDiasReceita, normalizarDataConsulta, dataAtualConsulta, type EmpresaCatcher, type ResultadoCatcher } from '@/lib/alpha-catcher/core';

import ResultadosCatcher from './ResultadosCatcher';
import { criarFilaCatcher } from '@/lib/alpha-catcher/fila';
import type { ProgressoColeta } from '@/lib/alpha-catcher/logcomex-progress';
import CalendarioColeta from './CalendarioColeta';
import HistoricoConsultas from './HistoricoConsultas';
import { coletaSchema, janelaMeses, dataMaximaColeta } from '@/lib/alpha-catcher/logcomex-input';
import { detalheHistoricoSchema } from '@/lib/alpha-catcher/historico-tipos';

type Linha = EmpresaCatcher & Omit<Partial<ResultadoCatcher>, 'estado'> & { estado: ResultadoCatcher['estado'] | 'aguardando' | 'consultando' };
const btn = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40';
const assinarTema = (callback: () => void) => {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
};

export default function CatcherClient({ temaInicial }: { temaInicial: string }) {
  const tema = useSyncExternalStore(assinarTema, () => localStorage.getItem('alpha-theme-temp') || temaInicial, () => temaInicial);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [arquivo, setArquivo] = useState('');
  const [usarDataConsulta, setUsarDataConsulta] = useState(false);
  const [dataConsultaJson, setDataConsultaJson] = useState('');
  const dataConsultaFila = useRef<string | null | undefined>(undefined);
  const [dataFilaFixada, setDataFilaFixada] = useState(false);
  const [resumo, setResumo] = useState({ invalidos: 0, duplicados: 0 });
  const [erro, setErro] = useState('');
  const [ativo, setAtivo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [coletando, setColetando] = useState(false);
  const [jobAtivo, setJobAtivo] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [checandoCaptcha, setChecandoCaptcha] = useState(false);
  const [etapaColeta, setEtapaColeta] = useState('');
  const [periodoColeta, setPeriodoColeta] = useState(() => janelaMeses(dataMaximaColeta(), 3));
  const [embarquesMin, setEmbarquesMin] = useState('1');
  const [embarquesMax, setEmbarquesMax] = useState('2');
  const [limiteColeta, setLimiteColeta] = useState(0);
  const [periodoReceita, setPeriodoReceita] = useState('30');
  const [diasReceita, setDiasReceita] = useState('30');
  const coletaId = useRef('');
  const coletaOffset = useRef(0);
  const importacaoId = useRef('');
  const jsonId = useRef('');
  const [avisoHistorico, setAvisoHistorico] = useState('');
  const filaColeta = useRef(criarFilaCatcher<Linha>());
  const [progressoColeta, setProgressoColeta] = useState<ProgressoColeta | null>(null);
  const [pausado, setPausado] = useState(false);
  const [status, setStatus] = useState('Importe um JSON para começar.');
  const [tabelaKey, setTabelaKey] = useState(0);
  const controle = useRef({ cancelar: false, pausar: false, executando: false });
  const montado = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const visual = getTema(tema);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; controle.current.cancelar = true; };
  }, [temaInicial]);

  const stats = {
    total: linhas.length,
    existentes: linhas.filter(l => l.estado === 'existente').length,
    salvos: linhas.filter(l => l.estado === 'salvo').length,
    pendentes: linhas.filter(l => l.estado === 'pendente').length,
  };
  const concluidos = stats.existentes + stats.salvos + stats.pendentes;
  const progresso = stats.total ? Math.round(concluidos / stats.total * 100) : 0;
  const totalColeta = progressoColeta?.total;
  const percentualColeta = totalColeta !== null && totalColeta !== undefined && totalColeta > 0 ? Math.min(100, Math.round((progressoColeta?.coletadas || 0) / totalColeta * 100)) : undefined;
  const aguardando = linhas.some(l => l.estado === 'aguardando');

  function atualizar(cnpj: string, resultado: Partial<Linha>) {
    if (montado.current) setLinhas(prev => prev.map(l => l.cnpj === cnpj ? { ...l, ...resultado } : l));
  }

  async function carregar(file?: File) {
    if (!file || controle.current.executando || coletaId.current) return;
    setErro('');
    setCarregando(true);
    try {
      const dados = importarEmpresas(JSON.parse(await file.text()));
      if (controle.current.executando || coletaId.current || !montado.current) return;
      if (!dados.empresas.length) throw new Error('Nenhuma empresa válida encontrada. Use CNPJs numéricos com dígitos verificadores válidos.');
      importacaoId.current = ''; jsonId.current = crypto.randomUUID(); setAvisoHistorico('');
      dataConsultaFila.current = undefined; setDataFilaFixada(false);
      setLinhas(dados.empresas.map(e => ({ ...e, estado: 'aguardando' })));
      setResumo({ invalidos: dados.invalidos, duplicados: dados.duplicados });
      setProgressoColeta(null); setEtapaColeta('');
      setArquivo(file.name); setTabelaKey(v => v + 1);
      setStatus('Arquivo pronto. Inicie o processamento para consultar e salvar as empresas.');
    } catch (error) {
      setErro(error instanceof SyntaxError ? 'Não foi possível ler o JSON.' : error instanceof Error ? error.message : 'Arquivo inválido.');
    } finally {
      if (montado.current) setCarregando(false);
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  const tick = () => new Promise(resolve => setTimeout(resolve, 250));
  async function esperar(segundos: number) {
    const ate = Date.now() + segundos * 1000;
    while (Date.now() < ate && !controle.current.cancelar) {
      if (montado.current) setStatus(`Aguardando limite da ReceitaWS: ${Math.ceil((ate - Date.now()) / 1000)}s`);
      await tick();
    }
  }

  async function executar(repetir = false, importadas?: Linha[], duranteColeta = false) {
    if (controle.current.executando) return;
    const days = diasReceita.trim() ? normalizarDiasReceita(Number(diasReceita)) : null;
    if (days === null) { setErro('Informe uma idade máxima dos dados inteira, maior ou igual a zero.'); return; }
    const fila = duranteColeta ? filaColeta.current.itens : importadas || linhas.filter(l => repetir ? l.estado === 'pendente' : l.estado === 'aguardando');
    if (!fila.length && !duranteColeta) return;
    if (!duranteColeta && (!importacaoId.current || jsonId.current) && dataConsultaFila.current === undefined) {
      if (usarDataConsulta && normalizarDataConsulta(dataConsultaJson) === null) {
        setErro('Escolha uma data da consulta válida até hoje.'); return;
      }
      dataConsultaFila.current = usarDataConsulta ? dataConsultaJson : null;
      setDataFilaFixada(true);
    }
    const dataConsulta = !duranteColeta && jsonId.current ? dataConsultaFila.current : null;
    controle.current = { cancelar: false, pausar: false, executando: true };
    setAtivo(true); setPausado(false); setErro('');
    if (repetir) setLinhas(prev => prev.map(l => l.estado === 'pendente' ? { ...l, estado: 'aguardando', mensagem: undefined } : l));
    try {
      if (!duranteColeta && !importacaoId.current) {
        const response = await fetch('/api/alpha-catcher/importacoes/json', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: jsonId.current || (jsonId.current = crypto.randomUUID()), arquivo, empresas: linhas.map(l => ({ cnpj: l.cnpj, consignatario: l.consignatario })), ...(dataConsulta ? { dataConsulta } : {}) }) });
        const registro = await response.json();
        if (!response.ok) throw new Error(registro.error || 'Não foi possível registrar o histórico.');
        importacaoId.current = registro.id;
      }
      let indice = 0;
      while (!controle.current.cancelar) {
        if (indice >= fila.length) {
          if (!duranteColeta || !coletaId.current) break;
          if (montado.current) setStatus('Aguardando novos CNPJs da Logcomex…');
          await tick(); continue;
        }
        const empresa = fila[indice++];
        if (duranteColeta && ['salvo', 'existente'].includes(empresa.estado)) continue;
        while (controle.current.pausar && !controle.current.cancelar) await tick();
        if (controle.current.cancelar) break;
        let finalizado = false;
        while (!finalizado && !controle.current.cancelar) {
          while (controle.current.pausar && !controle.current.cancelar) await tick();
          if (controle.current.cancelar) break;
          atualizar(empresa.cnpj, { estado: 'consultando' });
          setStatus(`Consultando ${empresa.consignatario}…`);
          try {
            const response = await fetch('/api/alpha-catcher', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cnpj: empresa.cnpj, consignatario: empresa.consignatario, days, ...(dataConsulta ? { dataConsulta } : {}), ...(importacaoId.current ? { historicoId: importacaoId.current } : {}) }),
              signal: AbortSignal.timeout(180000),
            });
            const data = await response.json();
            if (data.historicoAviso) setAvisoHistorico(data.historicoAviso);
            if (response.status === 429) {
              atualizar(empresa.cnpj, { estado: 'aguardando' });
              await esperar(Math.max(1, Math.min(Number(data.segundos) || 30, 120)));
              continue;
            }
            if (!response.ok) {
              atualizar(empresa.cnpj, { estado: 'pendente', mensagem: data.error || 'Falha na consulta.' });
              if ([401, 403].includes(response.status)) { controle.current.cancelar = true; setErro('Seu acesso expirou ou não está autorizado.'); }
            } else {
              atualizar(empresa.cnpj, data as ResultadoCatcher);
              if (['RECEITA_QUOTA_EXHAUSTED', 'RECEITA_UNAUTHORIZED', 'RECEITA_NOT_CONFIGURED', 'RECEITA_CONFIG_INVALID'].includes(data.codigo)) {
                controle.current.cancelar = true;
                setErro(data.mensagem || 'Confira a configuração e o saldo da ReceitaWS antes de retomar.');
              }
              if (data.codigo === 'BLOCKED_BY_CAPTCHA') {
                controle.current.cancelar = true;
                setErro('Radar bloqueado por captcha. Aguarde alguns minutos antes de retomar.');
              }
            }
          } catch {
            atualizar(empresa.cnpj, { estado: 'pendente', mensagem: 'Falha de conexão. A gravação pode ter terminado; uma nova tentativa verificará o banco primeiro.' });
          }
          finalizado = true;
        }
      }
    } catch (error) {
      controle.current.cancelar = true;
      if (montado.current) setErro(error instanceof Error ? error.message : 'Não foi possível registrar o histórico.');
    } finally {
      controle.current.executando = false;
      if (montado.current) {
        setAtivo(false); setPausado(false);
        setStatus(controle.current.cancelar ? 'Processamento interrompido. Os resultados concluídos foram preservados.' : 'Fila concluída. Confira as pendências antes de tentar novamente.');
      }
    }
  }

  async function importarAutomatico(retomarId?: string) {
    if (controle.current.executando || coletaId.current || coletando) return;
    const entrada = retomarId ? null : coletaSchema.safeParse({ data: periodoColeta.dataFinal, ...periodoColeta, limite: limiteColeta, embarquesMin: embarquesMin.trim() ? Number(embarquesMin) : NaN, embarquesMax: embarquesMax.trim() ? Number(embarquesMax) : NaN });
    if (entrada && !entrada.success) { setErro('Selecione datas até sete dias antes de hoje e confira o limite de empresas e os embarques mínimos e máximos (inteiros; mínimo não pode superar máximo).'); return; }
    const days = diasReceita.trim() ? normalizarDiasReceita(Number(diasReceita)) : null;
    if (days === null) { setErro('Informe uma idade máxima dos dados inteira, maior ou igual a zero.'); return; }
    importacaoId.current = ''; jsonId.current = ''; setAvisoHistorico('');
    filaColeta.current = criarFilaCatcher<Linha>();
    coletaOffset.current = 0;
    setLinhas([]); setResumo({ invalidos: 0, duplicados: 0 }); setProgressoColeta(null);
    setArquivo(`Shipment Intel · ${periodoColeta.dataFinal}`); setTabelaKey(v => v + 1);
    coletaId.current = 'iniciando';
    setColetando(true); setErro(''); setCaptcha(''); setEtapaColeta('Iniciando acesso à Logcomex…');
    let processamento: Promise<void> | undefined;
    try {
      if (retomarId) {
        const response = await fetch(`/api/alpha-catcher/historico/${encodeURIComponent(retomarId)}`, { cache: 'no-store' });
        const raw = await response.json();
        if (!response.ok) throw new Error(raw.error || 'Não foi possível carregar a importação.');
        const detalhe = detalheHistoricoSchema.parse(raw);
        if (detalhe.importacao.id !== retomarId || detalhe.importacao.origem !== 'LOGCOMEX' || !detalhe.importacao.listaDisponivel) throw new Error('Esta importação não pode ser continuada.');
        const anteriores: Linha[] = detalhe.linhas.map(linha => ({ ...linha }));
        filaColeta.current.adicionar(anteriores);
        coletaOffset.current = anteriores.length;
        setLinhas(anteriores);
        setPeriodoColeta({ dataInicio: detalhe.importacao.dataInicio, dataFinal: detalhe.importacao.dataFinal });
        setEmbarquesMin(String(detalhe.importacao.embarquesMin)); setEmbarquesMax(String(detalhe.importacao.embarquesMax));
        setLimiteColeta(detalhe.importacao.limite);
        setArquivo(`Shipment Intel · ${detalhe.importacao.dataFinal}`);
      }
      const start = await fetch('/api/alpha-catcher/logcomex', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(retomarId ? { acao: 'retomar', id: retomarId } : entrada!.data) });
      const inicial = await start.json();
      if (!start.ok) throw new Error(inicial.error || 'Não foi possível iniciar a coleta.');
      coletaId.current = inicial.id; importacaoId.current = inicial.id;
      setJobAtivo(inicial.id);
      processamento = executar(false, undefined, true);
      while (montado.current) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!montado.current) break;
        const response = await fetch(`/api/alpha-catcher/logcomex?id=${encodeURIComponent(inicial.id)}&desde=${coletaOffset.current}`, { cache: 'no-store' });
        const job = await response.json();
        if (!response.ok) throw new Error(job.error || 'Não foi possível acompanhar a coleta.');
        setEtapaColeta(job.etapa);
        if (job.historicoErro) setAvisoHistorico('Não foi possível atualizar o histórico desta importação. Atualize para conferir.');
        setCaptcha(job.captcha || '');
        if (job.progresso) setProgressoColeta(job.progresso as ProgressoColeta);
        if (job.empresas) {
          const recebidas: Linha[] = job.empresas.empresas.map((e: EmpresaCatcher) => ({ ...e, estado: 'aguardando' }));
          const novas = filaColeta.current.adicionar(recebidas);
          if (novas.length) setLinhas(prev => [...prev, ...novas]);
          setResumo({ invalidos: job.empresas.invalidos, duplicados: job.empresas.duplicados });
        }
        if (Number.isSafeInteger(job.totalEmpresas) && job.totalEmpresas >= coletaOffset.current) coletaOffset.current = job.totalEmpresas;
        if (job.estado === 'executando') continue;
        if (job.estado === 'erro') setErro(job.mensagem || 'A coleta não foi concluída.');
        setEtapaColeta(job.mensagem || (job.estado === 'cancelado' ? 'Coleta cancelada.' : 'Coleta concluída.'));
        break;
      }
      coletaId.current = '';

    } catch (error) {
      if (montado.current) setErro(error instanceof Error ? error.message : 'Falha na importação automática.');
    } finally {
      coletaId.current = '';
      if (montado.current) { setColetando(false); setJobAtivo(''); }
      await processamento;
    }
  }

  async function checarCaptcha(acao: 'confirmar_captcha' | 'tentar_captcha') {
    if (!jobAtivo || checandoCaptcha) return;
    setChecandoCaptcha(true); setErro('');
    try {
      const response = await fetch('/api/alpha-catcher/logcomex', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, id: jobAtivo }),
      });
      if (!response.ok && response.status !== 409) throw new Error('Não foi possível solicitar a checagem. Tente novamente.');
      if (response.ok) setCaptcha('verificando');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao verificar CAPTCHA.');
    } finally { setChecandoCaptcha(false); }
  }

  function exportar() {
    const blob = new Blob([JSON.stringify({ arquivo, ...resumo, resultados: linhas }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'alpha-catcher-resultados.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }



  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <RadarBackground accentRgb={visual.accent} />
      <main className="relative z-10 mx-auto max-w-[1600px] space-y-5 p-4 md:p-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/PainelAlpha" aria-label="Voltar ao Painel Alpha" className={btn}><ArrowLeft size={18} /></Link>
            <div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Leads &amp; Marketing</p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-black uppercase italic md:text-3xl"><Radar className={visual.text} />Alpha <span className={visual.text}>Catcher</span></h1>
              <p className="mt-2 text-sm text-slate-300">Capture empresas, consulte ReceitaWS e Radar e salve na base de Consulta Radar.</p>
            </div>
          </div>
          <Dialog>
            <DialogTrigger asChild><button type="button" className={btn}><Database size={16} />ReceitaWS</button></DialogTrigger>
            <DialogContent showCloseButton={false} className="max-h-[90vh] overflow-y-auto rounded-2xl border-white/10 bg-slate-950 p-6 text-slate-100">
              <DialogClose asChild><button type="button" aria-label="Fechar configuração ReceitaWS" className="absolute right-4 top-4 rounded p-1 text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-2"><X size={20} /></button></DialogClose>
              <DialogTitle className={visual.text}>ReceitaWS</DialogTitle>
              <DialogDescription className="text-slate-400">Configure a idade máxima dos dados usados nas consultas.</DialogDescription>
              <div className="space-y-3">
          <label htmlFor="receita-days" className="block text-sm font-bold">Idade máxima dos dados da ReceitaWS</label>
          <div className="flex flex-wrap items-center gap-3">
            <select id="receita-days" value={periodoReceita} disabled={ativo || coletando} onChange={e => {
              setPeriodoReceita(e.target.value);
              if (e.target.value !== 'custom') setDiasReceita(e.target.value);
            }} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-slate-100">
              <option value="0">Atualizar agora (tempo real)</option>
              {[7, 15, 30, 60, 90, 180, 365].map(days => <option key={days} value={String(days)}>{days} dias</option>)}
              <option value="custom">Personalizado</option>
            </select>
            {periodoReceita === 'custom' && <label className="text-xs text-slate-300">Dias
              <input type="number" min={0} step={1} max={Number.MAX_SAFE_INTEGER} value={diasReceita} disabled={ativo || coletando}
                onChange={e => setDiasReceita(e.target.value)} className="ml-2 w-32 rounded-xl border border-white/10 bg-slate-900 p-3 text-sm" />
            </label>}
          </div>
          <p className="text-xs text-slate-400">Se o cache estiver mais antigo que o período escolhido, solicita atualização em tempo real. Zero solicita atualização em cada consulta. Se a atualização falhar, o fallback configurado pode retornar cache antigo.</p>
          <p className="text-xs text-slate-400">Aplica-se às empresas novas; registros já no banco são reutilizados. A data de referência da Logcomex é uma configuração separada.</p>
        </div>
              <DialogClose asChild><button type="button" className={btn}>Concluir</button></DialogClose>
            </DialogContent>
          </Dialog>
        </header>

        <section aria-label="Indicadores da importação" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[['Empresas', stats.total, 'text-slate-100'], ['Já no banco', stats.existentes, 'text-purple-300'], ['Novas salvas', stats.salvos, 'text-emerald-300'], ['Pendências', stats.pendentes, 'text-amber-300']].map(([label, value, color]) => (
            <CardComScan key={label} accentRgb={visual.accent} className="rounded-2xl border border-white/10 bg-slate-950/80 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
            </CardComScan>
          ))}
        </section>



        <section className="grid gap-5 lg:grid-cols-2">
          <CardComScan accentRgb={visual.accent} className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <h2 className="text-sm font-black uppercase tracking-wider">Importação de empresas</h2>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-bold">Logcomex · Shipment Intel</h3>
              <p className="text-xs text-slate-300">Login e código do Gmail automáticos. Coleta empresas com embarques DIRETO/HOUSE conforme os filtros selecionados e encaminha para consulta e gravação.</p>
              <CalendarioColeta visual={visual} value={periodoColeta} onChange={setPeriodoColeta} disabled={ativo || coletando} />
              <div className="flex flex-wrap gap-3">
                <label className="text-xs text-slate-300">Embarques mínimos<input type="number" min={0} step={1} value={embarquesMin} disabled={ativo || coletando} onChange={e => setEmbarquesMin(e.target.value)} className="mt-1 block w-32 rounded-xl border border-white/10 bg-slate-900 p-2 text-sm" /></label>
                <label className="text-xs text-slate-300">Embarques máximos<input type="number" min={0} step={1} value={embarquesMax} disabled={ativo || coletando} onChange={e => setEmbarquesMax(e.target.value)} className="mt-1 block w-32 rounded-xl border border-white/10 bg-slate-900 p-2 text-sm" /></label>
                <label className="text-xs text-slate-300">Limite de empresas (0 = sem limite)<input type="number" min={0} step={1} max={Number.MAX_SAFE_INTEGER} value={Number.isNaN(limiteColeta) ? '' : limiteColeta} disabled={ativo || coletando} onChange={e => setLimiteColeta(e.target.value === '' ? NaN : Number(e.target.value))} className="mt-1 block w-32 rounded-xl border border-white/10 bg-slate-900 p-2 text-sm" /></label></div>
              <button className={`${btn} ${visual.bg}`} disabled={ativo || coletando || carregando || !Number.isInteger(limiteColeta) || limiteColeta < 0 || !Number.isSafeInteger(limiteColeta)} onClick={() => void importarAutomatico()}>{coletando ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}Importar automaticamente da Logcomex</button>
              {progressoColeta && <div className="space-y-2" aria-label="Progresso da coleta Logcomex">
                <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-300">
                  <span>{progressoColeta.totalLista !== null ? `Lista Logcomex: ${progressoColeta.totalLista} empresas` : 'Identificando o total da lista Logcomex…'}</span>
                  <span>{progressoColeta.coletadas} de {totalColeta ?? '…'} perfis coletados · {progressoColeta.cnpjs} CNPJs recebidos</span>
                </div>
                <div role="progressbar" aria-label="Perfis coletados na Logcomex" aria-valuenow={percentualColeta} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full transition-all ${visual.bg} ${percentualColeta === undefined ? 'animate-pulse' : ''}`} style={{ width: percentualColeta === undefined ? '25%' : `${percentualColeta}%` }} /></div>
                <p className="text-xs text-slate-400">{progressoColeta.paginas} de {progressoColeta.paginasTotal ?? '…'} páginas consultadas{coletando ? ' · Coleta e consultas em andamento' : ''}</p>
              </div>}
              {etapaColeta && <p role="status" aria-live="polite" className="text-xs text-slate-300">{etapaColeta}</p>}
              {coletando && jobAtivo && captcha && captcha !== 'liberado' && (
                <div className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
                  <h4 className="text-sm font-bold text-amber-200">{captcha === 'erro' ? 'Não foi possível verificar o CAPTCHA' : 'Verificação de segurança da Logcomex'}</h4>
                  <p role="status" aria-live="polite" className="text-sm text-slate-200">{captcha === 'verificando' ? 'Verificando a liberação no servidor…' : captcha === 'nao_confirmado' ? 'A Logcomex ainda solicita o CAPTCHA. Conclua a verificação e tente novamente.' : captcha === 'erro' ? 'A checagem está indisponível. Tente novamente; o fluxo permanece aguardando.' : 'Abra a Logcomex e resolva o CAPTCHA para a conta da automação. Depois confirme abaixo.'}</p>
                  <div className="flex flex-wrap gap-2">
                    <a href="https://plataforma.logcomex.io/signIn/" target="_blank" rel="noopener noreferrer" className={btn}>Abrir Logcomex</a>
                    <button className={btn} disabled={checandoCaptcha || captcha === 'verificando'} onClick={() => void checarCaptcha('confirmar_captcha')}>Já resolvi o CAPTCHA</button>
                    <button className={btn} disabled={checandoCaptcha || captcha === 'verificando'} onClick={() => void checarCaptcha('tentar_captcha')}><RefreshCw size={14} />Tentar novamente</button>
                  </div>
                  <p className="text-xs text-slate-300">O Alpha Catcher verifica a liberação automaticamente e continua quando ela for confirmada.</p>
                </div>
              )}
              {coletando && jobAtivo && <button className={btn} onClick={() => void fetch('/api/alpha-catcher/logcomex', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'cancelar', id: jobAtivo }) })}><Square size={14} />Cancelar coleta</button>}
            </div>
            <p className="text-sm text-slate-300">JSON da Logcomex com a lista <code>empresas</code>, contendo <code>cnpj</code> e <code>consignatario</code>.</p>
            <div className="space-y-2 rounded-xl border border-white/10 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={usarDataConsulta} disabled={ativo || carregando || coletando || dataFilaFixada} onChange={e => setUsarDataConsulta(e.target.checked)} className={`h-4 w-4 ${visual.text}`} style={{ accentColor: `rgb(${visual.accent})` }} />
                Usar uma data específica na importação JSON
              </label>
              {usarDataConsulta && <div className="space-y-1">
                <label htmlFor="catcher-data-consulta" className="block text-xs text-slate-300">Data da consulta / criação da planilha</label>
                <input id="catcher-data-consulta" type="date" value={dataConsultaJson} max={dataAtualConsulta()} required disabled={ativo || carregando || coletando || dataFilaFixada} onChange={e => setDataConsultaJson(e.target.value)} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white scheme-dark" />
                <p className="text-xs text-slate-400">Aplicada às empresas novas deste JSON. Empresas já salvas mantêm a data original. A escolha fica fixa após iniciar o processamento.</p>
              </div>}
            </div>
            <input ref={fileRef} id="catcher-file" type="file" accept=".json,application/json" className="sr-only" disabled={ativo} onChange={e => void carregar(e.target.files?.[0])} />
            <button disabled={ativo || carregando || coletando} className={`${btn} min-h-24 w-full border-dashed`} onClick={() => fileRef.current?.click()}><Upload size={24} />{carregando ? 'Lendo arquivo…' : arquivo || 'Selecionar arquivo JSON'}</button>
            <p className="text-xs text-slate-400">{resumo.invalidos} inválidos · {resumo.duplicados} duplicados removidos. Empresas existentes são preservadas.</p>
            <p className="text-xs text-slate-400">Os resultados desta fila ficam nesta tela até sair ou recarregar. Exporte o relatório para mantê-los.</p>
            {erro && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300">{erro}</p>}
          </CardComScan>

          <CardComScan accentRgb={visual.accent} className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider">{ativo ? <Loader2 size={18} className="animate-spin" /> : <Radar size={18} />}Monitor de processamento</h2>
            <p role="status" aria-live="polite" className="min-h-10 text-sm text-slate-300">{pausado ? 'Fila pausada. A consulta já iniciada pode concluir.' : status}</p>
            <div className="flex justify-between text-xs text-slate-400"><span>{concluidos} processadas de {stats.total} {coletando ? 'recebidas' : 'empresas'}</span><span>{progresso}%</span></div>
            <div role="progressbar" aria-label="Empresas processadas" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full transition-all ${visual.bg}`} style={{ width: `${progresso}%` }} /></div>
            <div className="flex flex-wrap gap-2">
              {!ativo && <button className={`${btn} ${visual.bg}`} disabled={!aguardando || carregando || coletando} onClick={() => void executar()}><Play size={16} />{concluidos ? 'Continuar fila' : 'Iniciar e salvar'}</button>}
              {ativo && <><button className={btn} onClick={() => { controle.current.pausar = !controle.current.pausar; setPausado(controle.current.pausar); }}><Pause size={16} />{pausado ? 'Retomar' : 'Pausar'}</button>
                <button className={btn} onClick={() => { controle.current.cancelar = true; setStatus('Interrompendo após a consulta em andamento…'); }}><Square size={16} />Interromper</button></>}
              <button className={btn} disabled={ativo || carregando || coletando || !stats.pendentes} onClick={() => void executar(true)}><RefreshCw size={16} />Tentar pendências</button>
            </div>
            <HistoricoConsultas visual={visual} emAndamento={ativo || coletando} aviso={avisoHistorico} onRetomar={id => void importarAutomatico(id)} podeRetomar={!ativo && !coletando && !carregando} />
            <p className="text-xs text-slate-400">ReceitaWS primeiro; Radar após validar o cadastro. Cada CNPJ recebido é verificado no banco e, se novo, consultado enquanto a coleta continua. O limite da ReceitaWS é controlado no servidor conforme o plano. Falhas permanecem pendentes.</p>
          </CardComScan>
        </section>

        <ResultadosCatcher key={tabelaKey} linhas={linhas} visual={visual} onExportar={exportar} />
      </main>
    </div>
  );
}
