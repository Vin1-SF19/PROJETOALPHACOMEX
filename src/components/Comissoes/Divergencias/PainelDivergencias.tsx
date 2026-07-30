"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatarDataComissao, traduzirDivergencia } from "../lib/formatters";
import {
  ListarDivergencias,
  ResolverDivergencia,
  ReprocessarAposCorrecao,
} from "@/actions/CommissionDivergences";
import type { CommissionDivergence } from "@prisma/client";

type DivergenciaComContexto = CommissionDivergence & {
  contexto: { razaoSocial: string | null; servico: string | null; colaboradorNome: string | null };
};

type Severidade = "PENDING_REVIEW" | "BLOCKED" | "INTEGRATION_ERROR";
type FiltroResolvido = "nao-resolvidas" | "resolvidas" | "todas";

const SEVERIDADE_COR: Record<Severidade, { dot: string; texto: string }> = {
  PENDING_REVIEW: { dot: "bg-amber-400", texto: "text-amber-400" },
  BLOCKED: { dot: "bg-rose-400", texto: "text-rose-400" },
  INTEGRATION_ERROR: { dot: "bg-rose-400", texto: "text-rose-400" },
};

const SEVERIDADE_LABEL: Record<Severidade, string> = {
  PENDING_REVIEW: "Pendente de Revisão",
  BLOCKED: "Bloqueado",
  INTEGRATION_ERROR: "Erro de Integração",
};

const PAGE_SIZE = 25;

export function PainelDivergencias() {
  const [divergencias, setDivergencias] = useState<DivergenciaComContexto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filtroSeveridade, setFiltroSeveridade] = useState<Severidade | "TODAS">("TODAS");
  const [filtroResolvido, setFiltroResolvido] = useState<FiltroResolvido>("nao-resolvidas");
  const [isPending, startTransition] = useTransition();

  const carregar = useCallback(async () => {
    setCarregando(true);
    const resultado = await ListarDivergencias({
      page,
      pageSize: PAGE_SIZE,
      severidade: filtroSeveridade === "TODAS" ? undefined : filtroSeveridade,
      resolvido: filtroResolvido === "todas" ? undefined : filtroResolvido === "resolvidas",
    });

    if (resultado.success) {
      setDivergencias(resultado.data);
      setTotalPages(resultado.totalPages);
      setErro(null);
    } else {
      setErro(resultado.error);
    }
    setCarregando(false);
  }, [page, filtroSeveridade, filtroResolvido]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  function resolver(divergenciaId: string) {
    startTransition(async () => {
      const resultado = await ResolverDivergencia({ divergenciaId });
      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao resolver divergência");
        return;
      }
      toast.success("Divergência marcada como resolvida.");
      void carregar();
    });
  }

  function reprocessar(divergenciaId: string) {
    startTransition(async () => {
      const resultado = await ReprocessarAposCorrecao({ divergenciaId });
      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao reprocessar divergência");
        return;
      }

      if (resultado.data.resolvida) {
        toast.success("Divergência não existe mais — marcada como resolvida.");
        void carregar();
      } else {
        toast.warning(resultado.data.motivo ?? "A divergência ainda existe nos dados reais.");
      }
    });
  }

  return (
    <div className="text-slate-200">
      <p className="text-sm text-slate-400">
        Dados que precisam de revisão antes de gerar/confirmar um cálculo financeiro.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Select value={filtroSeveridade} onValueChange={(v) => { setFiltroSeveridade(v as Severidade | "TODAS"); setPage(1); }}>
          <SelectTrigger className="w-[220px] border-white/10 bg-slate-900/40 text-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas as severidades</SelectItem>
            <SelectItem value="PENDING_REVIEW">Pendente de Revisão</SelectItem>
            <SelectItem value="BLOCKED">Bloqueado</SelectItem>
            <SelectItem value="INTEGRATION_ERROR">Erro de Integração</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroResolvido} onValueChange={(v) => { setFiltroResolvido(v as FiltroResolvido); setPage(1); }}>
          <SelectTrigger className="w-[200px] border-white/10 bg-slate-900/40 text-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nao-resolvidas">Não resolvidas</SelectItem>
            <SelectItem value="resolvidas">Resolvidas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {erro && (
        <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          Não foi possível carregar as divergências. <code className="text-xs text-rose-400/80">{erro}</code>
        </div>
      )}

      {carregando ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-slate-500" aria-hidden="true" />
        </div>
      ) : divergencias.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-[2rem] border border-white/5 bg-slate-900/40 py-16 text-slate-500">
          <CheckCircle2 className="size-6 text-emerald-400" aria-hidden="true" />
          <p>Nenhuma divergência encontrada com os filtros atuais.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {divergencias.map((divergencia) => {
            const severidade = divergencia.severidade as Severidade;
            const cores = SEVERIDADE_COR[severidade] ?? SEVERIDADE_COR.PENDING_REVIEW;
            const jaResolvida = divergencia.resolvidoEm !== null;
            const { titulo, explicacao, comoResolver } = traduzirDivergencia(divergencia.tipo);
            const { razaoSocial, servico, colaboradorNome } = divergencia.contexto;

            return (
              <div
                key={divergencia.id}
                className="rounded-2xl border border-white/5 bg-slate-900/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`size-1.5 rounded-full ${cores.dot}`} aria-hidden="true" />
                      <span className={`text-xs font-medium ${cores.texto}`}>
                        {SEVERIDADE_LABEL[severidade] ?? severidade}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-200">{titulo}</p>
                    {(razaoSocial || servico || colaboradorNome) && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[razaoSocial, servico, colaboradorNome].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatarDataComissao(divergencia.createdAt)}
                  </span>
                </div>

                <p className="mt-2 text-sm text-slate-300">{explicacao}</p>

                <div className="mt-3 rounded-xl border border-white/5 bg-slate-950/40 p-3">
                  <p className="text-xs font-medium text-slate-400">Como resolver</p>
                  <p className="mt-1 text-sm text-slate-300">{comoResolver}</p>
                </div>

                {jaResolvida ? (
                  <p className="mt-2 text-xs text-emerald-400">
                    Resolvida em {formatarDataComissao(divergencia.resolvidoEm)}
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-white/10"
                      disabled={isPending}
                      onClick={() => reprocessar(divergencia.id)}
                    >
                      <RefreshCcw className="size-3.5" aria-hidden="true" />
                      Reprocessar
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="border-white/10" disabled={isPending}>
                          Marcar como resolvida
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-white/10 bg-slate-950">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-200">Marcar como resolvida?</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            Isso marca a divergência como resolvida SEM verificar se o dado real ainda apresenta o
                            problema. Prefira &quot;Reprocessar&quot; quando possível, que confirma a correção nos dados reais.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => resolver(divergencia.id)}>Confirmar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm text-slate-400">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40"
          >
            Anterior
          </button>
          <span>Página {page} de {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
