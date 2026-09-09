"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

type Etapa = { id: string; nome: string };
export type EscopoEtapaChecklist = "TODAS" | "SELECIONADAS";

interface EtapasMultiSelectProps {
  accent?: string;
  pipelineSelecionado: boolean;
  etapas: Etapa[];
  escopo: EscopoEtapaChecklist;
  selecionadas: string[];
  onEscopoChange: (escopo: EscopoEtapaChecklist) => void;
  onSelecionadasChange: (ids: string[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function EtapasMultiSelect({
  accent,
  pipelineSelecionado,
  etapas,
  escopo,
  selecionadas,
  onEscopoChange,
  onSelecionadasChange,
  disabled,
  isLoading = false,
  error = null,
  onRetry,
}: EtapasMultiSelectProps) {
  const mapaEtapas = new Map(etapas.map((etapa) => [etapa.id, etapa.nome]));
  const faltantes = selecionadas.filter((id) => !mapaEtapas.has(id));
  const semSelecao = escopo === "SELECIONADAS" && selecionadas.length === 0;
  const controlesDesabilitados = !pipelineSelecionado || disabled || isLoading || Boolean(error);

  function alternarEtapa(id: string, marcado: boolean) {
    onSelecionadasChange(
      marcado ? [...new Set([...selecionadas, id])] : selecionadas.filter((atual) => atual !== id),
    );
  }

  function alterarEscopo(novoEscopo: EscopoEtapaChecklist) {
    if (novoEscopo === "TODAS") onSelecionadasChange([]);
    onEscopoChange(novoEscopo);
  }

  const limiteBadges = selecionadas.length >= 4 ? 2 : 3;
  const resumo = selecionadas.slice(0, limiteBadges).map((id) => ({ id, nome: mapaEtapas.get(id) ?? "Etapa indisponível" }));
  const excedente = selecionadas.length - resumo.length;

  return (
    <fieldset
      className="min-w-0 space-y-3"
      aria-busy={isLoading}
      aria-disabled={Boolean(disabled || isLoading || error)}
      aria-describedby="etapas-checklist-ajuda"
    >
      <legend className="text-sm font-medium text-slate-200">Etapas</legend>
      <p id="etapas-checklist-ajuda" className="text-xs text-slate-500">
        {pipelineSelecionado
          ? "Escolha se o checklist se aplica a qualquer etapa do pipeline ou somente a etapas específicas."
          : "Selecione um pipeline para restringir o checklist a etapas específicas."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-200">
          <input
            type="radio"
            name="escopo-etapa-checklist"
            className="size-4 accent-current outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            style={accent ? { accentColor: `rgb(${accent})` } : undefined}
            checked={escopo === "TODAS"}
            disabled={Boolean(disabled || isLoading || error)}
            onChange={() => alterarEscopo("TODAS")}
          />
          Todas as etapas
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-200">
          <input
            type="radio"
            name="escopo-etapa-checklist"
            className="size-4 accent-current outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            style={accent ? { accentColor: `rgb(${accent})` } : undefined}
            checked={escopo === "SELECIONADAS"}
            disabled={controlesDesabilitados}
            onChange={() => alterarEscopo("SELECIONADAS")}
          />
          Etapas selecionadas
        </label>
      </div>

      {isLoading && (
        <div className="space-y-2 rounded-xl border border-white/[0.07] p-3" role="status">
          <span className="text-xs text-slate-400">Carregando etapas…</span>
          {[0, 1, 2].map((indice) => <Skeleton key={indice} className="h-11 w-full" />)}
        </div>
      )}

      {!isLoading && error && (
        <div role="alert" className="space-y-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          <p>Não foi possível carregar as etapas. Tente novamente.</p>
          {onRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={disabled}>
              Tentar novamente
            </Button>
          )}
        </div>
      )}

      {!isLoading && !error && escopo === "SELECIONADAS" && pipelineSelecionado && (
        <div className="space-y-2">
          {etapas.length === 0
            ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">Este pipeline não possui etapas ativas.</p>
            : (
              <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto rounded-xl border border-white/[0.07] p-2 sm:grid-cols-2">
                {etapas.map((etapa) => (
                  <label key={etapa.id} className="flex min-w-0 min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-slate-200 hover:bg-white/[0.04]">
                    <Checkbox
                      style={accent && selecionadas.includes(etapa.id) ? { backgroundColor: `rgb(${accent})`, borderColor: `rgb(${accent})` } : undefined}
                      checked={selecionadas.includes(etapa.id)}
                      disabled={controlesDesabilitados}
                      aria-invalid={faltantes.length > 0}
                      onCheckedChange={(valor) => alternarEtapa(etapa.id, valor === true)}
                    />
                    <span className="min-w-0 break-all">{etapa.nome}</span>
                  </label>
                ))}
              </div>
            )}

          <div aria-live="polite" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            {selecionadas.length === 0 && <span>Nenhuma etapa selecionada</span>}
            {selecionadas.length > 0 && (
              <>
                <span>{selecionadas.length} {selecionadas.length === 1 ? "etapa selecionada" : "etapas selecionadas"}</span>
                {resumo.map((item) => (
                  <Badge key={item.id} variant="outline" className="min-w-0 max-w-full gap-1">
                    <span className="min-w-0 truncate" title={item.nome}>{item.nome}</span>
                    <button
                      type="button"
                      aria-label={`Remover etapa ${item.nome}`}
                      className="ml-1 shrink-0 text-slate-400 hover:text-rose-300 focus-visible:outline-2"
                      disabled={disabled}
                      onClick={(event) => {
                        event.currentTarget.closest("fieldset")?.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus();
                        alternarEtapa(item.id, false);
                      }}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
                {excedente > 0 && <Badge variant="secondary">+{excedente} etapas</Badge>}
              </>
            )}
          </div>

          {faltantes.length > 0 && (
            <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-200">
              A etapa salva não está disponível neste pipeline. Escolha um novo escopo.
            </p>
          )}
          {semSelecao && faltantes.length === 0 && (
            <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-200">
              Selecione ao menos uma etapa.
            </p>
          )}
          {selecionadas.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-9 text-xs text-slate-400"
              disabled={disabled}
              onClick={() => onSelecionadasChange([])}
            >
              Limpar seleção
            </Button>
          )}
        </div>
      )}
    </fieldset>
  );
}
