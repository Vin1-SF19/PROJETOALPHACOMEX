import { CheckCircle2, Building2, Users, Headphones, MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ResumoImportacaoSalva } from "@/lib/cs-nps/importacao-tipos";

interface ResultadoImportacaoProps {
  resumo: ResumoImportacaoSalva;
}

export function ResultadoImportacao({ resumo }: ResultadoImportacaoProps) {
  const indicadores = [
    { rotulo: "Sócios", valor: resumo.socios, Icone: Users },
    { rotulo: "CS", valor: resumo.cs, Icone: Headphones },
    { rotulo: "Feedbacks", valor: resumo.feedbacks, Icone: MessageSquareText },
    { rotulo: "Empresas", valor: resumo.empresasAfetadas, Icone: Building2 },
  ];

  return (
    <section className="space-y-5 text-center" aria-labelledby="titulo-importacao-concluida">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-950/30">
        <CheckCircle2 className="size-8" aria-hidden="true" />
      </div>
      <div>
        <h3 id="titulo-importacao-concluida" className="text-xl font-black text-slate-100">Importação concluída</h3>
        <p className="mt-1 text-sm text-slate-400">{resumo.total} registros foram salvos com sucesso e já estão vinculados aos destinos abaixo.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {indicadores.map(({ rotulo, valor, Icone }) => (
          <div key={rotulo} className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-left">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300"><Icone className="size-4" />{rotulo}</p>
            <p className="mt-2 text-2xl font-black text-slate-100">{valor}</p>
          </div>
        ))}
      </div>

      <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1 text-left custom-scrollbar">
        {resumo.empresas.map((empresa) => (
          <article key={empresa.clienteId} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-100">{empresa.razaoSocial}</h4>
                <p className="text-xs text-slate-400">{empresa.cnpj} · {empresa.servico || "Sem serviço"} · {empresa.status}</p>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-300">{empresa.total} salvos</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
              {empresa.socios > 0 && <Badge variant="outline" className="border-white/10">{empresa.socios} sócios</Badge>}
              {empresa.cs > 0 && <Badge variant="outline" className="border-white/10">{empresa.cs} CS</Badge>}
              {empresa.feedbacks > 0 && <Badge variant="outline" className="border-white/10">{empresa.feedbacks} feedbacks</Badge>}
              <span className="self-center text-[11px] text-slate-500">Linhas: {empresa.linhasOrigem.map((item) => `${item.aba} ${item.numeroLinha}`).join(", ")}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

