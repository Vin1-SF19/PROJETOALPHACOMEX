"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Video, CalendarClock } from "lucide-react";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { AgendarReuniaoGoogleMeetBpm, ReagendarReuniaoBpm } from "@/actions/bpm/GoogleMeet";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;

interface Props {
  card: CardDetalhe;
  accent: string;
  onAtualizado: () => void;
}

function paraInputDatetimeLocal(data: Date | string | null): string {
  if (!data) return "";
  const d = new Date(data);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PainelReuniao({ card, accent, onAtualizado }: Props) {
  const [dataHora, setDataHora] = useState(() => paraInputDatetimeLocal(card.dataReuniao));
  const [salvando, setSalvando] = useState(false);

  const jaAgendada = Boolean(card.googleEventId);

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

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
        <CalendarClock size={13} className="text-slate-500" />
        Reunião
      </div>

      <input
        type="datetime-local"
        value={dataHora}
        onChange={(e) => setDataHora(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-200 outline-none"
      />

      <button
        type="button"
        onClick={() => void handleAgendar()}
        disabled={salvando}
        className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-60"
        style={{ background: `rgba(${accent},0.18)`, color: `rgb(${accent})`, border: `1px solid rgba(${accent},0.35)` }}
      >
        <Video size={13} />
        {salvando ? "Salvando..." : jaAgendada ? "Reagendar" : "Agendar pelo Google Meet"}
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
    </div>
  );
}
