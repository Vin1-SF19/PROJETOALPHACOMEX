"use client";

import { useState } from "react";
import { CalendarDays, Loader2, MessageCirclePlus } from "lucide-react";
import { toast } from "sonner";
import { CriarInteracaoCardBpm, type ListarInteracoesCardBpm } from "@/actions/bpm/Interacoes";

type Interacao = Awaited<ReturnType<typeof ListarInteracoesCardBpm>>["data"][number];
type TipoContato = "LIGACAO" | "EMAIL" | "REUNIAO" | "WHATSAPP";

const TIPOS_CONTATO: ReadonlyArray<{ value: TipoContato; label: string }> = [
  { value: "LIGACAO", label: "Ligação" },
  { value: "EMAIL", label: "E-mail" },
  { value: "REUNIAO", label: "Reunião" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function ehTipoContato(tipo: string): tipo is TipoContato {
  return TIPOS_CONTATO.some((opcao) => opcao.value === tipo);
}

function rotuloTipo(tipo: TipoContato): string {
  return TIPOS_CONTATO.find((opcao) => opcao.value === tipo)?.label ?? tipo;
}

interface PainelContatosProps {
  cardId: string;
  interacoes: Interacao[];
  podeEditar: boolean;
  onInteracaoCriada: (interacao: Interacao) => void;
}

export function PainelContatos({ cardId, interacoes, podeEditar, onInteracaoCriada }: PainelContatosProps) {
  const [dataContato, setDataContato] = useState(hojeEmSaoPaulo);
  const [tipo, setTipo] = useState<TipoContato>("LIGACAO");
  const [notas, setNotas] = useState("");
  const [salvando, setSalvando] = useState(false);
  const contatos = interacoes.filter((interacao) => ehTipoContato(interacao.tipo));

  async function registrarContato() {
    if (!podeEditar || salvando || !dataContato) return;
    setSalvando(true);
    try {
      const resultado = await CriarInteracaoCardBpm({
        cardId,
        tipo,
        agendadoEm: new Date(`${dataContato}T12:00:00-03:00`).toISOString(),
        observacoes: notas.trim() || undefined,
      });
      if (!resultado.success || !resultado.data) {
        toast.error(typeof resultado.error === "string" ? resultado.error : "Não foi possível registrar o contato");
        return;
      }
      onInteracaoCriada(resultado.data);
      setNotas("");
      toast.success("Contato registrado");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="space-y-3 rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
        <MessageCirclePlus size={13} className="text-slate-500" aria-hidden="true" /> Contatos
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-[11px] font-medium text-slate-400">
          <span>Data *</span>
          <input type="date" required value={dataContato} onChange={(event) => setDataContato(event.target.value)} disabled={!podeEditar || salvando} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-white/25" />
        </label>
        <label className="space-y-1 text-[11px] font-medium text-slate-400">
          <span>Tipo *</span>
          <select
            value={tipo}
            onChange={(event) => { if (ehTipoContato(event.target.value)) setTipo(event.target.value); }}
            disabled={!podeEditar || salvando}
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-white/25"
          >
            {TIPOS_CONTATO.map((opcao) => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
          </select>
        </label>
      </div>
      <label className="block space-y-1 text-[11px] font-medium text-slate-400">
        <span>Notas</span>
        <textarea value={notas} onChange={(event) => setNotas(event.target.value)} disabled={!podeEditar || salvando} maxLength={4000} className="min-h-20 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-white/25" />
      </label>
      <button type="button" onClick={() => void registrarContato()} disabled={!podeEditar || salvando || !dataContato} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">
        {salvando ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <MessageCirclePlus size={12} aria-hidden="true" />}
        Registrar contato
      </button>
      <div className="space-y-2" aria-live="polite">
        {contatos.length === 0 ? <p className="text-[11px] text-slate-500">Nenhum contato registrado.</p> : contatos.map((contato) => {
          const contatoTipo = ehTipoContato(contato.tipo) ? contato.tipo : "LIGACAO";
          const dataOriginal = contato.agendadoEm ?? contato.createdAt;
          const data = dataOriginal instanceof Date ? dataOriginal : new Date(dataOriginal);
          return (
            <div key={contato.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                <CalendarDays size={12} aria-hidden="true" /> {rotuloTipo(contatoTipo)} · {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(data)}
              </p>
              {contato.observacoes && <p className="mt-1 whitespace-pre-wrap text-[11px] text-slate-400">{contato.observacoes}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
