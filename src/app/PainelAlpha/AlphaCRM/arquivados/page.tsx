import Link from "next/link";
import { Archive, ArrowLeft, ArrowRight } from "lucide-react";
import { ListarCardsArquivadosBpm } from "@/actions/bpm/Arquivados";
import { fmtDateTime } from "@/lib/format-date";

export const dynamic = "force-dynamic";

export default async function ArquivadosPage({ searchParams }: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { pagina } = await searchParams;
  const resultado = await ListarCardsArquivadosBpm(Number(pagina) || 1);
  const arquivo = resultado.success ? resultado.data : null;
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8 sm:px-8">
      <Link href="/PainelAlpha/AlphaCRM" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={16} />Dashboard</Link>
      <div className="flex items-center gap-3"><Archive className="text-slate-300" /><div><h1 className="text-2xl font-bold text-white">Cards arquivados</h1><p className="text-sm text-slate-400">Histórico dos cards que você pode consultar.</p></div></div>
      {!arquivo ? <p role="alert" className="rounded-xl border border-rose-500/30 p-5 text-rose-200">{resultado.error}</p> : <>
        <p className="text-sm text-slate-400">{arquivo.total} card{arquivo.total === 1 ? "" : "s"} arquivado{arquivo.total === 1 ? "" : "s"}</p>
        {arquivo.cards.length === 0 ? <p className="rounded-xl border border-white/10 bg-slate-900/60 p-8 text-center text-slate-300">Nenhum card arquivado disponível nesta página.</p> :
          <ul className="space-y-3">{arquivo.cards.map((card) => <li key={card.id}>
            <Link href={`/PainelAlpha/AlphaCRM/arquivados/${encodeURIComponent(card.id)}`} className="group flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-slate-900/70 p-4 transition-colors hover:border-slate-400/40 hover:bg-slate-800/80">
              <div className="min-w-0 space-y-1">
                <h2 className="font-semibold text-white">{card.empresa.razaoSocial || card.empresa.nomeFantasia || "Empresa sem nome"}</h2>
                <p className="text-sm text-slate-300">{card.localizacao.pipelineNome} · {card.localizacao.etapaNome}</p>
                <p className="text-xs text-slate-400">Responsável: {card.responsavel} · Arquivado em {fmtDateTime(card.arquivadoEm)}</p>
              </div><ArrowRight className="mt-1 shrink-0 text-slate-400 group-hover:text-white" size={18} />
            </Link>
          </li>)}</ul>}
        <nav aria-label="Páginas de cards arquivados" className="flex items-center justify-between text-sm text-slate-300">
          {arquivo.pagina > 1 ? <Link href={`?pagina=${arquivo.pagina - 1}`} className="hover:text-white">← Anterior</Link> : <span />}
          <span>Página {arquivo.pagina} de {Math.max(1, Math.ceil(arquivo.total / arquivo.porPagina))}</span>
          {arquivo.pagina * arquivo.porPagina < arquivo.total ? <Link href={`?pagina=${arquivo.pagina + 1}`} className="hover:text-white">Próxima →</Link> : <span />}
        </nav>
      </>}
    </main>
  );
}
