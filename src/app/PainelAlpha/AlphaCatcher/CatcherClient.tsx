'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowLeft, Radar, Upload, Play, Pause, Square, RefreshCw, Download, Loader2, Database } from 'lucide-react';
import RadarBackground from '@/components/ComponentesRadar/RadarBackground';
import { CardComScan } from '@/components/ComponentesRadar/CardComScan';
import { getTema } from '@/lib/temas';
import { importarEmpresas, MAX_ARQUIVO_BYTES, type EmpresaCatcher, type ResultadoCatcher } from '@/lib/alpha-catcher/core';

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
  const [resumo, setResumo] = useState({ invalidos: 0, duplicados: 0 });
  const [erro, setErro] = useState('');
  const [ativo, setAtivo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [coletando, setColetando] = useState(false);
  const [jobAtivo, setJobAtivo] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [checandoCaptcha, setChecandoCaptcha] = useState(false);
  const [etapaColeta, setEtapaColeta] = useState('');
  const [dataColeta, setDataColeta] = useState('');
  const [limiteColeta, setLimiteColeta] = useState(5);
  const coletaId = useRef('');
  const [pausado, setPausado] = useState(false);
  const [status, setStatus] = useState('Importe um JSON para começar.');
  const [filtro, setFiltro] = useState('todos');
  const [pagina, setPagina] = useState(0);
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
  const exibidas = linhas.filter(l => filtro === 'todos' || l.estado === filtro);
  const ultimaPagina = Math.max(0, Math.ceil(exibidas.length / 50) - 1);
  const paginaAtual = Math.min(pagina, ultimaPagina);
  const aguardando = linhas.some(l => l.estado === 'aguardando');

  function atualizar(cnpj: string, resultado: Partial<Linha>) {
    if (montado.current) setLinhas(prev => prev.map(l => l.cnpj === cnpj ? { ...l, ...resultado } : l));
  }

  async function carregar(file?: File) {
    if (!file || controle.current.executando || coletaId.current) return;
    setErro('');
    setCarregando(true);
    try {
      if (file.size > MAX_ARQUIVO_BYTES) throw new Error('O arquivo deve ter até 5 MB.');
      const dados = importarEmpresas(JSON.parse(await file.text()));
      if (controle.current.executando || coletaId.current || !montado.current) return;
      if (!dados.empresas.length) throw new Error('Nenhuma empresa válida encontrada. Use CNPJs numéricos com dígitos verificadores válidos.');
      setLinhas(dados.empresas.map(e => ({ ...e, estado: 'aguardando' })));
      setResumo({ invalidos: dados.invalidos, duplicados: dados.duplicados });
      setArquivo(file.name); setPagina(0); setFiltro('todos');
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
      if (montado.current) setStatus(`Aguardando intervalo das APIs: ${Math.ceil((ate - Date.now()) / 1000)}s`);
      await tick();
    }
  }

  async function executar(repetir = false, importadas?: Linha[]) {
    if (controle.current.executando) return;
    const fila = importadas || linhas.filter(l => repetir ? l.estado === 'pendente' : l.estado === 'aguardando');
    if (!fila.length) return;
    controle.current = { cancelar: false, pausar: false, executando: true };
    setAtivo(true); setPausado(false); setErro('');
    if (repetir) setLinhas(prev => prev.map(l => l.estado === 'pendente' ? { ...l, estado: 'aguardando', mensagem: undefined } : l));
    try {
      for (const empresa of fila) {
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
              body: JSON.stringify({ cnpj: empresa.cnpj, consignatario: empresa.consignatario }),
              signal: AbortSignal.timeout(180000),
            });
            const data = await response.json();
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
    } finally {
      controle.current.executando = false;
      if (montado.current) {
        setAtivo(false); setPausado(false);
        setStatus(controle.current.cancelar ? 'Processamento interrompido. Os resultados concluídos foram preservados.' : 'Fila concluída. Confira as pendências antes de tentar novamente.');
      }
    }
  }

  async function importarAutomatico() {
    if (controle.current.executando || coletaId.current || coletando) return;
    coletaId.current = 'iniciando';
    setColetando(true); setErro(''); setCaptcha(''); setEtapaColeta('Iniciando acesso à Logcomex…');
    try {
      const data = dataColeta || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const start = await fetch('/api/alpha-catcher/logcomex', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, limite: limiteColeta }) });
      const inicial = await start.json();
      if (!start.ok) throw new Error(inicial.error || 'Não foi possível iniciar a coleta.');
      coletaId.current = inicial.id;
      setJobAtivo(inicial.id);
      let importar = false;
      let importadas: Linha[] = [];
      while (montado.current) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!montado.current) break;
        const response = await fetch(`/api/alpha-catcher/logcomex?id=${encodeURIComponent(inicial.id)}`, { cache: 'no-store' });
        const job = await response.json();
        if (!response.ok) throw new Error(job.error || 'Não foi possível acompanhar a coleta.');
        setEtapaColeta(job.etapa);
        setCaptcha(job.captcha || '');
        if (job.estado === 'executando') continue;
        if (job.empresas?.empresas?.length) {
          importadas = job.empresas.empresas.map((e: EmpresaCatcher) => ({ ...e, estado: 'aguardando' }));
          setLinhas(importadas); setResumo({ invalidos: job.empresas.invalidos, duplicados: job.empresas.duplicados });
          setArquivo(`Shipment Intel · ${data}`); setPagina(0); setFiltro('todos');
          importar = job.estado === 'concluido';
        }
        if (job.estado === 'erro') setErro(job.mensagem || 'A coleta não foi concluída.');
        setEtapaColeta(job.mensagem || (job.estado === 'cancelado' ? 'Coleta cancelada.' : 'Coleta concluída.'));
        break;
      }
      coletaId.current = '';
      if (montado.current && importar) await executar(false, importadas);
    } catch (error) {
      if (montado.current) setErro(error instanceof Error ? error.message : 'Falha na importação automática.');
    } finally {
      coletaId.current = '';
      if (montado.current) { setColetando(false); setJobAtivo(''); }
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

  const nomes: Record<Linha['estado'], string> = { aguardando: 'Aguardando', consultando: 'Consultando', existente: 'Já no banco', salvo: 'Salva', pendente: 'Pendente' };
  const cores: Record<Linha['estado'], string> = { aguardando: 'bg-slate-500/10 text-slate-300', consultando: 'bg-blue-500/10 text-blue-300', existente: 'bg-purple-500/10 text-purple-300', salvo: 'bg-emerald-500/10 text-emerald-300', pendente: 'bg-amber-500/10 text-amber-300' };

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
          <Link href="/PainelAlpha/HabilitacaoRadar" className={btn}><Database size={16} />Consulta Radar</Link>
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
              <p className="text-xs text-slate-300">Login e código do Gmail automáticos. Coleta empresas com 1 a 2 embarques DIRETO/HOUSE e encaminha para consulta e gravação.</p>
              <div className="flex flex-wrap gap-3"><label className="text-xs text-slate-300">Data de referência<input type="date" value={dataColeta} disabled={ativo || coletando} onChange={e => setDataColeta(e.target.value)} className="mt-1 block rounded-xl border border-white/10 bg-slate-900 p-2 text-sm" /><span className="mt-1 block text-slate-400">Em branco: hoje em São Paulo</span></label>
                <label className="text-xs text-slate-300">Limite de empresas<input type="number" min={1} max={10000} value={limiteColeta} disabled={ativo || coletando} onChange={e => setLimiteColeta(Number(e.target.value))} className="mt-1 block w-32 rounded-xl border border-white/10 bg-slate-900 p-2 text-sm" /></label></div>
              <button className={`${btn} ${visual.bg}`} disabled={ativo || coletando || carregando || !Number.isInteger(limiteColeta) || limiteColeta < 1 || limiteColeta > 10000} onClick={() => void importarAutomatico()}>{coletando ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}Importar automaticamente da Logcomex</button>
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
            <p className="text-sm text-slate-300">JSON da Logcomex com a lista <code>empresas</code>, contendo <code>cnpj</code> e <code>consignatario</code>. Até 5 MB e 10.000 empresas.</p>
            <input ref={fileRef} id="catcher-file" type="file" accept=".json,application/json" className="sr-only" disabled={ativo} onChange={e => void carregar(e.target.files?.[0])} />
            <button disabled={ativo || carregando || coletando} className={`${btn} min-h-24 w-full border-dashed`} onClick={() => fileRef.current?.click()}><Upload size={24} />{carregando ? 'Lendo arquivo…' : arquivo || 'Selecionar arquivo JSON'}</button>
            <p className="text-xs text-slate-400">{resumo.invalidos} inválidos · {resumo.duplicados} duplicados removidos. Empresas existentes são preservadas.</p>
            <p className="text-xs text-slate-400">Os resultados desta fila ficam nesta tela até sair ou recarregar. Exporte o relatório para mantê-los.</p>
            {erro && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300">{erro}</p>}
          </CardComScan>

          <CardComScan accentRgb={visual.accent} className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider">{ativo ? <Loader2 size={18} className="animate-spin" /> : <Radar size={18} />}Monitor de processamento</h2>
            <p role="status" aria-live="polite" className="min-h-10 text-sm text-slate-300">{pausado ? 'Fila pausada. A consulta já iniciada pode concluir.' : status}</p>
            <div className="flex justify-between text-xs text-slate-400"><span>{concluidos} de {stats.total} processadas</span><span>{progresso}%</span></div>
            <div role="progressbar" aria-label="Empresas processadas" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full transition-all ${visual.bg}`} style={{ width: `${progresso}%` }} /></div>
            <div className="flex flex-wrap gap-2">
              {!ativo && <button className={`${btn} ${visual.bg}`} disabled={!aguardando || carregando || coletando} onClick={() => void executar()}><Play size={16} />{concluidos ? 'Continuar fila' : 'Iniciar e salvar'}</button>}
              {ativo && <><button className={btn} onClick={() => { controle.current.pausar = !controle.current.pausar; setPausado(controle.current.pausar); }}><Pause size={16} />{pausado ? 'Retomar' : 'Pausar'}</button>
                <button className={btn} onClick={() => { controle.current.cancelar = true; setStatus('Interrompendo após a consulta em andamento…'); }}><Square size={16} />Interromper</button></>}
              <button className={btn} disabled={ativo || carregando || coletando || !stats.pendentes} onClick={() => void executar(true)}><RefreshCw size={16} />Tentar pendências</button>
            </div>
            <p className="text-xs text-slate-400">As APIs são consultadas em paralelo, com intervalo mínimo de 30 segundos entre empresas novas. Falhas permanecem pendentes.</p>
          </CardComScan>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
            <h2 className="text-sm font-bold">Resultados · {exibidas.length} empresas</h2>
            <div className="flex flex-wrap gap-3"><label className="flex items-center gap-2 text-xs text-slate-300">Exibir
              <select className="rounded-xl border border-white/10 bg-slate-900 p-2 text-sm" value={filtro} onChange={e => { setFiltro(e.target.value); setPagina(0); }}>
                <option value="todos">Todas</option>{Object.entries(nomes).map(([key, nome]) => <option key={key} value={key}>{nome}</option>)}
              </select></label><button className={btn} disabled={!linhas.length} onClick={exportar}><Download size={16} />Exportar JSON</button></div>
          </div>
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-400"><tr>{['CNPJ', 'Empresa / consignatário', 'Processamento', 'Situação Radar', 'Modalidade', 'Localidade', 'Observação'].map(c => <th scope="col" key={c} className="p-4">{c}</th>)}</tr></thead>
              <tbody className="divide-y divide-white/5">{exibidas.slice(paginaAtual * 50, (paginaAtual + 1) * 50).map(l => <tr key={l.cnpj} className="hover:bg-white/5">
                <td className={`whitespace-nowrap p-4 font-mono ${visual.text}`}>{l.cnpj}</td><td className="min-w-52 p-4"><p className="font-semibold">{l.razaoSocial || l.consignatario}</p>{l.razaoSocial && <p className="mt-1 text-xs text-slate-400">{l.consignatario}</p>}</td>
                <td className="p-4"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${cores[l.estado]}`}>{nomes[l.estado]}</span></td>
                <td className="p-4">{l.situacao || '—'}</td><td className="p-4">{l.modalidade || '—'}</td><td className="p-4">{[l.municipio, l.uf].filter(Boolean).join(' / ') || '—'}</td><td className="min-w-56 p-4 text-xs text-slate-400">{l.mensagem || '—'}</td>
              </tr>)}{!exibidas.length && <tr><td colSpan={7} className="p-16 text-center text-slate-400">{linhas.length ? 'Nenhuma empresa corresponde ao filtro.' : 'Importe um JSON para começar a captura.'}</td></tr>}</tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-white/10 p-4 text-xs text-slate-400"><span>Página {paginaAtual + 1} de {ultimaPagina + 1} · 50 por página</span><div className="flex gap-2"><button className={btn} disabled={paginaAtual === 0} onClick={() => setPagina(paginaAtual - 1)}>Anterior</button><button className={btn} disabled={paginaAtual === ultimaPagina} onClick={() => setPagina(paginaAtual + 1)}>Próxima</button></div></div>
        </section>
      </main>
    </div>
  );
}
