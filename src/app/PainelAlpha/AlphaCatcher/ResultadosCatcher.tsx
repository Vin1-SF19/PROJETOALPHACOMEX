'use client';
import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown, Download, FileSpreadsheet } from 'lucide-react';
import { gerarExcelCatcher } from '@/lib/alpha-catcher/exportar-excel';
import type { getTema } from '@/lib/temas';
import type { LinhaResultadoCatcher as Linha } from '@/lib/alpha-catcher/historico-tipos';
import { formatarCapitalCatcher, dataOpcaoSimplesCatcher, formatarDataOpcaoCatcher, formatarDataInclusaoCatcher, ordenarResultadosCatcher, type CampoOrdenacaoCatcher } from '@/lib/alpha-catcher/resultados';
const btn = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40';
const colunasResultados: { titulo: string; campo: Exclude<CampoOrdenacaoCatcher, 'original'> }[] = [
  { titulo: 'Data da consulta', campo: 'dataConsulta' },
  { titulo: 'CNPJ', campo: 'cnpj' },
  { titulo: 'Razão social', campo: 'razaoSocial' },
  { titulo: 'Nome fantasia', campo: 'nomeFantasia' },
  { titulo: 'Processamento', campo: 'estado' },
  { titulo: 'Situação Radar', campo: 'situacao' },
  { titulo: 'Modalidade', campo: 'modalidade' },
  { titulo: 'UF', campo: 'uf' },
  { titulo: 'Município', campo: 'municipio' },
  { titulo: 'Regime tributário', campo: 'regimeTributario' },
  { titulo: 'Data da opção', campo: 'dataOpcao' },
  { titulo: 'Capital social', campo: 'capitalSocial' },
];
export default function ResultadosCatcher({ linhas, visual, onExportar, vazio = 'Importe um JSON para começar a captura.' }: { linhas: readonly Linha[]; visual: ReturnType<typeof getTema>; onExportar: () => void; vazio?: string }) {
  const [filtro, setFiltro] = useState('todos');
  const [ordenacao, setOrdenacao] = useState<CampoOrdenacaoCatcher>('original');
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<'asc' | 'desc'>('asc');
  const [pagina, setPagina] = useState(0);
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [erroExcel, setErroExcel] = useState('');
  const exibidas = useMemo(() => ordenarResultadosCatcher(linhas.filter(l => filtro === 'todos' || l.estado === filtro), ordenacao, direcaoOrdenacao), [linhas, filtro, ordenacao, direcaoOrdenacao]);
  const ultimaPagina = Math.max(0, Math.ceil(exibidas.length / 50) - 1);
  const paginaAtual = Math.min(pagina, ultimaPagina);
  async function exportarExcel() {
    if (exportandoExcel || !exibidas.length) return;
    setExportandoExcel(true); setErroExcel('');
    try {
      const buffer = await gerarExcelCatcher(exibidas);
      const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'alpha-catcher-resultados.xlsx'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setErroExcel('Não foi possível exportar a planilha. Tente novamente.'); }
    finally { setExportandoExcel(false); }
  }
  const nomes: Record<Linha['estado'], string> = { aguardando: 'Aguardando', consultando: 'Consultando', existente: 'Já no banco', salvo: 'Salva', pendente: 'Pendente' };
  const cores: Record<Linha['estado'], string> = { aguardando: 'bg-slate-500/10 text-slate-300', consultando: 'bg-blue-500/10 text-blue-300', existente: 'bg-purple-500/10 text-purple-300', salvo: 'bg-emerald-500/10 text-emerald-300', pendente: 'bg-amber-500/10 text-amber-300' };
  return (
<section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
            <h2 className="text-sm font-bold">Resultados · {exibidas.length} empresas</h2>
            <div className="flex flex-wrap gap-3"><label className="flex items-center gap-2 text-xs text-slate-300">Exibir
              <select className="rounded-xl border border-white/10 bg-slate-900 p-2 text-sm" value={filtro} onChange={e => { setFiltro(e.target.value); setPagina(0); }}>
                <option value="todos">Todas</option>{Object.entries(nomes).map(([key, nome]) => <option key={key} value={key}>{nome}</option>)}
              </select></label>
              <button className={btn} disabled={ordenacao === 'original'} onClick={() => { setOrdenacao('original'); setPagina(0); }}>Ordem de importação</button>
              <button className={btn} disabled={!linhas.length} onClick={onExportar}><Download size={16} />Exportar JSON</button>
              <button className={btn} disabled={!exibidas.length || exportandoExcel} onClick={() => { void exportarExcel(); }}><FileSpreadsheet size={16} />{exportandoExcel ? 'Exportando…' : 'Exportar Excel'}</button></div>
          </div>
          {erroExcel && <p role="alert" className="px-4 py-3 text-sm text-amber-300">{erroExcel}</p>}
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-400"><tr>{colunasResultados.map(({ titulo, campo }) => {
              const selecionada = ordenacao === campo;
              const Icone = selecionada ? direcaoOrdenacao === 'asc' ? ArrowUp : ArrowDown : ChevronsUpDown;
              return <th scope="col" key={campo} aria-sort={selecionada ? direcaoOrdenacao === 'asc' ? 'ascending' : 'descending' : 'none'} className="p-4">
                <button type="button" onClick={() => {
                  setDirecaoOrdenacao(selecionada && direcaoOrdenacao === 'asc' ? 'desc' : 'asc');
                  setOrdenacao(campo); setPagina(0);
                }} className={`inline-flex items-center gap-2 whitespace-nowrap text-left text-xs font-bold uppercase transition hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${selecionada ? visual.text : ''}`}
                  title={`Ordenar por ${titulo}: ${selecionada && direcaoOrdenacao === 'asc' ? 'decrescente' : 'crescente'}`}>
                  {titulo}<Icone size={14} aria-hidden="true" className={selecionada ? '' : 'opacity-40'} />
                </button>
              </th>;
            })}</tr></thead>
              <tbody className="divide-y divide-white/5">{exibidas.slice(paginaAtual * 50, (paginaAtual + 1) * 50).map(l => <tr key={l.cnpj} className="hover:bg-white/5">
                <td className="whitespace-nowrap p-4" title="Data original de inclusão no banco · horário de Brasília">{l.dataConsulta ? <time dateTime={l.dataConsulta}>{formatarDataInclusaoCatcher(l.dataConsulta)}</time> : '—'}</td>
                <td className={`whitespace-nowrap p-4 font-mono ${visual.text}`}>{l.cnpj}</td>
                <td className="min-w-52 p-4 font-semibold">{l.razaoSocial || '—'}</td>
                <td className="min-w-44 p-4">{l.nomeFantasia || '—'}</td>
                <td className="p-4">
                  <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${cores[l.estado]}`}>{nomes[l.estado]}</span>
                  {l.mensagem && <p className="mt-2 text-xs text-slate-400">{l.mensagem}</p>}
                </td>
                <td className="p-4">{l.situacao || '—'}</td><td className="p-4">{l.modalidade || '—'}</td>
                <td className="p-4">{l.uf || '—'}</td><td className="p-4">{l.municipio || '—'}</td>
                <td className="p-4">{l.regimeTributario || '—'}</td>
                <td className="whitespace-nowrap p-4">{formatarDataOpcaoCatcher(dataOpcaoSimplesCatcher(l))}</td>
                <td className="whitespace-nowrap p-4">{formatarCapitalCatcher(l.capitalSocial)}</td>
              </tr>)}{!exibidas.length && <tr><td colSpan={colunasResultados.length} className="p-16 text-center text-slate-400">{linhas.length ? 'Nenhuma empresa corresponde ao filtro.' : vazio}</td></tr>}</tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-white/10 p-4 text-xs text-slate-400"><span>Página {paginaAtual + 1} de {ultimaPagina + 1} · 50 por página</span><div className="flex gap-2"><button className={btn} disabled={paginaAtual === 0} onClick={() => setPagina(paginaAtual - 1)}>Anterior</button><button className={btn} disabled={paginaAtual === ultimaPagina} onClick={() => setPagina(paginaAtual + 1)}>Próxima</button></div></div>
        </section>
  );
}
