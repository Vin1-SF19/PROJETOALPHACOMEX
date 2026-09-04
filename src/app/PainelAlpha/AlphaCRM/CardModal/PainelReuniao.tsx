"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Video, CalendarClock, FileText, RefreshCw, CircleCheck } from "lucide-react";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { AgendarReuniaoGoogleMeetBpm, ReagendarReuniaoBpm } from "@/actions/bpm/GoogleMeet";
import {
  SalvarResumoReuniaoBpm,
  SincronizarTranscricaoReuniaoBpm,
} from "@/actions/bpm/TranscricaoMeet";
import { useCardSave } from "./CardSaveContext";
import { BpmDateTimeField } from "./BpmDateTimeField";
import { fmtDateTime, formatarDataHoraLocalBpm, parseDataHoraLocalBpm } from "@/lib/format-date";
import { criarRastreadorRascunho } from "@/lib/bpm/rascunho-versionado";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;

interface Props {
  card: CardDetalhe;
  accent: string;
  podeEditar: boolean;
  onAtualizado: () => void;
  /** No estágio Reunião Agendada, mantém apenas o acompanhamento/transcrição. */
  mostrarFormulario?: boolean;
}

export function PainelReuniao({ card, accent, podeEditar, onAtualizado, mostrarFormulario = true }: Props) {
  const { registerSave } = useCardSave();
  const [dataHora, setDataHora] = useState(() => formatarDataHoraLocalBpm(card.dataReuniao));
  const [erroDataHora, setErroDataHora] = useState<string | null>(null);
  const [resumo, setResumo] = useState(card.transcricaoReuniao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [salvandoResumo, setSalvandoResumo] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [erroTranscricao, setErroTranscricao] = useState<string | null>(null);
  const [motivoPendente, setMotivoPendente] = useState<string | null>(null);
  const [conflitoDataHora, setConflitoDataHora] = useState(false);
  const [conflitoResumo, setConflitoResumo] = useState(false);
  const cardIdRef = useRef(card.id);
  const dataHoraSujaRef = useRef(false);
  const resumoSujoRef = useRef(false);
  const dataHoraPersistidaRef = useRef(formatarDataHoraLocalBpm(card.dataReuniao));
  const resumoPersistidoRef = useRef(card.transcricaoReuniao ?? "");
  const dataHoraRascunhoRef = useRef(criarRastreadorRascunho(formatarDataHoraLocalBpm(card.dataReuniao)));
  const resumoRascunhoRef = useRef(criarRastreadorRascunho(card.transcricaoReuniao ?? ""));

  const jaAgendada = Boolean(card.googleEventId);
  const transcricaoRecebida = Boolean(card.transcricaoReuniao?.trim());

  useEffect(() => {
    const novaDataHora = formatarDataHoraLocalBpm(card.dataReuniao);
    const novoResumo = card.transcricaoReuniao ?? "";

    if (cardIdRef.current !== card.id) {
      cardIdRef.current = card.id;
      dataHoraSujaRef.current = false;
      resumoSujoRef.current = false;
      dataHoraPersistidaRef.current = novaDataHora;
      resumoPersistidoRef.current = novoResumo;
      dataHoraRascunhoRef.current = criarRastreadorRascunho(novaDataHora);
      resumoRascunhoRef.current = criarRastreadorRascunho(novoResumo);
      setDataHora(novaDataHora);
      setResumo(novoResumo);
      setConflitoDataHora(false);
      setConflitoResumo(false);
      return;
    }

    if (dataHoraSujaRef.current) {
      if (novaDataHora !== dataHoraPersistidaRef.current) setConflitoDataHora(true);
    } else {
      dataHoraPersistidaRef.current = novaDataHora;
      dataHoraRascunhoRef.current.sincronizar(novaDataHora);
      setDataHora(novaDataHora);
      setConflitoDataHora(false);
    }

    if (resumoSujoRef.current) {
      if (novoResumo !== resumoPersistidoRef.current) setConflitoResumo(true);
    } else {
      resumoPersistidoRef.current = novoResumo;
      resumoRascunhoRef.current.sincronizar(novoResumo);
      setResumo(novoResumo);
      setConflitoResumo(false);
    }
  }, [card.id, card.dataReuniao, card.transcricaoReuniao]);

  async function handleAgendar() {
    if (salvando || !podeEditar) return;
    const dataPersistida = parseDataHoraLocalBpm(dataHora);
    if (!dataPersistida) {
      setErroDataHora("Escolha uma data e uma hora válidas.");
      toast.error("Escolha data e hora da reunião");
      return;
    }
    setErroDataHora(null);
    const snapshot = dataHoraRascunhoRef.current.capturar();
    setSalvando(true);
    const dados = { cardId: card.id, dataHora: dataPersistida.toISOString() };
    const res = jaAgendada
      ? await ReagendarReuniaoBpm(dados)
      : await AgendarReuniaoGoogleMeetBpm(dados);
    setSalvando(false);

    if (res.success) {
      dataHoraPersistidaRef.current = snapshot.valor;
      if (dataHoraRascunhoRef.current.corresponde(snapshot)) {
        dataHoraSujaRef.current = false;
        setConflitoDataHora(false);
      }
      toast.success(jaAgendada ? "Reunião reagendada" : "Reunião agendada no Google Meet");
      onAtualizado();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Não foi possível salvar a reunião");
    }
  }

  async function handleSincronizarTranscricao() {
    setSincronizando(true);
    setErroTranscricao(null);
    setMotivoPendente(null);
    const res = await SincronizarTranscricaoReuniaoBpm({ cardId: card.id });
    setSincronizando(false);
    if (!res.success) {
      setErroTranscricao(res.error);
      toast.error(res.error);
      return;
    }
    if (res.data.status === "PENDENTE") {
      setMotivoPendente(res.data.motivo);
      toast.info(res.data.motivo);
      return;
    }
    toast.success(res.data.atualizada ? "Transcrição recebida" : "Transcrição já estava atualizada");
    onAtualizado();
  }

  async function persistirResumo(): Promise<boolean> {
    if (resumo === resumoPersistidoRef.current) return true;
    const snapshot = resumoRascunhoRef.current.capturar();
    return registerSave(async () => {
      setSalvandoResumo(true);
      const resultado = await SalvarResumoReuniaoBpm({
        cardId: card.id,
        resumo: snapshot.valor,
        versaoEsperadaEm: card.updatedAt,
      });
      setSalvandoResumo(false);
      if (!resultado.success) {
        toast.error(resultado.error);
        return false;
      }
      resumoPersistidoRef.current = snapshot.valor;
      if (resumoRascunhoRef.current.corresponde(snapshot)) {
        resumoSujoRef.current = false;
        setConflitoResumo(false);
      }
      toast.success("Resumo da reunião salvo");
      onAtualizado();
      return true;
    });
  }

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
        <CalendarClock size={13} className="text-slate-500" />
        Reunião
      </div>

      {!mostrarFormulario && card.dataReuniao && (
        <p className="text-[11px] text-slate-400">
          Data da reunião:{" "}
          <time dateTime={new Date(card.dataReuniao).toISOString()} className="font-medium text-slate-300">
            {fmtDateTime(card.dataReuniao)}
          </time>
        </p>
      )}

      {mostrarFormulario && (
        <>
          <BpmDateTimeField
            id={`reuniao-data-hora-${card.id}`}
            label="Data e hora da reunião"
            value={dataHora}
            onChange={(novoValor) => {
              dataHoraSujaRef.current = true;
              dataHoraRascunhoRef.current.alterar(novoValor);
              setDataHora(novoValor);
              setErroDataHora(null);
            }}
            required
            disabled={!podeEditar || salvando || (jaAgendada && transcricaoRecebida)}
            error={erroDataHora}
          />

          {conflitoDataHora && (
            <p className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3 text-xs text-sky-200" role="status">
              A data da reunião mudou externamente. Seu rascunho foi preservado.
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleAgendar()}
            disabled={!podeEditar || salvando || (jaAgendada && transcricaoRecebida)}
            title={jaAgendada && transcricaoRecebida
              ? "A reunião concluída não pode ser reutilizada após a chegada da transcrição."
              : undefined}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-60"
            style={{ background: `rgba(${accent},0.18)`, color: `rgb(${accent})`, border: `1px solid rgba(${accent},0.35)` }}
          >
            {salvando ? <RefreshCw size={13} className="animate-spin" /> : <Video size={13} />}
            {salvando
              ? "Salvando..."
              : jaAgendada && transcricaoRecebida
                ? "Reunião concluída"
                : jaAgendada
                  ? "Reagendar"
                  : "Agendar pelo Google Meet"}
          </button>

          {card.googleMeetLink && (
            <a
              href={card.googleMeetLink}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-[11px] text-slate-400 hover:text-slate-300 underline underline-offset-2"
            >
              Abrir link da reunião
            </a>
          )}
        </>
      )}

      {!jaAgendada && (
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200" role="status">
          Nenhuma reunião vinculada a este card
        </p>
      )}

      {!mostrarFormulario && jaAgendada && (
        <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-3 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            {card.transcricaoReuniao?.trim() ? (
              <>
                <CircleCheck size={14} className="text-emerald-400" />
                <span className="text-emerald-300">Transcrição recebida</span>
              </>
            ) : (
              <>
                <FileText size={14} className="text-amber-400" />
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-amber-200" role="status">
                  Transcrição ainda não disponível — tente novamente em alguns minutos
                </span>
              </>
            )}
          </div>

          {resumo.trim() ? (
            <div className="space-y-1.5">
              <label htmlFor={`resumo-reuniao-${card.id}`} className="text-[10px] font-medium text-slate-400">
                Resumo da reunião
              </label>
              <textarea
                id={`resumo-reuniao-${card.id}`}
                value={resumo}
                onChange={(event) => {
                  resumoSujoRef.current = true;
                  resumoRascunhoRef.current.alterar(event.target.value);
                  setResumo(event.target.value);
                }}
                onBlur={() => void persistirResumo()}
                disabled={!podeEditar || salvandoResumo}
                aria-label="Resumo da reunião"
                className="min-h-32 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-relaxed text-slate-300 outline-none transition-colors focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p className="text-[10px] text-slate-500" role="status" aria-live="polite">
                {salvandoResumo ? "Salvando resumo…" : "A transcrição do Meet pode ser ajustada antes de avançar."}
              </p>
              {conflitoResumo && (
                <p className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3 text-xs text-sky-200" role="status">
                  O resumo mudou externamente. Seu rascunho foi preservado.
                </p>
              )}
            </div>
          ) : (
            <p className="text-[10px] leading-relaxed text-slate-500">
              O Google pode levar alguns minutos após o fim da reunião para gerar o arquivo.
            </p>
          )}

          {motivoPendente && (
            <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-2 text-[10px] leading-relaxed text-amber-200" role="status">
              Transcrição ainda não disponível — tente novamente em alguns minutos. {motivoPendente}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleSincronizarTranscricao()}
            disabled={sincronizando || !podeEditar}
            aria-label={transcricaoRecebida ? "Atualizar transcrição" : "Buscar transcrição"}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCw size={12} className={sincronizando ? "animate-spin" : ""} />
            {sincronizando
              ? "Buscando transcrição…"
              : transcricaoRecebida
                ? "Atualizar transcrição"
                : "Buscar transcrição"}
          </button>

          {erroTranscricao && (
            <p className="text-[10px] leading-relaxed text-rose-300">Erro ao sincronizar: {erroTranscricao}</p>
          )}
        </div>
      )}
    </div>
  );
}
