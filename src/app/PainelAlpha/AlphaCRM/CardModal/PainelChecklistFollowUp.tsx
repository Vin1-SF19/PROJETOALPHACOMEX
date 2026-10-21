"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ObterUltimoFollowUpBpm, SalvarChecklistFollowUpBpm } from "@/actions/bpm/FollowUp";
import { useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { resolverSnapshotCamposRealtime } from "@/lib/bpm/card-modal-ui";
import { VALORES } from "@/lib/bpm/financeiro-config.client";

type RespostaObterFollowUp = NonNullable<Awaited<ReturnType<typeof ObterUltimoFollowUpBpm>>["data"]>;
type Checklist = NonNullable<RespostaObterFollowUp["checklist"]>;
type EstadoFollowUp = {
  estado: RespostaObterFollowUp["estado"];
  checklist: Checklist | null;
};
type Resposta = string | boolean;

interface PainelChecklistFollowUpProps {
  cardId: string;
  accent: string;
  onAtualizado: () => void;
  onEstadoChange: (estado: EstadoFollowUp["estado"] | "CARREGANDO" | "ERRO") => void;
  podeEditar: boolean;
  realtimeRevision: number;
}

const inputClassName = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-white/25";

function valorTexto(resposta: Resposta | undefined): string {
  return typeof resposta === "string" ? resposta : "";
}

function respostaLegivel(resposta: Resposta | undefined): string {
  return typeof resposta === "boolean" ? resposta ? "Sim" : "Não" : resposta ?? "";
}

export function PainelChecklistFollowUp({ cardId, accent, onAtualizado, onEstadoChange, podeEditar, realtimeRevision }: PainelChecklistFollowUpProps) {
  const [estado, setEstado] = useState<EstadoFollowUp | null>(null);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [conflitoRealtime, setConflitoRealtime] = useState(false);
  const conflitoRef = useRef(false);
  const respostasRef = useRef<Record<string, Resposta>>({});
  const revisaoRef = useRef(0);
  const confirmacoesRef = useRef(0);
  const draftSujoRef = useRef(false);
  const estadoRef = useRef<EstadoFollowUp | null>(null);
  const remotoPendenteRef = useRef<EstadoFollowUp | null>(null);
  const { registerSave, scheduleSave, getDraft, setDraft, confirmVersion, subscribeConfirmation, setPendingFields } = useCardSave();
  const draftKey = `${cardId}:followup`;
  useEffect(() => subscribeConfirmation(cardId, (_card, key) => {
    if (key !== draftKey || getDraft(draftKey)) return;
    draftSujoRef.current = false;
    setTentativa((value) => value + 1);
  }), [cardId, draftKey, getDraft, subscribeConfirmation]);

  useEffect(() => {
    let cancelado = false;
    onEstadoChange("CARREGANDO");
    const confirmacaoConsulta = confirmacoesRef.current;
    ObterUltimoFollowUpBpm(cardId).then((resultado) => {
      if (cancelado) return;
      setCarregando(false);
      if (confirmacaoConsulta !== confirmacoesRef.current && estadoRef.current) { onEstadoChange(estadoRef.current.estado); return; }
      if (!resultado.success || !resultado.data) {
        setErroCarregamento(true);
        onEstadoChange("ERRO");
        toast.error(typeof resultado.error === "string" ? resultado.error : "Não foi possível carregar o follow-up");
        return;
      }
      const remoto = resultado.data;
      const recovered = getDraft(draftKey);
      const serializar = (valores: Record<string, Resposta>) => Object.fromEntries(Object.entries(valores).map(([id, valor]) => [id, JSON.stringify(valor)]));
      const resolucao = resolverSnapshotCamposRealtime({
        rascunhoSujo: Boolean(recovered),
        snapshotAtual: { valores: serializar(estadoRef.current?.checklist?.respostas ?? {}), versao: "base" },
        snapshotRemoto: { valores: serializar(remoto.checklist?.respostas ?? {}), versao: "remota" },
        valoresLocais: recovered,
      });
      if (recovered && estadoRef.current && (!resolucao.aplicarRemoto || estadoRef.current.checklist?.id !== remoto.checklist?.id)) {
        remotoPendenteRef.current = remoto;
        conflitoRef.current = true;
        setConflitoRealtime(true);
        onEstadoChange(estadoRef.current.estado);
        return;
      }
      estadoRef.current = remoto;
      setEstado(remoto);
      respostasRef.current = Object.fromEntries(Object.entries(resolucao.valoresEditados).map(([id, valor]) => [id, JSON.parse(valor) as Resposta]));
      setRespostas(respostasRef.current);
      const pendencias = (remoto.checklist?.perguntas ?? []).flatMap((pergunta) => {
        const antes = remoto.checklist?.respostas[pergunta.id];
        const depois = respostasRef.current[pergunta.id];
        return antes === depois ? [] : [{ label: pergunta.pergunta, before: respostaLegivel(antes), after: respostaLegivel(depois) }];
      });
      draftSujoRef.current = pendencias.length > 0;
      setDraft(draftKey, pendencias.length ? serializar(respostasRef.current) : undefined);
      setPendingFields(draftKey, pendencias);
      conflitoRef.current = false;
      setConflitoRealtime(false);
      onEstadoChange(resultado.data.estado);
    }).catch(() => {
      if (cancelado) return;
      setCarregando(false);
      setErroCarregamento(true);
      onEstadoChange("ERRO");
      toast.error("Nao foi possivel carregar o follow-up");
    });
    return () => { cancelado = true; };
  }, [cardId, onEstadoChange, tentativa, realtimeRevision, draftKey, getDraft, setDraft, setPendingFields]);

  function alterarResposta(id: string, value: Resposta | undefined, delay: number) {
    draftSujoRef.current = true;
    revisaoRef.current += 1;
    const next = { ...respostasRef.current };
    if (value === undefined) delete next[id]; else next[id] = value;
    respostasRef.current = next;
    setDraft(draftKey, Object.fromEntries(Object.entries(next).map(([id, value]) => [id, JSON.stringify(value)])));
    setPendingFields(draftKey, (estado?.checklist?.perguntas ?? []).flatMap((pergunta) => {
      const before = estado?.checklist?.respostas?.[pergunta.id];
      const after = next[pergunta.id];
      return before === after ? [] : [{ label: pergunta.pergunta, before: respostaLegivel(before), after: respostaLegivel(after) }];
    }));
    setRespostas(next);
    scheduleSave(`${cardId}:followup:${id}`, () => void persistir(false), delay);
  }

  async function persistir(concluir: boolean) {
    if (conflitoRef.current) return;
    if (!concluir && estadoRef.current?.checklist && !draftSujoRef.current) return;
    const respostasAtual = { ...respostasRef.current };
    const revisao = revisaoRef.current;
    const checklistIdAtual = estadoRef.current?.checklist?.id;
    const estadoAnterior = estadoRef.current?.estado;
    setSalvando(true);
    await registerSave(async () => {
      if (conflitoRef.current) return false;
      const resultado = await SalvarChecklistFollowUpBpm({
        cardId,
        checklistId: checklistIdAtual,
        respostas: respostasAtual,
        concluir,
      });
      if (!resultado.success || !resultado.data) {
        toast.error(typeof resultado.error === "string" ? resultado.error : "Não foi possível salvar o follow-up");
        return false;
      }
      if (resultado.data.cardUpdatedAt) confirmVersion(cardId, new Date(resultado.data.cardUpdatedAt).toISOString());
      const savedDraft = Object.fromEntries(Object.entries(respostasAtual).map(([id, value]) => [id, JSON.stringify(value)]));
      if (JSON.stringify(getDraft(draftKey)) === JSON.stringify(savedDraft)) setDraft(draftKey);
      confirmacoesRef.current += 1;
      estadoRef.current = { estado: resultado.data.estado, checklist: resultado.data.checklist };
      setEstado(estadoRef.current);
      if (revisao === revisaoRef.current) {
        respostasRef.current = resultado.data.checklist?.respostas ?? {};
        setRespostas(respostasRef.current);
        draftSujoRef.current = false;
        setPendingFields(draftKey, []);
      }
      conflitoRef.current = false;
      setConflitoRealtime(false);
      onEstadoChange(resultado.data.estado);
      toast.success(concluir ? "Follow-up concluído" : estadoAnterior === "NAO_INICIADO" ? "Follow-up iniciado" : "Rascunho do follow-up salvo");
      onAtualizado();
      return true;
    }, cardId, draftKey, undefined, false).finally(() => {
      setSalvando(false);
    });
  }

  async function iniciarNovoFollowUp() {
    setSalvando(true);
    const resultado = await SalvarChecklistFollowUpBpm({
      cardId,
      respostas: {},
      concluir: false,
    });
    setSalvando(false);
    if (!resultado.success || !resultado.data) {
      toast.error(typeof resultado.error === "string" ? resultado.error : "Não foi possível iniciar um novo follow-up");
      return;
    }
    confirmacoesRef.current += 1;
    estadoRef.current = { estado: resultado.data.estado, checklist: resultado.data.checklist };
    setEstado(estadoRef.current);
    respostasRef.current = resultado.data.checklist?.respostas ?? {};
    setRespostas(respostasRef.current);
    draftSujoRef.current = false;
    onEstadoChange(resultado.data.estado);
    toast.success("Novo follow-up iniciado");
    onAtualizado();
  }

  if (carregando) {
    return <div id={`follow-up-${cardId}`} tabIndex={-1} className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-400 outline-none"><Loader2 size={14} className="animate-spin" /> Carregando follow-up...</div>;
  }

  if (erroCarregamento) {
    return (
      <div id={`follow-up-${cardId}`} tabIndex={-1} className="space-y-3 rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-xs text-rose-200 outline-none">
        <p>Não foi possível validar o último follow-up.</p>
        <button type="button" onClick={() => {
          setCarregando(true);
          setErroCarregamento(false);
          setTentativa((valor) => valor + 1);
        }} className="rounded-xl border border-rose-300/30 px-3 py-2 font-semibold hover:bg-rose-200/10">Tentar carregar novamente</button>
      </div>
    );
  }

  const checklist: Checklist | null = estado?.checklist ?? null;

  return (
    <section id={`follow-up-${cardId}`} tabIndex={-1} className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 outline-none focus-visible:ring-2 focus-visible:ring-white/30" aria-labelledby={`follow-up-titulo-${cardId}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `rgba(${accent},0.15)` }}>
            <ClipboardList size={13} style={{ color: `rgb(${accent})` }} />
          </div>
          <div>
            <h3 id={`follow-up-titulo-${cardId}`} className="text-xs font-bold uppercase tracking-wide text-white">Último follow-up</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">Anotações obrigatórias e perguntas configuradas.</p>
          </div>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${estado?.estado === "CONCLUIDO" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
          {estado?.estado === "CONCLUIDO" ? "Concluído" : estado?.estado === "EM_ANDAMENTO" ? "Em andamento" : "Não iniciado"}
        </span>
      </div>
      {conflitoRealtime && <div role="alert" className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3 text-xs text-sky-200">
        <p>Uma resposta que você está editando mudou externamente. Seu rascunho foi preservado.</p>
        <button type="button" className="mt-2 rounded-lg border border-sky-300/30 px-2 py-1" onClick={() => {
          const remoto = remotoPendenteRef.current;
          if (!remoto) return;
          estadoRef.current = remoto;
          setEstado(remoto);
          respostasRef.current = remoto.checklist?.respostas ?? {};
          setRespostas(respostasRef.current);
          setDraft(draftKey);
          setPendingFields(draftKey, []);
          draftSujoRef.current = false;
          conflitoRef.current = false;
          setConflitoRealtime(false);
          onEstadoChange(remoto.estado);
        }}>Usar respostas atualizadas</button>
      </div>}

      {!checklist ? (
        <button type="button" onClick={() => void persistir(false)} disabled={!podeEditar || salvando} className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: `rgba(${accent},0.85)` }}>
          {salvando && <Loader2 size={14} className="animate-spin" />} Iniciar follow-up
        </button>
      ) : (
        <div className="space-y-3 border-t border-white/5 pt-3">
          {checklist.perguntas.map((pergunta) => (
            <div key={pergunta.id} className="space-y-1.5">
              <label htmlFor={`follow-up-${pergunta.id}`} className="text-[11px] font-medium text-slate-400">
                {pergunta.pergunta}{pergunta.obrigatoria ? " *" : ""}
              </label>
              {pergunta.tipo === "selecao" ? (
                <select id={`follow-up-${pergunta.id}`} disabled={!podeEditar} className={inputClassName} value={valorTexto(respostas[pergunta.id])} onChange={(evento) => {
                  alterarResposta(pergunta.id, evento.target.value, pergunta.tipo === "selecao" ? 0 : 500);
                }} onBlur={() => void persistir(false)}>
                  <option value="">Selecione...</option>
                  {pergunta.opcoes.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
                </select>
              ) : pergunta.tipo === "booleano" ? (
                <select id={`follow-up-${pergunta.id}`} disabled={!podeEditar} className={inputClassName} value={typeof respostas[pergunta.id] === "boolean" ? String(respostas[pergunta.id]) : ""} onChange={(evento) => {
                  alterarResposta(pergunta.id, evento.target.value ? evento.target.value === "true" : undefined, 0);
                }} onBlur={() => void persistir(false)}>
                  <option value="">Selecione...</option><option value="true">{VALORES.SIM}</option><option value="false">{VALORES.NAO}</option>
                </select>
              ) : (
                <textarea id={`follow-up-${pergunta.id}`} disabled={!podeEditar} className={`${inputClassName} min-h-24 resize-y`} value={valorTexto(respostas[pergunta.id])} onChange={(evento) => {
                  alterarResposta(pergunta.id, evento.target.value, pergunta.tipo === "selecao" ? 0 : 500);
                }} onBlur={() => void persistir(false)} />
              )}
            </div>
          ))}

          {checklist.completo ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300"><CheckCircle2 size={14} /> Procedimento concluído.</div>
              <button type="button" onClick={() => void iniciarNovoFollowUp()} disabled={!podeEditar || salvando} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-50">
                {salvando && <Loader2 size={13} className="animate-spin" />} Iniciar novo follow-up
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              <button type="button" onClick={() => void persistir(true)} disabled={!podeEditar || salvando} className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50" style={{ background: `rgba(${accent},0.85)` }}>{salvando && <Loader2 size={13} className="animate-spin" />} Concluir follow-up</button>
            </div>
          )}
        </div>
      )}
      {!podeEditar && <p className="text-[11px] text-slate-500">Somente o responsável ou um administrador pode registrar este follow-up.</p>}
    </section>
  );
}
