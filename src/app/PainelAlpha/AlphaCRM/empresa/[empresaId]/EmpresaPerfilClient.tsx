"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, History, KanbanSquare } from "lucide-react";
import { fmtDateTime } from "@/lib/format-date";
import type { TemaAlpha } from "@/lib/temas";
import CardDetailDrawer from "../../pipeline/[pipelineId]/CardDetailDrawer";
import type { ObterPerfilEmpresaBpm } from "@/actions/bpm/Empresas";

type Perfil = NonNullable<Awaited<ReturnType<typeof ObterPerfilEmpresaBpm>>["data"]>;

interface Props {
  perfil: Perfil;
  visual: TemaAlpha;
  currentUserId: number | null;
  currentUserRole: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  ATIVO: "Ativo",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

const STATUS_COR: Record<string, string> = {
  ATIVO: "52,211,153",
  CONCLUIDO: "147,197,253",
  CANCELADO: "248,113,113",
};

export default function EmpresaPerfilClient({ perfil, visual, currentUserId, currentUserRole }: Props) {
  const accent = visual.accent;
  const router = useRouter();
  const [cardSelecionadoId, setCardSelecionadoId] = useState<string | null>(null);

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `rgba(${accent},0.15)` }}>
          <Building2 size={18} style={{ color: `rgb(${accent})` }} />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">
            {perfil.empresa.nomeFantasia || perfil.empresa.razaoSocial}
          </h1>
          <p className="text-xs text-slate-500">{perfil.empresa.cnpj} · {perfil.totalCards} card(s) em {perfil.cardsPorPipeline.length} pipeline(s)</p>
        </div>
      </div>

      {/* Cards agrupados por pipeline */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
          <KanbanSquare size={13} /> Cards por pipeline
        </h2>
        {perfil.cardsPorPipeline.length === 0 && (
          <p className="text-sm text-slate-500">Nenhum card encontrado para esta empresa.</p>
        )}
        {perfil.cardsPorPipeline.map(({ pipelineNome, cards }) => (
          <div key={pipelineNome} className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-300">{pipelineNome}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {cards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => setCardSelecionadoId(card.id)}
                  className="text-left bg-slate-900/60 border border-white/5 rounded-xl p-3 hover:border-white/15 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-white truncate">{card.etapa.nome}</span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: `rgba(${STATUS_COR[card.status] ?? "148,163,184"},0.15)`, color: `rgb(${STATUS_COR[card.status] ?? "148,163,184"})` }}
                    >
                      {STATUS_LABEL[card.status] ?? card.status}
                    </span>
                  </div>
                  {card.servico && <p className="text-xs text-slate-400 mb-1">{card.servico}</p>}
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{card.responsavel.nome}</span>
                    <span>{fmtDateTime(card.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Histórico consolidado */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
          <History size={13} /> Histórico consolidado
        </h2>
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {perfil.historico.map((h) => (
            <div key={h.id} className="text-xs text-slate-400 border-l-2 border-white/10 pl-2 py-0.5">
              <span className="text-slate-300">{h.acao}</span>
              {" — "}
              {h.card.pipeline.nome}
              {" · "}
              {h.usuario?.nome ?? (h.automacaoOrigem ? `automação (${h.automacaoOrigem})` : "sistema")}
              {" · "}
              {fmtDateTime(h.createdAt)}
            </div>
          ))}
          {perfil.historico.length === 0 && <p className="text-xs text-slate-600">Sem histórico ainda.</p>}
        </div>
      </section>

      {cardSelecionadoId && (
        <CardDetailDrawer
          cardId={cardSelecionadoId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          accent={accent}
          onClose={() => setCardSelecionadoId(null)}
          onAtualizado={() => router.refresh()}
          onAbrirCard={setCardSelecionadoId}
        />
      )}
    </div>
  );
}
