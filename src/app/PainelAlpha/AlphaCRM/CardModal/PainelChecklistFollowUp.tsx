"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ObterUltimoFollowUpBpm, SalvarChecklistFollowUpBpm } from "@/actions/bpm/FollowUp";
import { useCardSave } from "./CardSaveContext";

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

export function PainelChecklistFollowUp({ cardId, accent, onAtualizado, onEstadoChange, podeEditar, realtimeRevision }: PainelChecklistFollowUpProps) {
  const [estado, setEstado] = useState<EstadoFollowUp | null>(null);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [conflitoRealtime, setConflitoRealtime] = useState(false);
  const draftSujoRef = useRef(false);
  const revisaoAnteriorRef = useRef(realtimeRevision);
  const { registerSave } = useCardSave();

  useEffect(() => {
    let cancelado = false;
    if (realtimeRevision !== revisaoAnteriorRef.current && draftSujoRef.current) {
      revisaoAnteriorRef.current = realtimeRevision;
      setConflitoRealtime(true);
      return;
    }
    revisaoAnteriorRef.current = realtimeRevision;
    onEstadoChange("CARREGANDO");
    ObterUltimoFollowUpBpm(cardId).then((resultado) => {
      if (cancelado) return;
      setCarregando(false);
      if (!resultado.success || !resultado.data) {
        setErroCarregamento(true);
        onEstadoChange("ERRO");
        toast.error(typeof resultado.error === "string" ? resultado.error : "Não foi possível carregar o follow-up");
        return;
      }
      setEstado(resultado.data);
      setRespostas(resultado.data.checklist?.respostas ?? {});
      draftSujoRef.current = false;
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
  }, [cardId, onEstadoChange, tentativa, realtimeRevision]);

  async function persistir(concluir: boolean) {
    if (!concluir && estado?.checklist && (!draftSujoRef.current || salvando)) return;
    const respostasAtual = respostas;
    const checklistIdAtual = estado?.checklist?.id;
    const estadoAnterior = estado?.estado;
    setSalvando(true);
    await registerSave(async () => {
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
      setEstado({ estado: resultado.data.estado, checklist: resultado.data.checklist });
      setRespostas(resultado.data.checklist?.respostas ?? {});
      draftSujoRef.current = false;
      setConflitoRealtime(false);
      onEstadoChange(resultado.data.estado);
      toast.success(concluir ? "Follow-up concluído" : estadoAnterior === "NAO_INICIADO" ? "Follow-up iniciado" : "Rascunho do follow-up salvo");
      onAtualizado();
      return true;
    }).finally(() => {
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
    setEstado({ estado: resultado.data.estado, checklist: resultado.data.checklist });
    setRespostas(resultado.data.checklist?.respostas ?? {});
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
      {conflitoRealtime && <p className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3 text-xs text-sky-200">O follow-up mudou externamente. Suas respostas locais foram preservadas.</p>}

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
                  draftSujoRef.current = true;
                  setRespostas((atuais) => ({ ...atuais, [pergunta.id]: evento.target.value }));
                }} onBlur={() => void persistir(false)}>
                  <option value="">Selecione...</option>
                  {pergunta.opcoes.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
                </select>
              ) : pergunta.tipo === "booleano" ? (
                <select id={`follow-up-${pergunta.id}`} disabled={!podeEditar} className={inputClassName} value={typeof respostas[pergunta.id] === "boolean" ? String(respostas[pergunta.id]) : ""} onChange={(evento) => {
                  draftSujoRef.current = true;
                  setRespostas((atuais) => {
                  if (!evento.target.value) {
                    const proximas = { ...atuais };
                    delete proximas[pergunta.id];
                    return proximas;
                  }
                  return { ...atuais, [pergunta.id]: evento.target.value === "true" };
                  });
                }} onBlur={() => void persistir(false)}>
                  <option value="">Selecione...</option><option value="true">Sim</option><option value="false">Não</option>
                </select>
              ) : (
                <textarea id={`follow-up-${pergunta.id}`} disabled={!podeEditar} className={`${inputClassName} min-h-24 resize-y`} value={valorTexto(respostas[pergunta.id])} onChange={(evento) => {
                  draftSujoRef.current = true;
                  setRespostas((atuais) => ({ ...atuais, [pergunta.id]: evento.target.value }));
                }} onBlur={() => void persistir(false)} />
              )}
            </div>
          ))}

          {checklist.completo ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300"><CheckCircle2 size={14} /> Checklist concluído.</div>
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
