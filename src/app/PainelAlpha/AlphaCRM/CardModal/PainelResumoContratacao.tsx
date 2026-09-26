"use client";

import type { ObterCardBpm } from "@/actions/bpm/Cards";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type Resumo = NonNullable<CardDetalhe["resumoContratacao"]>;

export function PainelResumoContratacao({ resumo }: { resumo: Resumo }) {
  return (
    <section aria-label="Dados da contratação" className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-100">Dados da contratação</h3>
      <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
        {resumo.campos.map(({ nome, valor }) => (
          <div key={nome} className="min-w-0">
            <dt className="text-xs text-slate-400">{nome}</dt>
            <dd className="break-words text-sm text-slate-100">
              {nome === "Link da NF" && valor?.startsWith("https://")
                ? <a href={valor} target="_blank" rel="noopener noreferrer" className="underline">Abrir nota fiscal</a>
                : nome === "Link da NF" && resumo.documentos.some((documento) => documento.id === valor)
                  ? <a href={`/api/bpm/anexos/${valor}`} target="_blank" rel="noopener noreferrer" className="underline">Abrir nota fiscal</a>
                  : valor || "Pendente"}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 border-t border-white/10 pt-3">
        <h4 className="text-xs font-semibold text-slate-300">Documentos vinculados</h4>
        {resumo.documentos.length ? (
          <ul className="mt-2 space-y-1">
            {resumo.documentos.map((documento) => (
              <li key={documento.id}>
                <a href={documento.url} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-300 underline">
                  {documento.nome}
                </a>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-xs text-slate-500">Nenhum documento vinculado.</p>}
      </div>
      <details className="mt-4 border-t border-white/10 pt-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-300">Histórico da contratação</summary>
        {resumo.historico.length ? (
          <ol className="mt-2 space-y-1 text-xs text-slate-400">
            {resumo.historico.map((item) => (
              <li key={item.id}>{new Date(item.criadoEm).toLocaleString("pt-BR")} · {item.acao}</li>
            ))}
          </ol>
        ) : <p className="mt-2 text-xs text-slate-500">Nenhum evento registrado.</p>}
      </details>
    </section>
  );
}
