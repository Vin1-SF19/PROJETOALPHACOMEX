"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardCopy, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";
import { ObterArtefatosMeetBpm } from "@/actions/bpm/TranscricaoMeet";

type Artefato = { nome: string; url: string };

export function PainelAlinhamentoEstrategico({ cardId, dataReuniao, googleEventId, linkResumo, responsavelNome }: {
  cardId: string;
  dataReuniao: Date | string | null;
  googleEventId: string | null;
  linkResumo: string | null;
  responsavelNome: string;
}) {
  const [resumos, setResumos] = useState<Artefato[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const reuniaoAgendada = Boolean(dataReuniao && googleEventId);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await ObterArtefatosMeetBpm({ cardId });
      if (resultado.success) setResumos(resultado.data.resumos);
      else setErro(resultado.error);
    } catch {
      setErro("Não foi possível consultar os resumos do Google Meet.");
    } finally {
      setCarregando(false);
    }
  }, [cardId]);

  useEffect(() => {
    if (!reuniaoAgendada) return;
    const timer = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(timer);
  }, [carregar, reuniaoAgendada]);

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado. Cole-o no campo Link do resumo da reunião.");
    } catch {
      toast.error("Não foi possível copiar o link. Abra o resumo e copie o endereço.");
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] p-4" aria-label="Resumos da reunião de alinhamento">
      <div className="flex items-center gap-2 text-sm font-semibold text-sky-100">
        <FileText size={16} aria-hidden="true" /> Resumos da reunião
      </div>
      <p className="text-xs text-slate-300">Responsável pelo processo: <strong>{responsavelNome}</strong>. O CPF exibido no formulário vem da mesma conta.</p>
      <p className="text-xs text-slate-300">Após a chamada, cole o link do resumo no campo configurado abaixo para liberar a próxima etapa.</p>
      {!linkResumo?.trim() && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
        Link do resumo da reunião pendente.
      </p>}
      {!reuniaoAgendada && <p className="text-xs text-amber-200">A reunião ainda não foi agendada.</p>}
      {reuniaoAgendada && <button type="button" onClick={() => void carregar()} disabled={carregando}
        className="rounded-lg border border-sky-300/25 px-3 py-1.5 text-xs text-sky-200 disabled:opacity-50">
        {carregando ? "Buscando resumos…" : "Atualizar resumos do Google Meet"}
      </button>}
      {erro && <p role="alert" className="text-xs text-rose-300">{erro}</p>}
      {resumos.map((resumo) => <div key={resumo.url} className="flex items-center gap-2 text-xs">
        <a href={resumo.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-200 underline underline-offset-2">
          {resumo.nome} <ExternalLink size={12} aria-hidden="true" />
        </a>
        <button type="button" onClick={() => void copiar(resumo.url)} aria-label={`Copiar link de ${resumo.nome}`}
          className="rounded p-1 text-slate-300 hover:text-white"><ClipboardCopy size={14} aria-hidden="true" /></button>
      </div>)}
      {reuniaoAgendada && !carregando && !erro && resumos.length === 0 &&
        <p className="text-xs text-slate-400">O Meet ainda não disponibilizou um resumo. Você pode colar um link de resumo criado manualmente.</p>}
    </section>
  );
}
