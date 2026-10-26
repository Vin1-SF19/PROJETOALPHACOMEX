"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Circle, ListChecks, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  AdicionarItemExclusivoChecklistCardBpm,
  AtualizarItemChecklistCardBpm,
  CriarChecklistDocumentalAvulsoBpm,
  ListarChecklistsCardBpm,
} from "@/actions/bpm/Checklists";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CardSaveProvider, useCardSave, useOptionalCardSave } from "./CardSaveContext";
import { ETAPA_DOCUMENTACAO_ANALISE_ID, PIPELINE_DOCUMENTACAO_OPERACIONAL_ID } from "@/lib/bpm/documentacao-analise";

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

type Props = {
  card: CardDetalhe;
  accent: string;
  podeEditar: boolean;
  realtimeRevision: number;
  onAtualizado: () => void;
  ocultarVazio?: boolean;
};

export function PainelChecklistsCard(props: Props) {
  const context = useOptionalCardSave();
  return context ? <PainelChecklistsCardContent {...props} /> : <CardSaveProvider><PainelChecklistsCardContent {...props} /></CardSaveProvider>;
}

function PainelChecklistsCardContent({ card, accent, podeEditar, realtimeRevision, onAtualizado, ocultarVazio = false }: Props) {
  const { getDraft, getDraftBase, setDraft, setPendingFields, registerSave, registerManualSave } = useCardSave();
  const draftKey = `${card.id}:procedimentos`;
  const [recuperado] = useState(() => getDraft(draftKey) ?? {});
  const recoveredObs = Object.fromEntries(Object.entries(recuperado).filter(([key]) => key.startsWith("obs:")).map(([key, value]) => [key.slice(4), value]));
  const recoveredDocs = Object.fromEntries(Object.entries(recuperado).filter(([key]) => key.startsWith("novo:")).map(([key, value]) => [key.slice(5), value]));
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState<Record<string, string>>(recoveredObs);
  const observacoesRef = useRef(observacoes);
  const [conflitoRealtime, setConflitoRealtime] = useState(false);
  const [novoDocumento, setNovoDocumento] = useState<Record<string, string>>(recoveredDocs);
  const novosRef = useRef(novoDocumento);
  const sujosRef = useRef(new Set(Object.keys(recoveredObs)));
  const baseRef = useRef<Record<string, string>>(getDraftBase(draftKey)?.valores ?? {});
  const checklistRef = useRef<Checklist[]>([]);
  const consultaRef = useRef(0);
  const emAndamento = useRef(new Map<string, Promise<boolean>>());
  const atualizarRascunho = useCallback((intent: "edit" | "sync" = "sync") => {
    const valores = Object.fromEntries([
      ...[...sujosRef.current].map((id) => [`obs:${id}`, observacoesRef.current[id] ?? ""]),
      ...Object.entries(novosRef.current).filter(([, texto]) => texto.trim()).map(([id, texto]) => [`novo:${id}`, texto]),
    ]);
    setDraft(draftKey, Object.keys(valores).length ? valores : undefined, { versao: String(card.updatedAt ?? ""), valores: { ...baseRef.current } }, intent);
    const itens = checklistRef.current.flatMap((checklist) => checklist.itens);
    setPendingFields(draftKey, [
      ...[...sujosRef.current].map((id) => ({ label: `Observação de ${itens.find((item) => item.id === id)?.nome ?? "procedimento"}`, before: baseRef.current[`obs:${id}`], after: observacoesRef.current[id] })),
      ...Object.entries(novosRef.current).filter(([, texto]) => texto.trim()).map(([, texto]) => ({ label: "Novo documento do procedimento", after: texto })),
    ]);
  }, [card.updatedAt, draftKey, setDraft, setPendingFields]);
  function alterarObservacao(id: string, texto: string) {
    observacoesRef.current = { ...observacoesRef.current, [id]: texto };
    sujosRef.current.add(id);
    setObservacoes(observacoesRef.current);
    atualizarRascunho("edit");
  }
  function alterarDocumento(id: string, texto: string) {
    novosRef.current = { ...novosRef.current, [id]: texto };
    setNovoDocumento(novosRef.current);
    atualizarRascunho("edit");
  }
  const revisaoInicialRef = useRef(realtimeRevision);

  const carregar = useCallback(async () => {
    const consulta = ++consultaRef.current;
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await ListarChecklistsCardBpm({ cardId: card.id });
      if (consulta !== consultaRef.current) return;
      if (!resposta.success) { setErro(resposta.error); return; }
      checklistRef.current = resposta.data;
      setChecklists(resposta.data);
      emitirResumoChecklist(card.id, resposta.data);
      const remotas = Object.fromEntries(resposta.data.flatMap((checklist) => checklist.itens.map((item) => [item.id, item.observacao ?? ""])));
      for (const item of resposta.data.flatMap((checklist) => checklist.itens)) {
        const key = `obs:${item.id}`;
        if (sujosRef.current.has(item.id)) {
          if (baseRef.current[key] !== undefined && baseRef.current[key] !== (item.observacao ?? "")) setConflitoRealtime(true);
          remotas[item.id] = observacoesRef.current[item.id] ?? "";
        } else {
          baseRef.current[key] = item.observacao ?? "";
          if (item.updatedAt) baseRef.current[`versao:${item.id}`] = new Date(item.updatedAt).toISOString();
        }
      }
      observacoesRef.current = remotas;
      setObservacoes(remotas);
      atualizarRascunho();
    } catch {
      if (consulta === consultaRef.current) setErro("Não foi possível carregar os procedimentos. Tente novamente.");
    } finally {
      if (consulta === consultaRef.current) setCarregando(false);
    }
  }, [card.id, atualizarRascunho]);

  useEffect(() => {
    const timer = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(timer);
  }, [carregar]);
  useEffect(() => {
    if (realtimeRevision === revisaoInicialRef.current) return;
    revisaoInicialRef.current = realtimeRevision;
    void carregar();
  }, [carregar, realtimeRevision]);

  const totais = useMemo(() => {
    const itens = checklists.flatMap((checklist) => checklist.itens);
    const obrigatorios = itens.filter((item) => item.obrigatorio && item.status !== "CONCLUIDO").length;
    return { obrigatorios };
  }, [checklists]);
  const responsaveis = useMemo(() => {
    const mapa = new Map<number, string>([[card.responsavel.id, card.responsavel.nome]]);
    card.membros.forEach((membro) => mapa.set(membro.usuario.id, membro.usuario.nome));
    return [...mapa].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [card.membros, card.responsavel]);
  const documentacaoEmAnalise = card.pipelineId === PIPELINE_DOCUMENTACAO_OPERACIONAL_ID && card.etapaId === ETAPA_DOCUMENTACAO_ANALISE_ID;

  function atualizarItem(itemId: string, alteracao: { status?: "PENDENTE" | "CONCLUIDO"; observacao?: string | null; responsavelId?: number | null }): Promise<boolean> {
    if (!podeEditar) return Promise.resolve(false);
    const anterior = emAndamento.current.get(itemId);
    if (anterior) return anterior.then((ok) => ok ? atualizarItem(itemId, alteracao) : false);
    const observacaoEnviada = sujosRef.current.has(itemId) ? observacoesRef.current[itemId] : undefined;
    const promise = registerSave(async () => {
      setSalvando(itemId);
      try {
        const versao = baseRef.current[`versao:${itemId}`];
        const resposta = await AtualizarItemChecklistCardBpm({ itemId, ...alteracao,
          ...(observacaoEnviada !== undefined ? { observacao: observacaoEnviada.trim() || null } : {}),
          ...(versao ? { versaoEsperadaEm: versao } : {}),
        });
        if (!resposta.success) {
          if (resposta.error === "CONFLITO_CHECKLIST_ITEM") { setConflitoRealtime(true); await carregar(); }
          toast.error(resposta.error);
          return false;
        }
        if (resposta.data.updatedAt) baseRef.current[`versao:${itemId}`] = new Date(resposta.data.updatedAt).toISOString();
        if (observacaoEnviada !== undefined && observacoesRef.current[itemId] === observacaoEnviada) {
          sujosRef.current.delete(itemId);
          baseRef.current[`obs:${itemId}`] = resposta.data.observacao ?? observacaoEnviada.trim();
        }
        atualizarRascunho();
        toast.success("Item salvo");
        await carregar();
        onAtualizado();
        return true;
      } catch {
        toast.error("Não foi possível salvar o procedimento. Seu rascunho foi preservado.");
        return false;
      } finally { setSalvando(null); }
    }, card.id, `${draftKey}:${itemId}`, undefined, false).finally(() => emAndamento.current.delete(itemId));
    emAndamento.current.set(itemId, promise);
    return promise;
  }

  async function adicionarDocumento(cardChecklistId: string): Promise<boolean> {
    const nome = novosRef.current[cardChecklistId]?.trim();
    if (!nome) return true;
    if (!podeEditar) return false;
    return registerSave(async () => {
      setSalvando(cardChecklistId);
      try {
        const resposta = cardChecklistId === "avulso"
          ? await CriarChecklistDocumentalAvulsoBpm({ cardId: card.id, nome })
          : await AdicionarItemExclusivoChecklistCardBpm({ cardChecklistId, nome, obrigatorio: true });
        if (!resposta.success) { toast.error(resposta.error); return false; }
        if (novosRef.current[cardChecklistId]?.trim() === nome) alterarDocumento(cardChecklistId, "");
        toast.success("Documento adicionado ao procedimento deste card.");
        await carregar();
        onAtualizado();
        return true;
      } catch {
        toast.error("Não foi possível adicionar o documento. Seu rascunho foi preservado.");
        return false;
      } finally { setSalvando(null); }
    }, card.id, `${draftKey}:documento:${cardChecklistId}`, undefined, false);
  }
  const criarPrimeiroDocumento = () => adicionarDocumento("avulso");
  async function salvarPendencias(): Promise<boolean> {
    for (const itemId of [...sujosRef.current]) if (!await atualizarItem(itemId, { observacao: observacoesRef.current[itemId]?.trim() || null })) return false;
    for (const [id, nome] of Object.entries(novosRef.current)) if (nome.trim() && !await adicionarDocumento(id)) return false;
    return sujosRef.current.size === 0 && !Object.values(novosRef.current).some((nome) => nome.trim());
  }
  const salvarRef = useRef(salvarPendencias);
  useEffect(() => { salvarRef.current = salvarPendencias; });
  useEffect(() => registerManualSave(card.id, draftKey, () => salvarRef.current()), [card.id, draftKey, registerManualSave]);
  function revisarConflito(descartar: boolean) {
    for (const item of checklistRef.current.flatMap((checklist) => checklist.itens)) {
      baseRef.current[`obs:${item.id}`] = item.observacao ?? "";
      if (item.updatedAt) baseRef.current[`versao:${item.id}`] = new Date(item.updatedAt).toISOString();
    }
    if (descartar) {
      sujosRef.current.clear();
      observacoesRef.current = Object.fromEntries(checklistRef.current.flatMap((checklist) => checklist.itens.map((item) => [item.id, item.observacao ?? ""])));
      setObservacoes(observacoesRef.current);
    }
    setConflitoRealtime(false);
    atualizarRascunho();
  }

  return <section id="checklist-pendencias" tabIndex={-1} className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 outline-none focus-visible:ring-2 focus-visible:ring-white/30" aria-labelledby={`checklists-card-titulo-${card.id}`}>
    <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-2.5"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `rgba(${accent},0.15)` }}><ListChecks size={15} aria-hidden="true" style={{ color: `rgb(${accent})` }} /></div><h3 id={`checklists-card-titulo-${card.id}`} className="self-center text-xs font-bold uppercase tracking-wide text-white">{documentacaoEmAnalise ? "Documentos pendentes" : "Procedimentos da etapa"}</h3></div>{!carregando && checklists.length > 0 && <Badge variant={totais.obrigatorios ? "destructive" : "secondary"}>{totais.obrigatorios ? `${totais.obrigatorios} pendentes` : "Em dia"}</Badge>}</div>
    {carregando && <div aria-live="polite" className="space-y-2"><span className="sr-only">Carregando procedimentos</span><Skeleton className="h-3 w-full" /><Skeleton className="h-20 w-full" /></div>}
    {erro && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"><span><AlertTriangle size={14} className="mr-1 inline" />{erro}</span><Button size="sm" variant="ghost" onClick={() => void carregar()}><RefreshCw size={13} className="mr-1" />Tentar novamente</Button></div>}
    {conflitoRealtime && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-100"><span>O procedimento mudou em tempo real. Seu rascunho foi preservado.</span><Button size="sm" variant="ghost" onClick={() => revisarConflito(true)}>Usar dados atualizados</Button><Button size="sm" variant="ghost" onClick={() => revisarConflito(false)}>Manter minhas observações</Button></div>}
    {!carregando && !erro && checklists.length === 0 && !ocultarVazio && <div role="status" className="rounded-xl border border-dashed border-white/10 p-5 text-center">
      <p className="text-sm font-medium text-slate-300">{documentacaoEmAnalise ? "Nenhum documento pendente cadastrado" : "Nenhum procedimento para esta etapa"}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">Quando houver um procedimento vinculado a este card, ele aparecerá aqui.</p>
    </div>}
    {!carregando && !erro && checklists.length === 0 && documentacaoEmAnalise && podeEditar &&
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void criarPrimeiroDocumento(); }}>
        <Input aria-label="Adicionar primeiro documento fora do template" placeholder="Adicionar documento necessário" maxLength={200}
          value={novoDocumento.avulso ?? ""} onChange={(event) => alterarDocumento("avulso", event.target.value)} />
        <Button type="submit" size="sm" disabled={!novoDocumento.avulso?.trim() || salvando === "avulso"}>Adicionar</Button>
      </form>}
    {!carregando && checklists.length > 0 && <div className="space-y-3">
      {checklists.map((checklist) => { const concluidos = checklist.itens.filter((item) => item.status === "CONCLUIDO").length; const percentual = checklist.itens.length ? Math.round((concluidos / checklist.itens.length) * 100) : 0; const nomesResponsaveis = [...new Set(checklist.itens.flatMap((item) => item.responsavel?.nome ? [item.responsavel.nome] : []))]; const resumoResponsaveis = nomesResponsaveis.length === 0 ? "Sem responsável" : nomesResponsaveis.length === 1 ? `Responsável: ${nomesResponsaveis[0]}` : `Responsáveis: ${nomesResponsaveis.length} pessoas`; return <details key={checklist.id} id={`bpm-checklist-${card.id}-${checklist.id}`} tabIndex={-1} open className="group rounded-xl border border-white/[0.07] bg-black/10 focus:outline-none focus:ring-2 focus:ring-cyan-400"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-3"><div className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-100">{checklist.templateNome}</span><span className="block text-[11px] text-slate-500">{concluidos}/{checklist.itens.length} concluídos</span><span className="block truncate text-[11px] text-slate-400">{resumoResponsaveis}</span></div><ChevronDown size={15} className="shrink-0 text-slate-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary><div className="space-y-2 border-t border-white/[0.06] p-3"><div role="progressbar" aria-label={`Progresso de ${checklist.templateNome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual} className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${percentual}%`, backgroundColor: `rgb(${accent})` }} /></div>
        {checklist.itens.length === 0 && <p className="py-2 text-center text-xs text-slate-500">Este procedimento não tem itens.</p>}
        {checklist.itens.map((item) => <div id={`checklist-item-${item.id}`} tabIndex={-1} key={item.id} aria-busy={salvando === item.id} className="space-y-2 rounded-xl border border-white/[0.06] p-3 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"><div className="flex items-start gap-3"><Checkbox aria-label={`${item.status === "CONCLUIDO" ? "Reabrir" : "Concluir"} ${item.nome}`} checked={item.status === "CONCLUIDO"} disabled={!podeEditar || salvando === item.id} onCheckedChange={(valor) => void atualizarItem(item.id, { status: valor === true ? "CONCLUIDO" : "PENDENTE" })} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><span className={`text-sm ${item.status === "CONCLUIDO" ? "text-slate-500 line-through" : "text-slate-100"}`}>{item.nome}</span>{item.obrigatorio && <Badge variant="outline" className="text-[10px]"><AlertTriangle size={10} className="mr-1" />Obrigatório</Badge>}<Badge variant="secondary" className="text-[10px]">{item.exclusivoCard ? "Exclusivo deste card" : "Do template"}</Badge></div>{item.descricao && <p className="mt-1 text-xs text-slate-500">{item.descricao}</p>}</div>{salvando === item.id ? <Loader2 size={15} className="animate-spin text-slate-400" /> : item.status === "CONCLUIDO" ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Circle size={15} className="text-slate-600" />}</div><div className="grid gap-2 sm:grid-cols-2"><Input aria-label={`Observação de ${item.nome}`} disabled={!podeEditar || salvando === item.id} value={observacoes[item.id] ?? ""} placeholder="Observação" onChange={(event) => alterarObservacao(item.id, event.target.value)} onBlur={() => sujosRef.current.has(item.id) && void atualizarItem(item.id, { observacao: observacoes[item.id]?.trim() || null })} /><select aria-label={`Responsável por ${item.nome}`} disabled={!podeEditar || salvando === item.id} value={item.responsavelId ?? ""} onChange={(event) => void atualizarItem(item.id, { responsavelId: event.target.value ? Number(event.target.value) : null })} className="min-h-10 rounded-lg border border-white/10 bg-slate-900 px-3 text-xs text-white disabled:opacity-50"><option value="">Sem responsável</option>{responsaveis.map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{pessoa.nome}</option>)}</select></div></div>)}
        {podeEditar && documentacaoEmAnalise &&
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void adicionarDocumento(checklist.id); }}>
            <Input aria-label="Adicionar documento fora do template" placeholder="Adicionar documento necessário" maxLength={200}
              value={novoDocumento[checklist.id] ?? ""} onChange={(event) => alterarDocumento(checklist.id, event.target.value)} />
            <Button type="submit" size="sm" disabled={!novoDocumento[checklist.id]?.trim() || salvando === checklist.id}>Adicionar</Button>
          </form>}
      </div></details>; })}
    </div>}
    {podeEditar && Object.keys(getDraft(draftKey) ?? {}).length > 0 && <Button type="button" size="sm" disabled={Boolean(salvando) || conflitoRealtime} onClick={() => void salvarPendencias()}>Salvar observações e documentos pendentes</Button>}
    {!podeEditar && checklists.length > 0 && <p className="text-[11px] text-slate-500">Você possui acesso somente para leitura neste card.</p>}
  </section>;
}
