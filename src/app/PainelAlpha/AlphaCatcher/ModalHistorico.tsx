'use client';
import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { getTema } from '@/lib/temas';
import { detalheHistoricoSchema, type DetalheHistorico, type HistoricoImportacao } from '@/lib/alpha-catcher/historico-tipos';
import { formatarDataInclusaoCatcher } from '@/lib/alpha-catcher/resultados';
import ResultadosCatcher from './ResultadosCatcher';
export default function ModalHistorico({ importacao, visual, onFechar, onRestaurarFoco }: { importacao: HistoricoImportacao | null; visual: ReturnType<typeof getTema>; onFechar: () => void; onRestaurarFoco: () => void }) {
  const [detalhe, setDetalhe] = useState<DetalheHistorico | null>(null);
  const [erro, setErro] = useState('');
  const [atualizacao, setAtualizacao] = useState(0);
  const id = importacao?.id;
  const registroId = importacao?.registroId;
  const referencia = registroId ? String(registroId) : id;
  const acompanhar = Boolean(importacao && !importacao.recuperadoEm && !importacao.fim && !['erro', 'cancelado', 'interrompido'].includes(importacao.estado));
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    async function carregar() {
      try {
        const res = await fetch(`/api/alpha-catcher/historico/${encodeURIComponent(referencia!)}`, { cache: 'no-store', signal: controller.signal });
        const dados = await res.json(); if (!res.ok) throw new Error();
        const parsed = detalheHistoricoSchema.parse(dados);
        if (parsed.importacao.id !== id || (registroId && parsed.importacao.registroId !== registroId)) throw new Error();
        if (!controller.signal.aborted) { setDetalhe(parsed); setErro(''); }
      } catch { if (!controller.signal.aborted) setErro('Não foi possível carregar a lista. Tente atualizar.'); }
    }
    void carregar();
    const timer = acompanhar ? setInterval(() => { void carregar(); }, 5000) : undefined;
    return () => { controller.abort(); if (timer) clearInterval(timer); };
  }, [id, registroId, referencia, acompanhar, atualizacao]);
  const atual = detalhe && detalhe.importacao.id === id && (!registroId || detalhe.importacao.registroId === registroId) ? detalhe : null;
  function exportar() {
    if (!atual) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ importacao: atual.importacao, resultados: atual.linhas }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `alpha-catcher-${id}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <Dialog open={Boolean(importacao)} onOpenChange={open => { if (!open) onFechar(); }}>
    <DialogContent showCloseButton={false} onCloseAutoFocus={e => { e.preventDefault(); onRestaurarFoco(); }} className="max-h-[97dvh] w-[98vw] max-w-[98vw] overflow-y-auto border-white/10 bg-slate-950 p-4 text-slate-100 sm:max-w-[98vw] md:p-6">
      <DialogClose asChild><button type="button" aria-label="Fechar histórico" className="absolute right-4 top-4 rounded p-1 text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-2"><X size={20} /></button></DialogClose>
      <DialogTitle className={visual.text}>Resultados da importação</DialogTitle>
      <DialogDescription className="text-slate-400">{importacao?.origem === 'JSON' ? `JSON · ${importacao.arquivo || 'Arquivo importado'}` : 'Logcomex'} · {importacao?.recuperadoEm ? 'Histórico recuperado — cadastros atuais' : formatarDataInclusaoCatcher(importacao?.inicio)} · Lista e resultados registrados nesta importação.</DialogDescription>
      <p className="text-xs text-slate-400">Por {importacao?.autor?.usuario ? `@${importacao.autor.usuario}` : 'autor indisponível'}</p>
      <button type="button" onClick={() => setAtualizacao(v => v + 1)} className={`inline-flex items-center gap-2 justify-self-start text-xs ${visual.text}`}><RefreshCw size={14} />Atualizar lista</button>
      {erro && <p role="alert" className="text-sm text-amber-300">{erro}</p>}
      {!atual && !erro && <p role="status" className="text-sm text-slate-400">Carregando lista…</p>}
      {atual && !atual.importacao.listaDisponivel && <p className="text-sm text-slate-400">Esta importação registrou somente o resumo. A lista de empresas não está disponível neste histórico.</p>}
      {atual?.importacao.listaDisponivel && <ResultadosCatcher key={referencia} linhas={atual.linhas} visual={visual} onExportar={exportar} vazio="Nenhuma empresa foi coletada nesta importação." />}
    </DialogContent>
  </Dialog>;
}
