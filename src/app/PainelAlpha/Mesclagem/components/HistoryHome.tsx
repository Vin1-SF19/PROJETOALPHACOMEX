import Link from "next/link";
import { ArrowRight, FileSpreadsheet, History, Plus, ShieldCheck } from "lucide-react";

interface ItemHistorico {
  id: string;
  criadoEm: Date;
  principalNome: string;
  complementarNome: string;
  resultadoNome: string;
  empresasProcessadas: number;
  empresasComCorrespondencia: number;
  empresasSemCorrespondencia: number;
  linhasResultado: number;
  criadoPor: { nome: string };
}

function formatarData(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

export function HistoryHome({ historico }: { historico: ItemHistorico[] }) {
  return (
    <main className="min-h-dvh bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-950 px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <header className="rounded-3xl border border-indigo-400/15 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl lg:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-500/10 text-indigo-100">
                <History className="size-7" />
              </div>
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200">
                  <ShieldCheck className="size-3" /> Arquivos privados
                </span>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Histórico de Mesclagens</h1>
                <p className="mt-2 text-sm text-slate-400">Consulte as últimas operações e recupere a principal, a complementar ou o resultado.</p>
              </div>
            </div>
            <Link href="/PainelAlpha/Mesclagem/nova" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-violet-600 to-rose-500 px-5 py-3 text-sm font-black text-white shadow-xl transition hover:brightness-110">
              <Plus className="size-4" /> Nova mesclagem
            </Link>
          </div>
        </header>

        {historico.length === 0 ? (
          <section className="mt-5 rounded-2xl border border-dashed border-indigo-400/25 bg-slate-900/60 p-10 text-center shadow-xl">
            <FileSpreadsheet className="mx-auto size-10 text-indigo-300" />
            <h2 className="mt-4 text-lg font-bold text-white">Nenhuma mesclagem registrada</h2>
            <p className="mt-1 text-sm text-slate-400">A próxima exportação aparecerá aqui com os três arquivos separados.</p>
          </section>
        ) : (
          <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Últimas mesclagens">
            {historico.map((item) => (
              <Link key={item.id} href={`/PainelAlpha/Mesclagem/${item.id}`} className="group rounded-2xl border border-indigo-400/15 bg-slate-900/80 p-5 shadow-xl transition hover:-translate-y-0.5 hover:border-indigo-400/35 hover:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-200">
                    <FileSpreadsheet className="size-5" />
                  </div>
                  <ArrowRight className="size-4 text-slate-600 transition group-hover:translate-x-1 group-hover:text-indigo-300" />
                </div>
                <h2 className="mt-4 font-bold text-white">Mesclagem de {formatarData(item.criadoEm)}</h2>
                <p className="mt-1 truncate text-xs text-slate-500">Por {item.criadoPor.nome}</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div><strong className="block text-lg text-white">{item.empresasProcessadas.toLocaleString("pt-BR")}</strong><span className="text-[10px] uppercase text-slate-500">Empresas</span></div>
                  <div><strong className="block text-lg text-emerald-300">{item.empresasComCorrespondencia.toLocaleString("pt-BR")}</strong><span className="text-[10px] uppercase text-slate-500">Com match</span></div>
                  <div><strong className="block text-lg text-indigo-300">{item.linhasResultado.toLocaleString("pt-BR")}</strong><span className="text-[10px] uppercase text-slate-500">Resultado</span></div>
                </div>
                <div className="mt-4 space-y-1 border-t border-white/10 pt-3 text-xs text-slate-500">
                  <p className="truncate">1. {item.principalNome}</p>
                  <p className="truncate">2. {item.complementarNome}</p>
                  <p className="truncate">3. {item.resultadoNome}</p>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
