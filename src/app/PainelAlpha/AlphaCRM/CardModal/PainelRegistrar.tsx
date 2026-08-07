"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, ScrollText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { CriarInteracaoCardBpm, type ListarInteracoesCardBpm } from "@/actions/bpm/Interacoes";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type Interacao = Awaited<ReturnType<typeof ListarInteracoesCardBpm>>["data"][number];
type EtapaOpcao = { id: string; nome: string; ordem: number; script: string | null };

interface Props {
  card: CardDetalhe;
  etapaAtual: EtapaOpcao | null;
  accent: string;
  onInteracaoCriada: (interacao: Interacao) => void;
}

const inputCls = "w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/25 transition-colors";

export default function PainelRegistrar({ card, etapaAtual, accent, onInteracaoCriada }: Props) {
  const [agendaData, setAgendaData] = useState("");
  const [agendaHora, setAgendaHora] = useState("");
  const [agendaLink, setAgendaLink] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function handleSalvar() {
    setSalvando(true);
    let agendadoEm: Date | undefined;
    if (agendaData) agendadoEm = new Date(`${agendaData}T${agendaHora || "00:00"}`);

    const res = await CriarInteracaoCardBpm({
      cardId: card.id,
      agendadoEm,
      agendaLink: agendaLink.trim() || undefined,
      observacoes: observacoes.trim() || undefined,
    });
    setSalvando(false);

    if (res.success && res.data) {
      toast.success("Interação registrada");
      onInteracaoCriada(res.data as unknown as Interacao);
      setAgendaData("");
      setAgendaHora("");
      setAgendaLink("");
      setObservacoes("");
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao registrar interação");
    }
  }

  return (
    <div
      className="rounded-3xl border overflow-y-auto p-5"
      style={{
        borderColor: `rgba(${accent},0.15)`,
        background: `linear-gradient(180deg, rgba(${accent},0.06), transparent 40%)`,
      }}
    >
      <Tabs defaultValue="agora">
        <TabsList className="w-full">
          <TabsTrigger value="agora" className="gap-1.5">
            <CalendarClock size={13} /> Agora
          </TabsTrigger>
          <TabsTrigger value="script" className="gap-1.5">
            <ScrollText size={13} /> Script
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agora" className="space-y-4 mt-5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1.5">Data</label>
              <input type="date" className={inputCls} value={agendaData} onChange={(e) => setAgendaData(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1.5">Hora</label>
              <input type="time" className={inputCls} value={agendaHora} onChange={(e) => setAgendaHora(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1.5">Link</label>
            <input type="url" className={inputCls} placeholder="https://..." value={agendaLink} onChange={(e) => setAgendaLink(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1.5">Observações</label>
            <textarea
              className={`${inputCls} min-h-[160px] resize-none`}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 shadow-lg transition-transform active:scale-[0.98]"
            style={{ background: `rgb(${accent})`, boxShadow: `0 8px 24px -8px rgba(${accent},0.6)` }}
          >
            {salvando ? "Salvando..." : "Registrar"}
          </button>
        </TabsContent>

        <TabsContent value="script" className="mt-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">{etapaAtual?.nome ?? card.etapa.nome}</p>
          {etapaAtual?.script ? (
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{etapaAtual.script}</p>
          ) : (
            <p className="text-xs text-slate-600">Nenhum script configurado para esta etapa ainda.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
