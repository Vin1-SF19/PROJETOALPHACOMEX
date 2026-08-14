"use client";

import { useEffect, useState } from "react";
import { Building2, History, KanbanSquare, Loader2 } from "lucide-react";

import { ObterPerfilEmpresaBpm } from "@/actions/bpm/Empresas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtDateTime } from "@/lib/format-date";

type Perfil = NonNullable<Awaited<ReturnType<typeof ObterPerfilEmpresaBpm>>["data"]>;

interface EmpresaPerfilModalProps {
  empresaId: number;
  aberto: boolean;
  accent: string;
  onAbertoChange: (aberto: boolean) => void;
  onAbrirCard: (cardId: string) => void;
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

/**
 * Perfil consolidado da empresa no contexto do CRM.
 *
 * O perfil nunca abre um segundo CardFullViewModal: ao selecionar outro card,
 * fecha este diálogo e delega a troca ao modal de card já aberto por trás dele.
 */
export function EmpresaPerfilModal({
  empresaId,
  aberto,
  accent,
  onAbertoChange,
  onAbrirCard,
}: EmpresaPerfilModalProps) {
  const [resultado, setResultado] = useState<{
    chave: string;
    perfil: Perfil | null;
    erro: string | null;
  } | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const chaveConsulta = `${empresaId}:${tentativa}`;
  const perfil = resultado?.chave === chaveConsulta ? resultado.perfil : null;
  const erro = resultado?.chave === chaveConsulta ? resultado.erro : null;
  const carregando = aberto && resultado?.chave !== chaveConsulta;

  useEffect(() => {
    if (!aberto) return;

    let cancelado = false;
    ObterPerfilEmpresaBpm(empresaId)
      .then((resultado) => {
        if (cancelado) return;
        if (!resultado.success || !resultado.data) {
          setResultado({
            chave: chaveConsulta,
            perfil: null,
            erro: resultado.error || "Não foi possível carregar o perfil da empresa.",
          });
          return;
        }
        setResultado({ chave: chaveConsulta, perfil: resultado.data, erro: null });
      })
      .catch(() => {
        if (!cancelado) {
          setResultado({
            chave: chaveConsulta,
            perfil: null,
            erro: "Não foi possível carregar o perfil da empresa.",
          });
        }
      });

    return () => {
      cancelado = true;
    };
  }, [aberto, empresaId, chaveConsulta]);

  function abrirCard(cardId: string) {
    onAbertoChange(false);
    onAbrirCard(cardId);
  }

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="z-[60] flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden border-white/10 bg-slate-950 p-0 text-slate-100 shadow-2xl sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5 pr-12">
          <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: `rgba(${accent},0.15)`, color: `rgb(${accent})` }}
            >
              <Building2 size={18} aria-hidden="true" />
            </span>
            Perfil da empresa
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Cards e histórico disponíveis para seu acesso no CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-40 flex-1 overflow-y-auto px-6 py-5">
          {carregando ? (
            <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              Carregando perfil da empresa...
            </div>
          ) : erro ? (
            <div role="alert" className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-rose-300">{erro}</p>
              <button
                type="button"
                onClick={() => setTentativa((valor) => valor + 1)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2"
                style={{ ["--tw-ring-color" as string]: `rgb(${accent})` }}
              >
                Tentar novamente
              </button>
            </div>
          ) : perfil ? (
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                  style={{ background: `rgba(${accent},0.15)`, color: `rgb(${accent})` }}
                >
                  <Building2 size={18} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black text-white">
                    {perfil.empresa.nomeFantasia || perfil.empresa.razaoSocial}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {perfil.empresa.cnpj} · {perfil.totalCards} card(s) em {perfil.cardsPorPipeline.length} pipeline(s)
                  </p>
                </div>
              </div>

              <section className="space-y-4" aria-labelledby="perfil-empresa-cards">
                <h3 id="perfil-empresa-cards" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white">
                  <KanbanSquare size={13} aria-hidden="true" /> Cards por pipeline
                </h3>
                {perfil.cardsPorPipeline.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum card encontrado para esta empresa.</p>
                ) : perfil.cardsPorPipeline.map(({ pipelineNome, cards }) => (
                  <div key={pipelineNome} className="space-y-2">
                    <h4 className="text-sm font-semibold text-slate-300">{pipelineNome}</h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {cards.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => abrirCard(card.id)}
                          className="block rounded-xl border border-white/5 bg-slate-900/60 p-3 text-left transition-colors hover:border-white/15 focus-visible:outline-none focus-visible:ring-2"
                          style={{ ["--tw-ring-color" as string]: `rgb(${accent})` }}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-white">{card.etapa.nome}</span>
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                              style={{
                                background: `rgba(${STATUS_COR[card.status] ?? "148,163,184"},0.15)`,
                                color: `rgb(${STATUS_COR[card.status] ?? "148,163,184"})`,
                              }}
                            >
                              {STATUS_LABEL[card.status] ?? card.status}
                            </span>
                          </div>
                          {card.servico && <p className="mb-1 text-xs text-slate-400">{card.servico}</p>}
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

              <section className="space-y-2" aria-labelledby="perfil-empresa-historico">
                <h3 id="perfil-empresa-historico" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white">
                  <History size={13} aria-hidden="true" /> Histórico consolidado
                </h3>
                <div className="space-y-1.5 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  {perfil.historico.map((historico) => (
                    <div key={historico.id} className="border-l-2 border-white/10 py-0.5 pl-2 text-xs text-slate-400">
                      <span className="text-slate-300">{historico.acao}</span>
                      {" — "}{historico.card.pipeline.nome}{" · "}
                      {historico.usuario?.nome ?? (historico.automacaoOrigem ? `automação (${historico.automacaoOrigem})` : "sistema")}
                      {" · "}{fmtDateTime(historico.createdAt)}
                    </div>
                  ))}
                  {perfil.historico.length === 0 && <p className="text-xs text-slate-600">Sem histórico ainda.</p>}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
