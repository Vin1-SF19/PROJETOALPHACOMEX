"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Video, CalendarClock, FileText, RefreshCw, CircleCheck } from "lucide-react";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { AgendarReuniaoGoogleMeetBpm, ReagendarReuniaoBpm } from "@/actions/bpm/GoogleMeet";
import { SincronizarTranscricaoReuniaoBpm } from "@/actions/bpm/TranscricaoMeet";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;

interface Props {
  card: CardDetalhe;
  accent: string;
  onAtualizado: () => void;
  /** No estágio Reunião Agendada, mantém apenas o acompanhamento/transcrição. */
  mostrarFormulario?: boolean;
}

function paraInputDatetimeLocal(data: Date | string | null): string {
  if (!data) return "";
  const d = new Date(data);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PainelReuniao({ card, accent, onAtualizado, mostrarFormulario = true }: Props) {
  const [dataHora, setDataHora] = useState(() => paraInputDatetimeLocal(card.dataReuniao));
  const [salvando, setSalvando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [erroTranscricao, setErroTranscricao] = useState<string | null>(null);

  const jaAgendada = Boolean(card.googleEventId);
  const transcricaoRecebida = Boolean(card.transcricaoReuniao?.trim());

  async function handleAgendar() {
    if (!dataHora) { toast.error("Escolha data e hora da reunião"); return; }
    setSalvando(true);
    const dados = { cardId: card.id, dataHora: new Date(dataHora).toISOString() };
    const res = jaAgendada
      ? await ReagendarReuniaoBpm(dados)
      : await AgendarReuniaoGoogleMeetBpm(dados);
    setSalvando(false);

    if (res.success) {
      toast.success(jaAgendada ? "Reunião reagendada" : "Reunião agendada no Google Meet");
      onAtualizado();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Não foi possível salvar a reunião");
    }
  }

  async function handleSincronizarTranscricao() {
    setSincronizando(true);
    setErroTranscricao(null);
    const res = await SincronizarTranscricaoReuniaoBpm({ cardId: card.id });
    setSincronizando(false);
    if (!res.success) {
      setErroTranscricao(res.error);
      toast.error(res.error);
      return;
    }
    if (res.data.status === "PENDENTE") {
      toast.info(res.data.motivo);
      return;
    }
    toast.success(res.data.atualizada ? "Transcrição recebida" : "Transcrição já estava atualizada");
    onAtualizado();
  }

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
        <CalendarClock size={13} className="text-slate-500" />
        Reunião
      </div>

      {mostrarFormulario && (
        <>
          <input
            type="datetime-local"
            value={dataHora}
            onChange={(e) => setDataHora(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-200 outline-none"
          />

          <button
            type="button"
            onClick={() => void handleAgendar()}
            disabled={salvando || (jaAgendada && transcricaoRecebida)}
            title={jaAgendada && transcricaoRecebida
              ? "A reunião concluída não pode ser reutilizada após a chegada da transcrição."
              : undefined}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-60"
            style={{ background: `rgba(${accent},0.18)`, color: `rgb(${accent})`, border: `1px solid rgba(${accent},0.35)` }}
          >
            <Video size={13} />
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

      {jaAgendada && (
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
                <span className="text-amber-200">Transcrição pendente</span>
              </>
            )}
          </div>

          {card.transcricaoReuniao?.trim() ? (
            <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl bg-black/20 p-3 text-[11px] leading-relaxed text-slate-300">
              {card.transcricaoReuniao}
            </pre>
          ) : (
            <p className="text-[10px] leading-relaxed text-slate-500">
              O Google pode levar alguns minutos após o fim da reunião para gerar o arquivo.
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleSincronizarTranscricao()}
            disabled={sincronizando}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCw size={12} className={sincronizando ? "animate-spin" : ""} />
            {sincronizando ? "Sincronizando..." : "Sincronizar transcrição"}
          </button>

          {erroTranscricao && (
            <p className="text-[10px] leading-relaxed text-rose-300">Erro ao sincronizar: {erroTranscricao}</p>
          )}
        </div>
      )}
    </div>
  );
}
