"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Circle, ListChecks, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  AdicionarItemExclusivoChecklistCardBpm,
  AtualizarItemChecklistCardBpm,
  ListarChecklistsCardBpm,
} from "@/actions/bpm/Checklists";
import { AtualizarCardBpm, ObterCardBpm } from "@/actions/bpm/Cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type Checklist = Awaited<ReturnType<typeof ListarChecklistsCardBpm>>["data"][number];

function emitirResumoChecklist(cardId: string, checklists: Checklist[]) {
  const pendentes = checklists.flatMap((checklist) => checklist.itens
    .filter((item) => item.obrigatorio && item.status !== "CONCLUIDO")
    .map((item) => ({ id: item.id, templateNome: checklist.templateNome })));
  window.dispatchEvent(new CustomEvent("bpm:checklist-resumo", {
    detail: {
      cardId,
      pendentesObrigatorios: pendentes.length,
      templates: [...new Set(pendentes.map((item) => item.templateNome))],
      primeiroItemId: pendentes[0]?.id ?? null,
    },
  }));
}

export function PainelChecklistsCard({ card, accent, podeEditar, realtimeRevision, onAtualizado }: {
  card: CardDetalhe;
  accent: string;
  podeEditar: boolean;
  realtimeRevision: number;
  onAtualizado: () => void;
}) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const [novosItens, setNovosItens] = useState<Record<string, string>>({});
  const [conflitoRealtime, setConflitoRealtime] = useState(false);
  const [tipoProcesso, setTipoProcesso] = useState(card.tipoProcesso ?? "");
  const sujosRef = useRef(new Set<string>());
  const revisaoInicialRef = useRef(realtimeRevision);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const resposta = await ListarChecklistsCardBpm({ cardId: card.id });
    setCarregando(false);
    if (!resposta.success) { setErro(resposta.error); return; }
    setChecklists(resposta.data);
    emitirResumoChecklist(card.id, resposta.data);
    setObservacoes(Object.fromEntries(resposta.data.flatMap((checklist) => checklist.itens.map((item) => [item.id, item.observacao ?? ""]))));
    sujosRef.current.clear();
    setConflitoRealtime(false);
  }, [card.id]);

  useEffect(() => {
    const timer = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(timer);
  }, [carregar]);
  useEffect(() => {
    if (realtimeRevision === revisaoInicialRef.current) return;
    revisaoInicialRef.current = realtimeRevision;
    if (sujosRef.current.size > 0) { setConflitoRealtime(true); return; }
    void carregar();
  }, [carregar, realtimeRevision]);

  const totais = useMemo(() => {
    const itens = checklists.flatMap((checklist) => checklist.itens);
    const concluidos = itens.filter((item) => item.status === "CONCLUIDO").length;
    const obrigatorios = itens.filter((item) => item.obrigatorio && item.status !== "CONCLUIDO").length;
    return { total: itens.length, concluidos, obrigatorios, percentual: itens.length ? Math.round((concluidos / itens.length) * 100) : 0 };
  }, [checklists]);
  const responsaveis = useMemo(() => {
    const mapa = new Map<number, string>([[card.responsavel.id, card.responsavel.nome]]);
    card.membros.forEach((membro) => mapa.set(membro.usuario.id, membro.usuario.nome));
    return [...mapa].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [card.membros, card.responsavel]);

  async function atualizarItem(itemId: string, alteracao: { status?: "PENDENTE" | "CONCLUIDO"; observacao?: string | null; responsavelId?: number | null }) {
    if (!podeEditar) return;
    setSalvando(itemId);
    const resposta = await AtualizarItemChecklistCardBpm({ itemId, ...alteracao });
    setSalvando(null);
    if (!resposta.success) {
      if (resposta.error === "CONFLITO_CHECKLIST_ITEM") setConflitoRealtime(true);
      toast.error(resposta.error);
      return;
    }
    sujosRef.current.delete(itemId);
    toast.success("Item salvo");
    await carregar();
    onAtualizado();
  }

  async function adicionar(checklistId: string) {
    const nome = novosItens[checklistId]?.trim();
    if (!nome) return toast.error("Informe o nome do item");
    setSalvando(checklistId);
    const resposta = await AdicionarItemExclusivoChecklistCardBpm({ cardChecklistId: checklistId, nome, obrigatorio: false });
    setSalvando(null);
    if (!resposta.success) return toast.error(resposta.error);
    setNovosItens((atual) => ({ ...atual, [checklistId]: "" }));
    toast.success("Item exclusivo adicionado");
    await carregar();
    onAtualizado();
  }

  async function salvarTipoProcesso() {
    setSalvando("tipo-processo");
    const resposta = await AtualizarCardBpm({
      cardId: card.id,
      tipoProcesso: tipoProcesso.trim() || null,
      versaoEsperadaEm: card.updatedAt,
    });
    setSalvando(null);
    if (!resposta.success) { toast.error(typeof resposta.error === "string" ? resposta.error : "Tipo de processo inválido"); return; }
    toast.success("Tipo de processo salvo");
    await carregar();
    onAtualizado();
  }

  return <section id="checklist-pendencias" tabIndex={-1} className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 outline-none focus-visible:ring-2 focus-visible:ring-white/30" aria-labelledby={`checklists-card-titulo-${card.id}`}>
    <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-2.5"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `rgba(${accent},0.15)` }}><ListChecks size={15} aria-hidden="true" style={{ color: `rgb(${accent})` }} /></div><div><h3 id={`checklists-card-titulo-${card.id}`} className="text-xs font-bold uppercase tracking-wide text-white">Checklists do card</h3><p className="mt-0.5 text-[11px] text-slate-500">Templates aplicáveis são materializados ao abrir o card.</p></div></div>{!carregando && checklists.length > 0 && <Badge variant={totais.obrigatorios ? "destructive" : "secondary"}>{totais.obrigatorios ? `${totais.obrigatorios} obrigatórios pendentes` : "Sem pendências obrigatórias"}</Badge>}</div>
    {carregando && <div aria-live="polite" className="space-y-2"><span className="sr-only">Carregando checklists</span><Skeleton className="h-3 w-full" /><Skeleton className="h-20 w-full" /></div>}
    {erro && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"><span><AlertTriangle size={14} className="mr-1 inline" />{erro}</span><Button size="sm" variant="ghost" onClick={() => void carregar()}><RefreshCw size={13} className="mr-1" />Tentar novamente</Button></div>}
    {conflitoRealtime && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-100"><span>O checklist mudou em tempo real. Seu rascunho foi preservado.</span><Button size="sm" variant="ghost" onClick={() => void carregar()}>Usar dados atualizados</Button></div>}
    {!carregando && !erro && checklists.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">Nenhum checklist se aplica a este card.</p>}
    {!carregando && !erro && <div className="flex flex-col gap-2 rounded-xl border border-white/[0.06] p-3 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 space-y-1"><span className="text-[11px] font-medium text-slate-400">Tipo de processo</span><Input value={tipoProcesso} onChange={(event) => setTipoProcesso(event.target.value)} disabled={!podeEditar} maxLength={200} placeholder="Opcional" /></label>{podeEditar && <Button type="button" variant="outline" className="min-h-10" disabled={salvando === "tipo-processo" || tipoProcesso.trim() === (card.tipoProcesso ?? "")} onClick={() => void salvarTipoProcesso()}>{salvando === "tipo-processo" ? "Salvando…" : "Salvar tipo"}</Button>}</div>}
    {!carregando && checklists.length > 0 && <div className="space-y-3"><div className="space-y-1"><div className="flex justify-between text-[11px] text-slate-400"><span>Progresso geral</span><span>{totais.concluidos}/{totais.total} · {totais.percentual}%</span></div><div role="progressbar" aria-label="Progresso geral dos checklists" aria-valuemin={0} aria-valuemax={100} aria-valuenow={totais.percentual} className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-[width] motion-reduce:transition-none" style={{ width: `${totais.percentual}%`, backgroundColor: `rgb(${accent})` }} /></div></div>
      {checklists.map((checklist) => { const concluidos = checklist.itens.filter((item) => item.status === "CONCLUIDO").length; const percentual = checklist.itens.length ? Math.round((concluidos / checklist.itens.length) * 100) : 0; return <details key={checklist.id} open className="group rounded-xl border border-white/[0.07] bg-black/10"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-3"><div className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-100">{checklist.templateNome}</span><span className="text-[11px] text-slate-500">{concluidos}/{checklist.itens.length} concluídos</span></div><ChevronDown size={15} className="shrink-0 text-slate-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary><div className="space-y-2 border-t border-white/[0.06] p-3"><div role="progressbar" aria-label={`Progresso de ${checklist.templateNome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual} className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${percentual}%`, backgroundColor: `rgb(${accent})` }} /></div>
        {checklist.itens.length === 0 && <p className="py-2 text-center text-xs text-slate-500">Este checklist não tem itens.</p>}
        {checklist.itens.map((item) => <div id={`checklist-item-${item.id}`} tabIndex={-1} key={item.id} className="space-y-2 rounded-xl border border-white/[0.06] p-3 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"><div className="flex items-start gap-3"><Checkbox aria-label={`${item.status === "CONCLUIDO" ? "Reabrir" : "Concluir"} ${item.nome}`} checked={item.status === "CONCLUIDO"} disabled={!podeEditar || salvando === item.id} onCheckedChange={(valor) => void atualizarItem(item.id, { status: valor === true ? "CONCLUIDO" : "PENDENTE" })} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><span className={`text-sm ${item.status === "CONCLUIDO" ? "text-slate-500 line-through" : "text-slate-100"}`}>{item.nome}</span>{item.obrigatorio && <Badge variant="outline" className="text-[10px]"><AlertTriangle size={10} className="mr-1" />Obrigatório</Badge>}<Badge variant="secondary" className="text-[10px]">{item.exclusivoCard ? "Exclusivo deste card" : "Do template"}</Badge></div>{item.descricao && <p className="mt-1 text-xs text-slate-500">{item.descricao}</p>}</div>{salvando === item.id ? <Loader2 size={15} className="animate-spin text-slate-400" /> : item.status === "CONCLUIDO" ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Circle size={15} className="text-slate-600" />}</div><div className="grid gap-2 sm:grid-cols-2"><Input aria-label={`Observação de ${item.nome}`} disabled={!podeEditar} value={observacoes[item.id] ?? ""} placeholder="Observação" onChange={(event) => { setObservacoes((atual) => ({ ...atual, [item.id]: event.target.value })); sujosRef.current.add(item.id); }} onBlur={() => sujosRef.current.has(item.id) && void atualizarItem(item.id, { observacao: observacoes[item.id]?.trim() || null })} /><select aria-label={`Responsável por ${item.nome}`} disabled={!podeEditar} value={item.responsavelId ?? ""} onChange={(event) => void atualizarItem(item.id, { responsavelId: event.target.value ? Number(event.target.value) : null })} className="min-h-10 rounded-lg border border-white/10 bg-slate-900 px-3 text-xs text-white disabled:opacity-50"><option value="">Sem responsável</option>{responsaveis.map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{pessoa.nome}</option>)}</select></div></div>)}
        {podeEditar && <div className="flex gap-2 pt-1"><Input aria-label={`Novo item exclusivo em ${checklist.templateNome}`} value={novosItens[checklist.id] ?? ""} onChange={(event) => setNovosItens((atual) => ({ ...atual, [checklist.id]: event.target.value }))} placeholder="Novo item exclusivo deste card" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void adicionar(checklist.id); } }} /><Button type="button" variant="outline" className="min-h-10 shrink-0" disabled={salvando === checklist.id} onClick={() => void adicionar(checklist.id)}><Plus size={14} className="mr-1" />Adicionar</Button></div>}
      </div></details>; })}
    </div>}
    {!podeEditar && checklists.length > 0 && <p className="text-[11px] text-slate-500">Você possui acesso somente para leitura neste card.</p>}
  </section>;
}
