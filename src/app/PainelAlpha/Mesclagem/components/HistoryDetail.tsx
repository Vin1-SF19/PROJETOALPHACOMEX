import Link from "next/link";
import { ArrowLeft, Download, FileInput, FileOutput, Files } from "lucide-react";

interface HistoricoDetalhe {
  id: string;
  criadoEm: Date;
  principalNome: string;
  principalTamanhoBytes: number;
  complementarNome: string;
  complementarTamanhoBytes: number;
  resultadoNome: string;
  resultadoTamanhoBytes: number;
  empresasProcessadas: number;
  empresasComCorrespondencia: number;
  empresasSemCorrespondencia: number;
  linhasResultado: number;
  criadoPor: { nome: string };
}

function bytes(valor: number): string {
  if (valor < 1024 * 1024) return `${(valor / 1024).toFixed(1)} KB`;
  return `${(valor / (1024 * 1024)).toFixed(1)} MB`;
}

function dataHora(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(data);
}

export function HistoryDetail({ item }: { item: HistoricoDetalhe }) {
  const arquivos = [
    { tipo: "principal", titulo: "1. Planilha principal", nome: item.principalNome, tamanho: item.principalTamanhoBytes, Icone: FileInput, cor: "text-sky-200 bg-sky-500/10 border-sky-400/20" },
    { tipo: "complementar", titulo: "2. Planilha complementar", nome: item.complementarNome, tamanho: item.complementarTamanhoBytes, Icone: Files, cor: "text-violet-200 bg-violet-500/10 border-violet-400/20" },
    { tipo: "resultado", titulo: "3. Resultado", nome: item.resultadoNome, tamanho: item.resultadoTamanhoBytes, Icone: FileOutput, cor: "text-emerald-200 bg-emerald-500/10 border-emerald-400/20" },
  ];
  return (
    <main className="min-h-dvh bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-950 px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1300px]">
        <Link href="/PainelAlpha/Mesclagem" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white"><ArrowLeft className="size-4" /> Voltar ao histórico</Link>
        <header className="mt-4 rounded-3xl border border-indigo-400/15 bg-slate-900/90 p-6 shadow-2xl lg:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-300">Mesclagem concluída</p>
          <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">{dataHora(item.criadoEm)}</h1>
          <p className="mt-1 text-sm text-slate-400">Criada por {item.criadoPor.nome}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Empresas", item.empresasProcessadas], ["Com match", item.empresasComCorrespondencia],
              ["Sem match", item.empresasSemCorrespondencia], ["Linhas finais", item.linhasResultado],
            ].map(([rotulo, valor]) => <div key={String(rotulo)} className="rounded-xl border border-white/10 bg-slate-950/50 p-3"><strong className="block text-xl text-white">{Number(valor).toLocaleString("pt-BR")}</strong><span className="text-[10px] font-bold uppercase text-slate-500">{rotulo}</span></div>)}
          </div>
        </header>
        <section className="mt-5 grid gap-4 lg:grid-cols-3" aria-label="Arquivos da mesclagem">
          {arquivos.map(({ tipo, titulo, nome, tamanho, Icone, cor }) => (
            <article key={tipo} className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
              <div className={`flex size-11 items-center justify-center rounded-xl border ${cor}`}><Icone className="size-5" /></div>
              <h2 className="mt-4 font-bold text-white">{titulo}</h2>
              <p className="mt-1 truncate text-sm text-slate-400" title={nome}>{nome}</p>
              <p className="mt-1 text-xs text-slate-600">{bytes(tamanho)}</p>
              <a href={`/api/mesclagem/historico/${item.id}/arquivo/${tipo}`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-4 py-3 text-sm font-black text-indigo-100 transition hover:bg-indigo-500/20">
                <Download className="size-4" /> Baixar arquivo
              </a>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
