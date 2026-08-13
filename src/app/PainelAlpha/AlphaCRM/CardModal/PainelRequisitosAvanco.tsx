"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ObterCardBpm,
  ObterRequisitosTransicaoBpm,
  SalvarRequisitosEMoverCardBpm,
} from "@/actions/bpm/Cards";
import { CampoBpmInput } from "../CampoBpmInput";
import { montarPayloadCamposDestino, separarCamposRequisitos } from "@/lib/bpm/card-modal-ui";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type Requisitos = NonNullable<Awaited<ReturnType<typeof ObterRequisitosTransicaoBpm>>["data"]>;
type EtapaOpcao = { id: string; nome: string };

interface PainelRequisitosAvancoProps {
  card: CardDetalhe;
  etapas: EtapaOpcao[];
  accent: string;
  onAtualizado: () => void;
  podeEditar: boolean;
  podeMover: boolean;
  realtimeRevision: number;
  onFocarPainelReuniao: () => void;
}

const inputClassName = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-white/25";

function paraInputDatetimeLocal(data: Date | string | null): string {
  if (!data) return "";
  const valor = new Date(data);
  const pad = (numero: number) => String(numero).padStart(2, "0");
  return `${valor.getFullYear()}-${pad(valor.getMonth() + 1)}-${pad(valor.getDate())}T${pad(valor.getHours())}:${pad(valor.getMinutes())}`;
}

