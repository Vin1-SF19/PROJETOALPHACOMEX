"use client";

import { useEffect, useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { CorrigirHistoricoExternoRd, ListarHistoricoExternoRd } from "@/actions/bpm/RdStationHistorico";
import { fmtDateTime } from "@/lib/format-date";

type Resultado = Awaited<ReturnType<typeof ListarHistoricoExternoRd>>;
type Evento = Extract<Resultado, { success: true }> extends { data: infer T } ? T extends Array<infer E> ? E : never : never;

export default function PainelHistoricoRd({ cardId, accent, podeEditar }: { cardId: string; accent: string; podeEditar: boolean }) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [origem, setOrigem] = useState<{ pipeline: string; etapa: string; nome: string } | null>(null);
  const [edicao, setEdicao] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void ListarHistoricoExternoRd(cardId).then((result) => {
      if (cancelado) return;
      if (result.success) {
        setEventos(result.data as Evento[]);
        setOrigem("origem" in result ? result.origem ?? null : null);
      } else toast.error(result.error);
      setCarregando(false);
    });
    return () => { cancelado = true; };
  }, [cardId]);
  if (carregando || !origem) return null;

  async function salvar(event: React.FormEvent<HTMLFormElement>, evento: Evento) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSalvando(true);
    const result = await CorrigirHistoricoExternoRd({ eventoId: evento.id, titulo: form.get("titulo"), conteudo: form.get("conteudo"), data: form.get("data") });
    if (result.success) {
      toast.success("Representação corrigida; origem RD preservada.");
      setEdicao(null);
      const updated = await ListarHistoricoExternoRd(cardId);
      if (updated.success) {
        setEventos(updated.data as Evento[]);
        setOrigem("origem" in updated ? updated.origem ?? null : null);
      }
    }
    else toast.error(result.error);
    setSalvando(false);
  }

  return (
    <section aria-label="Histórico importado do RD Station" className="space-y-3 rounded-2xl border border-white/[0.08] bg-black/15 p-3">
      <header className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border px-2 py-1 text-[10px] font-bold" style={{ borderColor: `rgba(${accent},.5)`, color: `rgb(${accent})` }}>RD Station</span>
        <span className="text-xs text-slate-300">{origem.pipeline} · etapa de origem: {origem.etapa}</span>
        <span className="ml-auto text-[10px] text-slate-500">{eventos.length} eventos · original preservado</span>
      </header>
      <ol className="space-y-2">
        {eventos.map((evento) => {
          const projected = evento.projecao as Record<string, unknown>;
          const titulo = String(projected.title ?? projected.sourceStageName ?? evento.tipo);
          const conteudo = String(projected.content ?? "");
          const data = String(projected.date ?? evento.data ?? "");
          return <li key={evento.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            {edicao === evento.id ? (
              <form onSubmit={(formEvent) => void salvar(formEvent, evento)} className="space-y-2">
                <label className="block text-[11px] text-slate-400">Título<input name="titulo" defaultValue={titulo} maxLength={500} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white" /></label>
                <label className="block text-[11px] text-slate-400">Conteúdo<textarea name="conteudo" defaultValue={conteudo} maxLength={12000} rows={3} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white" /></label>
                <label className="block text-[11px] text-slate-400">Data de exibição<input name="data" defaultValue={data} maxLength={100} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white" /></label>
                <div className="flex justify-end gap-2"><button type="button" onClick={() => setEdicao(null)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-300"><X size={13} />Cancelar</button><button disabled={salvando} className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-xs text-sky-200 disabled:opacity-50"><Save size={13} />Salvar correção</button></div>
              </form>
            ) : (
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-100">{titulo}</p><p className="mt-0.5 text-[10px] text-slate-500">{data ? fmtDateTime(data) : "Data ausente na origem"} · {evento.tipo.replaceAll("_", " ")}</p>{conteudo && <p className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-300">{conteudo}</p>}</div>
                {podeEditar && <button type="button" onClick={() => setEdicao(evento.id)} aria-label={`Corrigir ${titulo}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><Pencil size={14} /></button>}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.05] pt-2">
              <details className="text-[10px] text-slate-400">
                <summary className="cursor-pointer hover:text-slate-200">Payload original RD · somente leitura</summary>
                <pre className="mt-2 max-h-72 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-2 text-[10px] text-slate-300">{JSON.stringify(evento.original, null, 2)}</pre>
              </details>
              {evento.correcoes.length > 0 && <details className="text-[10px] text-slate-400">
                <summary className="cursor-pointer hover:text-slate-200">Correções auditáveis · {evento.correcoes.length}</summary>
                <ol className="mt-2 space-y-2">{evento.correcoes.map((correcao) => <li key={`${evento.id}-${correcao.versao}`} className="rounded-lg bg-black/30 p-2">
                  <p className="font-semibold text-slate-200">Versão {correcao.versao} · {correcao.autor} · {fmtDateTime(correcao.data)}</p>
                  <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify({ antes: correcao.anterior, depois: correcao.nova }, null, 2)}</pre>
                </li>)}</ol>
              </details>}
            </div>
          </li>;
        })}
      </ol>
    </section>
  );
}
