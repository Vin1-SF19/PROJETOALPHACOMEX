"use client";

import { useEffect, useState } from "react";
import { Loader2, Building2, FileStack, KanbanSquare } from "lucide-react";
import { fmtDateTime } from "@/lib/format-date";
import { ObterHistoricoServicoEmpresa } from "@/actions/bpm/Cards";
import { SectionCard } from "./PainelHistoricoShared";

type HistoricoServico = NonNullable<Awaited<ReturnType<typeof ObterHistoricoServicoEmpresa>>["data"]>;

interface Props {
  cardId: string;
  servico: string;
  accent: string;
  onAbrirCard: (cardId: string) => void;
}

function formatarDataTexto(valor: string | null): string {
  if (!valor) return "—";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR");
}

function formatarValor(valor: number | null): string {
  if (valor === null || valor === undefined) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PainelHistoricoServico({ cardId, servico, accent, onAbrirCard }: Props) {
  const [dados, setDados] = useState<HistoricoServico | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    ObterHistoricoServicoEmpresa(cardId, servico).then((res) => {
      if (cancelado) return;
      if (!res.success || !res.data) {
        setErro(typeof res.error === "string" ? res.error : "Erro ao carregar histórico");
        return;
      }
      setDados(res.data);
    });

    return () => { cancelado = true; };
  }, [cardId, servico]);

  if (erro) {
    return (
      <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4">
        <p className="text-sm text-rose-300">{erro}</p>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-slate-500" size={22} />
      </div>
    );
  }

  const totalRegistros = dados.registrosClientes.length + dados.contratos.length + dados.outrosCards.length;

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent overflow-y-auto p-4 space-y-3">
      {totalRegistros === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
          <p className="text-xs text-slate-500">Nenhum histórico de {servico} encontrado para esta empresa.</p>
        </div>
      )}

      {dados.registrosClientes.length > 0 && (
        <SectionCard icon={Building2} title="Cadastros CS&NPS" count={dados.registrosClientes.length} accent={accent} defaultOpen>
          <div className="space-y-1.5 mt-2">
            {dados.registrosClientes.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">{c.servico || "—"}</span>
                  <span className="text-[10px] text-slate-500">{c.status}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Analista: {c.analistaResponsavel || "—"} · Contratado em: {formatarDataTexto(c.dataContratacao)}
                </div>
                {c.dataExito && <div className="text-[11px] text-emerald-400/80">Êxito em: {formatarDataTexto(c.dataExito)}</div>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {dados.contratos.length > 0 && (
        <SectionCard icon={FileStack} title="Contratos" count={dados.contratos.length} accent={accent}>
          <div className="space-y-1.5 mt-2">
            {dados.contratos.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">{c.servico}</span>
                  <span className="text-[10px] text-slate-500">{fmtDateTime(c.createdAt)}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {formatarValor(c.valorContrato)} · {c.formaPagamento || "—"} · Closer: {c.closerNome || "—"}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {dados.outrosCards.length > 0 && (
        <SectionCard icon={KanbanSquare} title="Outros Cards do CRM" count={dados.outrosCards.length} accent={accent}>
          <div className="space-y-1.5 mt-2">
            {dados.outrosCards.map((c) => (
              <button
                key={c.id}
                onClick={() => onAbrirCard(c.id)}
                className="w-full flex items-center justify-between gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-left hover:border-white/10"
              >
                <div className="min-w-0">
                  <p className="text-xs text-slate-300 truncate">{c.pipeline.nome} · {c.etapa.nome}</p>
                  <p className="text-[10px] text-slate-500">{c.servico || "—"} · {fmtDateTime(c.createdAt)}</p>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0">{c.status}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