export function PainelRequisitosAvanco({ card, etapas, accent, onAtualizado, podeEditar, podeMover, realtimeRevision, onFocarPainelReuniao }: PainelRequisitosAvancoProps) {
  const destinos = etapas.filter((etapa) => etapa.id !== card.etapa.id);
  const [destinoId, setDestinoId] = useState(destinos[0]?.id ?? "");
  const [requisitos, setRequisitos] = useState<Requisitos | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [proximoContato, setProximoContato] = useState(() => paraInputDatetimeLocal(card.proximoContatoEm));
  const [carregando, setCarregando] = useState(Boolean(destinos[0]));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conflitoRealtime, setConflitoRealtime] = useState(false);
  const draftSujoRef = useRef(false);
  const revisaoAnteriorRef = useRef(realtimeRevision);

  useEffect(() => {
    if (!destinoId) {
      return;
    }
    if (realtimeRevision !== revisaoAnteriorRef.current && draftSujoRef.current) {
      revisaoAnteriorRef.current = realtimeRevision;
      setConflitoRealtime(true);
      return;
    }
    revisaoAnteriorRef.current = realtimeRevision;
    let cancelado = false;
    ObterRequisitosTransicaoBpm(card.id, destinoId).then((resultado) => {
      if (cancelado) return;
      setCarregando(false);
      if (!resultado.success || !resultado.data) {
        setRequisitos(null);
        setErro(typeof resultado.error === "string" ? resultado.error : "Não foi possível carregar os requisitos");
        return;
      }
      setRequisitos(resultado.data);
      setValores(Object.fromEntries(resultado.data.campos.map((campo) => [campo.id, campo.valor ?? ""])));
      setProximoContato(paraInputDatetimeLocal(resultado.data.proximoContatoEm));
      draftSujoRef.current = false;
      setConflitoRealtime(false);
    });
    return () => { cancelado = true; };
  }, [card.id, destinoId, realtimeRevision]);

  const faltantes = requisitos?.campos.filter(
    (campo) => campo.obrigatorio && !valores[campo.id]?.trim(),
  ) ?? [];
  const camposSeparados = separarCamposRequisitos(requisitos?.campos ?? [], new Set(card.camposEtapa.map((campo) => campo.id)));
  const camposOrigem = camposSeparados.origem;
  const camposExibidos = camposSeparados.editaveisDestino;
  const exigeProximoContato = requisitos?.guardas.some((guarda) => guarda.includes("Próximo Contato")) ?? false;
  const guardasBloqueantes = requisitos?.guardas.filter(
    (guarda) => !(guarda.includes("Próximo Contato") && proximoContato),
  ) ?? [];
  const pronto = podeEditar && podeMover && Boolean(requisitos) && faltantes.length === 0 && guardasBloqueantes.length === 0;

  function focarSecao(id: string) {
    const elemento = document.getElementById(id);
    elemento?.scrollIntoView({ behavior: "smooth", block: "center" });
    elemento?.focus({ preventScroll: true });
  }

  async function salvarEAvancar() {
    if (!requisitos || !destinoId) return;
    setSalvando(true);
    const resultado = await SalvarRequisitosEMoverCardBpm({
      cardId: card.id,
      etapaDestinoId: destinoId,
      camposValores: montarPayloadCamposDestino(camposExibidos, valores),
      ...(exigeProximoContato || proximoContato
        ? { proximoContatoEm: proximoContato ? new Date(proximoContato).toISOString() : null }
        : {}),
    });
    setSalvando(false);
    if (!resultado.success) {
      const mensagem = typeof resultado.error === "string" ? resultado.error : "Não foi possível avançar o card";
      setErro(mensagem);
      toast.error(mensagem);
      return;
    }
    toast.success(`Card movido para ${requisitos.etapaDestino.nome}`);
    draftSujoRef.current = false;
    onAtualizado();
  }

  return (
    <section className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4" aria-labelledby={`requisitos-avanco-${card.id}`}>
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `rgba(${accent},0.15)` }}>
          <ClipboardCheck size={13} style={{ color: `rgb(${accent})` }} />
        </div>
        <div>
          <h3 id={`requisitos-avanco-${card.id}`} className="text-xs font-bold uppercase tracking-wide text-white">Requisitos para avançar</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">Escolha o destino, preencha as pendências e avance.</p>
        </div>
      </div>

      {destinos.length > 0 ? (
        <div className="space-y-1.5">
          <label htmlFor={`destino-card-${card.id}`} className="text-[11px] font-medium text-slate-400">Etapa de destino</label>
          <select id={`destino-card-${card.id}`} disabled={!podeMover} className={inputClassName} value={destinoId} onChange={(evento) => {
            draftSujoRef.current = false;
            setDestinoId(evento.target.value);
            setCarregando(true);
            setErro(null);
            setRequisitos(null);
          }}>
            {destinos.map((etapa) => <option key={etapa.id} value={etapa.id}>{etapa.nome}</option>)}
          </select>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Nenhuma transição disponível a partir desta etapa.</p>
      )}

      {carregando && <div className="flex items-center gap-2 py-3 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" /> Carregando requisitos...</div>}
      {erro && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{erro}</div>}

      {requisitos && !carregando && (
        <div className="space-y-3 border-t border-white/5 pt-3">
          {conflitoRealtime && <p className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3 text-xs text-sky-200">Os requisitos receberam uma atualização externa. Seu rascunho foi preservado; revise antes de avançar.</p>}
          {camposOrigem.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
              <p>{camposOrigem.length} requisito(s) pertencem à etapa atual e devem ser preenchidos no editor acima.</p>
              <button type="button" onClick={() => focarSecao(`campos-etapa-atual-${card.id}`)} className="mt-2 rounded-lg border border-white/10 px-2 py-1 font-semibold text-slate-300 hover:border-white/20">Ir aos campos da etapa atual</button>
            </div>
          )}
          {camposExibidos.map((campo) => {
            const pendente = campo.obrigatorio && !valores[campo.id]?.trim();
            return (
              <div key={campo.id} className="space-y-1.5">
                <label htmlFor={`campo-bpm-${campo.id}`} className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-400">
                  <span>
                    {campo.nome}{campo.obrigatorio ? " *" : ""}
                    <span className="ml-1.5 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-normal text-slate-500">
                      {campo.contexto === "ORIGEM" ? `Etapa atual: ${campo.etapaAplicacaoNome}` : campo.contexto === "DESTINO" ? `Destino: ${campo.etapaAplicacaoNome}` : `Atual e destino`}
                    </span>
                  </span>
                  {campo.obrigatorio && (pendente
                    ? <AlertCircle size={12} className="text-amber-400" aria-label="Pendente" />
                    : <CheckCircle2 size={12} className="text-emerald-400" aria-label="Preenchido" />)}
                </label>
                <CampoBpmInput campo={campo} disabled={!podeEditar} className={inputClassName} value={valores[campo.id] ?? ""} onChange={(valor) => {
                  draftSujoRef.current = true;
                  setValores((atuais) => ({ ...atuais, [campo.id]: valor }));
                }} />
              </div>
            );
          })}

          {exigeProximoContato && (
            <div className="space-y-1.5">
              <label htmlFor={`proximo-contato-transicao-${card.id}`} className="text-[11px] font-medium text-slate-400">Próximo Contato *</label>
              <input id={`proximo-contato-transicao-${card.id}`} disabled={!podeEditar} type="datetime-local" className={inputClassName} value={proximoContato} onChange={(evento) => {
                draftSujoRef.current = true;
                setProximoContato(evento.target.value);
              }} />
            </div>
          )}

          {guardasBloqueantes.map((guarda) => (
            <div key={guarda} className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <div className="flex items-start gap-2"><AlertCircle size={14} className="mt-0.5 shrink-0" /><span>{guarda}</span></div>
              {/follow[- ]?up|checklist/i.test(guarda) && (
                <button type="button" onClick={() => focarSecao(`follow-up-${card.id}`)} className="shrink-0 rounded-lg border border-amber-300/30 px-2 py-1 font-semibold hover:bg-amber-200/10">Ir ao checklist</button>
              )}
              {/campo/i.test(guarda) && !/follow[- ]?up|checklist/i.test(guarda) && (
                <button type="button" onClick={() => focarSecao(`campos-etapa-atual-${card.id}`)} className="shrink-0 rounded-lg border border-amber-300/30 px-2 py-1 font-semibold hover:bg-amber-200/10">Ir aos campos</button>
              )}
              {/reuni[aã]o|data|hora|transcri[cç][aã]o/i.test(guarda) && (
                <button type="button" onClick={onFocarPainelReuniao} className="shrink-0 rounded-lg border border-amber-300/30 px-2 py-1 font-semibold hover:bg-amber-200/10">Ir à reunião</button>
              )}
            </div>
          ))}

          {guardasBloqueantes.some((guarda) => /reuni[aã]o|data|hora|transcri[cç][aã]o/i.test(guarda)) && (
            <p className="text-[11px] text-amber-200/80">Complete a data, a hora ou a transcrição no painel Reunião à direita.</p>
          )}

          {camposExibidos.length === 0 && camposOrigem.length === 0 && guardasBloqueantes.length === 0 && !exigeProximoContato && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300"><CheckCircle2 size={14} /> Nenhuma pendência para este destino.</div>
          )}

          <button type="button" onClick={() => void salvarEAvancar()} disabled={!pronto || salvando} className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45" style={{ background: `rgba(${accent},0.85)` }}>
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {salvando ? "Salvando..." : `Salvar e avançar para ${requisitos.etapaDestino.nome}`}
          </button>
        </div>
      )}

      {(!podeEditar || !podeMover) && (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">Somente o responsável ou um administrador pode preencher requisitos e mover este card.</p>
      )}
    </section>
  );
}
