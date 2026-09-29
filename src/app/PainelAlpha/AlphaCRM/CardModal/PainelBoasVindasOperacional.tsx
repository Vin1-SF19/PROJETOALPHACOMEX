"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Video } from "lucide-react";
import { toast } from "sonner";
import { IniciarBoasVindasOperacionalBpm, ListarAnalistasBoasVindasBpm } from "@/actions/bpm/GoogleMeet";
import { BpmDateTimeField } from "./BpmDateTimeField";
import { formatarDataHoraLocalBpm, parseDataHoraLocalBpm } from "@/lib/format-date";
import { emailClienteReuniaoSchema } from "@/lib/bpm/email-reuniao";

type Analista = { id: number; nome: string; email: string };

export function PainelBoasVindasOperacional({ cardId, emailInicial, dataReuniao,
  googleMeetLink, responsavelNome, podeEditar, onAtualizado }: {
  cardId: string;
  emailInicial: string | null;
  dataReuniao: Date | string | null;
  googleMeetLink: string | null;
  responsavelNome: string;
  podeEditar: boolean;
  onAtualizado: () => void;
}) {
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [analistaId, setAnalistaId] = useState("");
  const [dataHora, setDataHora] = useState(() => formatarDataHoraLocalBpm(dataReuniao));
  const [emailCliente, setEmailCliente] = useState(emailInicial ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!podeEditar || googleMeetLink) return;
    let ativo = true;
    void ListarAnalistasBoasVindasBpm(cardId).then((resultado) => {
      if (!ativo) return;
      if (resultado.success) setAnalistas(resultado.data);
      else setErro(resultado.error);
    });
    return () => { ativo = false; };
  }, [cardId, googleMeetLink, podeEditar]);

  async function iniciar() {
    const data = parseDataHoraLocalBpm(dataHora);
    const email = emailClienteReuniaoSchema.safeParse(emailCliente);
    if (!analistaId || !data || !email.success) {
      setErro("Escolha a analista, uma data e hora válidas e o e-mail do contato.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const resultado = await IniciarBoasVindasOperacionalBpm({ cardId,
        analistaId: Number(analistaId), dataHora: data.toISOString(), emailCliente: email.data });
      if (!resultado.success) {
        setErro(typeof resultado.error === "string" ? resultado.error : "Revise os dados da reunião.");
        return;
      }
      toast.success("Analista atribuída e reunião Google Meet agendada.");
      onAtualizado();
    } catch {
      setErro("Não foi possível iniciar Boas-vindas. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] p-4" aria-label="Início do atendimento operacional">
      <div className="flex items-center gap-2 text-sm font-semibold text-sky-100">
        <CalendarClock size={16} aria-hidden="true" /> Boas-vindas e primeira reunião
      </div>
      {googleMeetLink ? (
        <div className="space-y-1 text-xs text-slate-300">
          <p>Responsável: {responsavelNome}</p>
          <p>Reunião: {dataReuniao ? new Date(dataReuniao).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Agendada"}</p>
          <a href={googleMeetLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-200 underline underline-offset-2">
            <Video size={13} aria-hidden="true" /> Abrir Google Meet
          </a>
        </div>
      ) : podeEditar ? (
        <div className="space-y-3">
          <div>
            <label htmlFor={`analista-boas-vindas-${cardId}`} className="mb-1 block text-xs text-slate-300">Analista responsável</label>
            <select id={`analista-boas-vindas-${cardId}`} value={analistaId}
              onChange={(evento) => setAnalistaId(evento.target.value)} disabled={salvando}
              className="w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-xs text-white">
              <option value="">Selecione a analista</option>
              {analistas.map((analista) => <option key={analista.id} value={analista.id}>{analista.nome}</option>)}
            </select>
          </div>
          <BpmDateTimeField id={`primeira-reuniao-${cardId}`} label="Data e hora da primeira reunião"
            value={dataHora} onChange={setDataHora} required disabled={salvando} />
          <div>
            <label htmlFor={`contato-boas-vindas-${cardId}`} className="mb-1 block text-xs text-slate-300">E-mail do contato do cliente</label>
            <input id={`contato-boas-vindas-${cardId}`} type="email" required value={emailCliente}
              onChange={(evento) => setEmailCliente(evento.target.value)} disabled={salvando}
              className="w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-xs text-white" />
          </div>
          {erro && <p role="alert" className="text-xs text-rose-300">{erro}</p>}
          <button type="button" onClick={() => void iniciar()} disabled={salvando}
            className="w-full rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-60">
            {salvando ? "Agendando…" : "Atribuir analista e agendar Google Meet"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-amber-200">Aguardando a direção atribuir a analista e agendar a primeira reunião.</p>
      )}
    </section>
  );
}
