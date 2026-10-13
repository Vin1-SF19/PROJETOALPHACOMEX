"use client";

import { useEffect, useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { CorrigirHistoricoExternoRd, ListarHistoricoExternoRd } from "@/actions/bpm/RdStationHistorico";
import { apresentarEventoRd, ajustesLegiveisRd } from "@/lib/bpm/rd-station-display";
import { fmtDateTime, formatarDataHoraLocalBpm, parseDataHoraLocalBpm } from "@/lib/format-date";

type Resultado = Awaited<ReturnType<typeof ListarHistoricoExternoRd>>;
type Evento = Extract<Resultado, { success: true }> extends { data: infer T } ? T extends Array<infer E> ? E : never : never;

export function useHistoricoRd(cardId: string, revision = 0) {
  const [loaded, setLoaded] = useState<{ key: string; eventos: Evento[]; origem: { pipeline: string; etapa: string; nome: string } | null; erro: string | null } | null>(null);
  const [reload, setReload] = useState(0);
  const key = `${cardId}:${revision}:${reload}`;
  useEffect(() => {
    let cancelado = false;
    void ListarHistoricoExternoRd(cardId).then((result) => {
      if (cancelado) return;
      if (result.success) {
        setLoaded({ key, eventos: result.data as Evento[], origem: "origem" in result ? result.origem ?? null : null, erro: null });
      } else setLoaded({ key, eventos: [], origem: null, erro: result.error });
    }).catch(() => { if (!cancelado) setLoaded({ key, eventos: [], origem: null, erro: "Não foi possível carregar o histórico RD. Tente novamente." }); });
    return () => { cancelado = true; };
  }, [cardId, key]);
  const atual = loaded?.key === key ? loaded : null;
  return { eventos: atual?.eventos ?? [], origem: atual?.origem ?? null, carregando: !atual, erro: atual?.erro ?? null, recarregar: () => setReload((n) => n + 1) };
}

export function EstadoHistoricoRd({ historico }: { historico: ReturnType<typeof useHistoricoRd> }) {
  if (historico.carregando) return <p role="status" className="text-xs text-slate-400">Carregando histórico RD…</p>;
  if (historico.erro) return <div role="alert" className="text-xs text-rose-300">{historico.erro} <button type="button" className="underline" onClick={historico.recarregar}>Tentar novamente</button></div>;
  return null;
}

export function EventoHistoricoRdItem({ evento, podeEditar, onAtualizado }: { evento: Evento; podeEditar: boolean; onAtualizado: () => void }) {
  const [edicao, setEdicao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const { titulo, conteudo, data, tipo, etapaIndisponivel } = apresentarEventoRd(evento);
  async function salvar(event: React.FormEvent<HTMLFormElement>, evento: Evento) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const dataLocal = String(form.get("data") ?? "");
    const dataCorrigida = dataLocal === formatarDataHoraLocalBpm(data) ? data : dataLocal ? parseDataHoraLocalBpm(dataLocal)?.toISOString() : "";
    if (dataCorrigida === undefined) { toast.error("Informe uma data válida."); return; }
    setSalvando(true);
    try {
      const result = await CorrigirHistoricoExternoRd({ eventoId: evento.id, titulo: form.get("titulo"), conteudo: form.get("conteudo"), data: dataCorrigida });
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Histórico atualizado.");
      setEdicao(false);
      onAtualizado();
    } catch { toast.error("Não foi possível salvar a correção. Tente novamente."); }
    finally { setSalvando(false); }
  }

  return <li className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            {edicao ? (
              <form onSubmit={(formEvent) => void salvar(formEvent, evento)} className="space-y-2">
                <label className="block text-[11px] text-slate-400">Título<input name="titulo" defaultValue={titulo} maxLength={500} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white" /></label>
                <label className="block text-[11px] text-slate-400">Observação<textarea name="conteudo" defaultValue={conteudo} maxLength={12000} rows={3} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white" /></label>
                <label className="block text-[11px] text-slate-400">Data e hora (Brasília)<input name="data" type="datetime-local" defaultValue={formatarDataHoraLocalBpm(data)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white" /></label>
                <div className="flex justify-end gap-2"><button type="button" onClick={() => setEdicao(false)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-300"><X size={13} />Cancelar</button><button disabled={salvando} className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-xs text-sky-200 disabled:opacity-50"><Save size={13} />Salvar correção</button></div>
              </form>
            ) : (
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-100">{titulo}</p><p className="mt-0.5 text-[10px] text-slate-500">{data ? fmtDateTime(data) : "Data ausente na origem"} · RD Station · {tipo}</p>{conteudo && <p className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-300">{conteudo}</p>}</div>
                {podeEditar && <button type="button" onClick={() => setEdicao(true)} aria-label={`Corrigir ${titulo}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><Pencil size={14} /></button>}
              </div>
            )}
            {etapaIndisponivel && <p className="mt-2 text-[11px] text-amber-300">Nome da etapa indisponível. O registro original foi preservado.</p>}
            {evento.tipo === "DEAL_STAGE_HISTORY" && <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div><dt className="text-slate-500">Entrada na etapa no RD</dt><dd className="mt-0.5 text-slate-300">{evento.periodoOriginal.entrada ? fmtDateTime(evento.periodoOriginal.entrada) : "Não informada"}</dd></div>
              <div><dt className="text-slate-500">Saída da etapa no RD</dt><dd className="mt-0.5 text-slate-300">{evento.periodoOriginal.saida ? fmtDateTime(evento.periodoOriginal.saida) : "Sem saída registrada no RD"}</dd></div>
            </dl>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.05] pt-2">
              {evento.correcoes.length > 0 && <details className="text-[10px] text-slate-400">
                <summary className="cursor-pointer hover:text-slate-200">Histórico de ajustes · {evento.correcoes.length}</summary>
                <ol className="mt-2 space-y-2">{evento.correcoes.map((correcao) => <li key={`${evento.id}-${correcao.versao}`} className="rounded-lg bg-black/30 p-2">
                  <p className="font-semibold text-slate-200">{correcao.autor} · {fmtDateTime(correcao.data)}</p>
                  <dl className="mt-2 space-y-2">{ajustesLegiveisRd(correcao.anterior, correcao.nova).map((ajuste) => <div key={ajuste.campo}>
                    <dt className="font-semibold text-slate-300">{ajuste.campo}</dt>
                    <dd className="whitespace-pre-wrap break-words">Antes: {ajuste.antes ? ajuste.data && Number.isFinite(Date.parse(ajuste.antes)) ? fmtDateTime(ajuste.antes) : ajuste.antes : "Não informado"}</dd>
                    <dd className="whitespace-pre-wrap break-words text-slate-200">Depois: {ajuste.depois ? ajuste.data && Number.isFinite(Date.parse(ajuste.depois)) ? fmtDateTime(ajuste.depois) : ajuste.depois : "Não informado"}</dd>
                  </div>)}</dl>
                </li>)}</ol>
              </details>}
            </div>
  </li>;
}

export default function PainelHistoricoRd({ historico, accent, podeEditar }: { historico: ReturnType<typeof useHistoricoRd>; accent: string; podeEditar: boolean }) {
  const { origem, eventos } = historico;
  if (!origem) return <EstadoHistoricoRd historico={historico} />;
  return <section aria-label="Histórico importado do RD Station" className="space-y-3 rounded-2xl border border-white/[0.08] bg-black/15 p-3">
    <header className="flex flex-wrap items-center gap-2">
      <span className="rounded-full border px-2 py-1 text-[10px] font-bold" style={{ borderColor: `rgba(${accent},.5)`, color: `rgb(${accent})` }}>RD Station</span>
      <span className="text-xs text-slate-300">{origem.pipeline} · etapa de origem: {origem.etapa}</span>
      <span className="ml-auto text-[10px] text-slate-500">{eventos.length} eventos</span>
    </header>
    <EstadoHistoricoRd historico={historico} />
    <ol className="space-y-2">{eventos.map((evento) => <EventoHistoricoRdItem key={evento.id} evento={evento} podeEditar={podeEditar} onAtualizado={historico.recarregar} />)}</ol>
  </section>;
}
