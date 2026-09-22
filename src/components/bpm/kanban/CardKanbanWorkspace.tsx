"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, RotateCcw, Save, Trash2, Video } from "lucide-react";
import { toast } from "sonner";

import {
  ListarCatalogoCardKanban,
  ObterConfiguracaoCardKanban,
  SalvarConfiguracaoCardKanban,
} from "@/actions/bpm/CardKanban";
import {
  composicaoCardKanbanSemAlteracao,
  elementoCardKanbanChaveEstavel,
  type CardKanbanComposicao,
  type CardKanbanElemento,
} from "@/lib/bpm/card-kanban";
import { CardKanbanRenderer, type CardKanbanValores } from "@/components/bpm/kanban/CardKanbanRenderer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GradientBlobCard } from "@/components/ui/gradient-blob-card";
import { etapaEhNovosLeads } from "@/lib/bpm/novos-leads";

type CatalogoItem = { chave: string; label: string; elemento: CardKanbanElemento };
type EtapaCardKanban = { id: string; nome: string; cor?: string | null };

function catalogoParaOpcoes(
  nativos: { key: string; label: string }[],
  campos: { campoId: string; label: string }[],
): CatalogoItem[] {
  return [
    ...nativos.map((nativo) => ({
      chave: `native:${nativo.key}`,
      label: nativo.label,
      elemento: { kind: "NATIVE" as const, key: nativo.key as never },
    })),
    ...campos.map((campo) => ({
      chave: `campo:${campo.campoId}`,
      label: campo.label,
      elemento: { kind: "CAMPO" as const, campoId: campo.campoId },
    })),
  ];
}

function valoresDeExemplo(composicao: CardKanbanComposicao, labelsPorChave: Map<string, string>): CardKanbanValores {
  const nativos: CardKanbanValores["nativos"] = {};
  const campos: CardKanbanValores["campos"] = {};
  const camposLabel: CardKanbanValores["camposLabel"] = {};
  for (const elemento of composicao) {
    if (elemento.kind === "NATIVE") {
      nativos[elemento.key] = { status: "ok", valor: "Exemplo" };
    } else {
      campos[elemento.campoId] = { status: "ok", valor: "Exemplo" };
      camposLabel[elemento.campoId] = labelsPorChave.get(`campo:${elemento.campoId}`) ?? "Campo";
    }
  }
  return { nativos, campos, camposLabel };
}

/**
 * Espelha o shell visual do card real do board (GradientBlobCard + composição)
 * para que a pré-visualização mostre exatamente o que vai aparecer no
 * pipeline, incluindo o widget de Agendar Reunião quando ele estiver na
 * composição (substitui o corpo padrão do card, igual ao board real).
 */
function CardKanbanPreview({
  etapaNome,
  accent,
  composicao,
  valores,
}: {
  etapaNome: string;
  accent: string;
  composicao: CardKanbanComposicao;
  valores: CardKanbanValores;
}) {
  const agendarReuniao = composicao.some(
    (elemento) => elemento.kind === "NATIVE" && elemento.key === "AGENDAMENTO_REUNIAO",
  );
  return (
    <div className="mx-auto w-full max-w-xs">
      <GradientBlobCard accent={accent}>
        <div className="space-y-2.5">
          {agendarReuniao ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="font-medium">Data e hora</span>
                <span className="ml-auto tabular-nums text-slate-200">Não definida</span>
              </div>
              <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200">
                <Video size={14} aria-hidden="true" />
                Agendar pelo Google Meet
              </div>
              <CardKanbanRenderer composicao={composicao} valores={valores} />
            </div>
          ) : (
            <>
              {composicao.length > 0 ? (
                <CardKanbanRenderer composicao={composicao} valores={valores} />
              ) : (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-center text-[11px] text-slate-500">
                  Nenhum campo configurado — o card mostra só os controles estruturais.
                </p>
              )}
            </>
          )}
          <div className="flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[10px] text-slate-500">
            <span>Sem pendências</span>
            <span className="size-5 rounded-full border border-white/10 bg-white/[0.05]" aria-hidden="true" />
          </div>
        </div>
      </GradientBlobCard>
      <p className="mt-2 text-center text-[10px] text-slate-500">Etapa: {etapaNome}</p>
    </div>
  );
}

export function CardKanbanWorkspace({
  pipelineId,
  etapas,
  accent = "34, 211, 238",
}: {
  pipelineId: string;
  etapas: EtapaCardKanban[];
  accent?: string;
}) {
  const [etapaId, setEtapaId] = useState(etapas[0]?.id ?? "");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [composicao, setComposicao] = useState<CardKanbanComposicao>([]);
  const [composicaoSalva, setComposicaoSalva] = useState<CardKanbanComposicao>([]);
  const [versao, setVersao] = useState<number | null>(null);
  const [selecaoParaAdicionar, setSelecaoParaAdicionar] = useState<string>("");

  const etapaAtual = etapas.find((etapa) => etapa.id === etapaId);

  const carregar = useCallback(async () => {
    if (!etapaId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    const [catalogoResultado, configuracaoResultado] = await Promise.all([
      ListarCatalogoCardKanban(pipelineId, etapaId),
      ObterConfiguracaoCardKanban(pipelineId, etapaId),
    ]);
    if (!catalogoResultado.success) {
      setErro(catalogoResultado.error);
      setCarregando(false);
      return;
    }
    if (!configuracaoResultado.success) {
      setErro(configuracaoResultado.error);
      setCarregando(false);
      return;
    }
    setCatalogo(catalogoParaOpcoes(catalogoResultado.data.nativos, catalogoResultado.data.campos));
    setComposicao(configuracaoResultado.data.composicao);
    setComposicaoSalva(configuracaoResultado.data.composicao);
    setVersao(configuracaoResultado.data.versao);
    setCarregando(false);
  }, [pipelineId, etapaId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial da composição ao trocar de etapa
    void carregar();
  }, [carregar]);

  const labelsPorChave = useMemo(() => new Map(catalogo.map((item) => [item.chave, item.label])), [catalogo]);
  const chavesEmUso = useMemo(
    () => new Set(composicao.map((elemento) => elementoCardKanbanChaveEstavel(elemento))),
    [composicao],
  );
  const opcoesDisponiveis = useMemo(
    () => catalogo.filter((item) => !chavesEmUso.has(item.chave)),
    [catalogo, chavesEmUso],
  );
  const valoresPreview = useMemo(
    () => valoresDeExemplo(composicao, labelsPorChave),
    [composicao, labelsPorChave],
  );
  const etapaEhSiteLeads = etapaAtual ? etapaEhNovosLeads(etapaAtual.nome) : false;
  const possuiAlteracoes = !composicaoCardKanbanSemAlteracao(composicaoSalva, composicao);

  function selecionarEtapa(novoEtapaId: string) {
    if (novoEtapaId === etapaId) return;
    if (possuiAlteracoes) {
      toast.error("Salve ou descarte as alterações antes de trocar de etapa.");
      return;
    }
    setSelecaoParaAdicionar("");
    setEtapaId(novoEtapaId);
  }

  function descartarAlteracoes() {
    setComposicao(composicaoSalva);
    setSelecaoParaAdicionar("");
  }

  function moverItem(indice: number, direcao: -1 | 1) {
    setComposicao((atual) => {
      const destino = indice + direcao;
      if (destino < 0 || destino >= atual.length) return atual;
      const proximo = [...atual];
      [proximo[indice], proximo[destino]] = [proximo[destino], proximo[indice]];
      return proximo;
    });
  }

  function removerItem(indice: number) {
    setComposicao((atual) => atual.filter((_, i) => i !== indice));
  }

  function adicionarItem() {
    const item = catalogo.find((candidato) => candidato.chave === selecaoParaAdicionar);
    if (!item) return;
    setComposicao((atual) => [...atual, item.elemento]);
    setSelecaoParaAdicionar("");
  }

  async function salvar() {
    setSalvando(true);
    try {
      const resultado = await SalvarConfiguracaoCardKanban({
        pipelineId,
        etapaId,
        versaoEsperada: versao,
        composicao,
      });
      if (!resultado.success) {
        const mensagem = typeof resultado.error === "string" ? resultado.error : "Payload inválido";
        toast.error(mensagem);
        if (mensagem.startsWith("CONFLITO_VERSAO_CARD_KANBAN")) await carregar();
        return;
      }
      setVersao(resultado.data.versao);
      setComposicao(resultado.data.composicao);
      setComposicaoSalva(resultado.data.composicao);
      toast.success(
        resultado.data.alterado ? "Composição do card salva." : "Nenhuma alteração para salvar.",
      );
    } catch {
      toast.error("Não foi possível salvar a composição do card.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Select value={etapaId} onValueChange={selecionarEtapa} disabled={carregando || salvando}>
        <SelectTrigger className="h-9 w-full max-w-sm text-sm">
          <SelectValue placeholder="Selecione a etapa" />
        </SelectTrigger>
        <SelectContent>
          {etapas.map((etapa) => (
            <SelectItem key={etapa.id} value={etapa.id}>
              {etapa.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!etapaAtual ? (
        <p className="text-sm text-slate-400">Nenhuma etapa disponível para configurar o card.</p>
      ) : carregando ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
          <Loader2 className="animate-spin" size={16} aria-hidden="true" />
          Carregando composição do card…
        </div>
      ) : erro ? (
        <p className="py-8 text-sm text-red-300">{erro}</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(280px,1fr)_minmax(300px,0.85fr)]">
          <section className="min-w-0 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Card do Kanban — {etapaAtual.nome}</h3>
              <p className="mt-1 text-xs text-slate-400">
                Escolha e ordene os campos exibidos no card fechado desta etapa. Sem seleção, o card mostra
                apenas os controles estruturais (abertura, arrasto, tarefas e anexos).
              </p>
              {etapaEhSiteLeads && (
                <p className="mt-2 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-3 py-2 text-[11px] text-sky-200">
                  Esta é a etapa que recebe leads do site antes de virarem card real. A mesma composição
                  é aplicada a eles — mas só os campos com dado disponível para um lead ainda não promovido
                  aparecem (ex.: nome e telefone). Campos comerciais (CNPJ, campos personalizados) ficam
                  ocultos até a promoção.
                </p>
              )}
            </div>

            <div className="space-y-2">
              {composicao.length === 0 && (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">
                  Nenhum campo configurado para esta etapa.
                </p>
              )}
              {composicao.map((elemento, indice) => {
                const chave = elementoCardKanbanChaveEstavel(elemento);
                const label = labelsPorChave.get(chave) ?? chave;
                return (
                  <div
                    key={chave}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                  >
                    <span className="flex-1 text-sm text-slate-200">{label}</span>
                    <button
                      type="button"
                      onClick={() => moverItem(indice, -1)}
                      disabled={indice === 0}
                      className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                      aria-label={`Mover ${label} para cima`}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moverItem(indice, 1)}
                      disabled={indice === composicao.length - 1}
                      className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                      aria-label={`Mover ${label} para baixo`}
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removerItem(indice)}
                      className="rounded-lg p-1 text-red-300 hover:bg-red-500/10"
                      aria-label={`Remover ${label}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <Select value={selecaoParaAdicionar} onValueChange={setSelecaoParaAdicionar}>
                <SelectTrigger className="h-9 flex-1 text-sm">
                  <SelectValue placeholder="Adicionar campo…" />
                </SelectTrigger>
                <SelectContent>
                  {opcoesDisponiveis.map((item) => (
                    <SelectItem key={item.chave} value={item.chave}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={adicionarItem}
                disabled={!selecaoParaAdicionar}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40"
              >
                <Plus size={14} aria-hidden="true" />
                Adicionar
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={descartarAlteracoes}
                disabled={!possuiAlteracoes || salvando}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.05] disabled:opacity-40"
              >
                <RotateCcw size={16} aria-hidden="true" />
                Descartar alterações
              </button>
              <button
                type="button"
                onClick={() => void salvar()}
                disabled={!possuiAlteracoes || salvando}
                className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
              >
                {salvando ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Salvar composição
              </button>
              {possuiAlteracoes && (
                <span className="text-xs text-amber-200" role="status">Alterações não salvas</span>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.08),transparent_55%)] p-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Pré-visualização — como vai ficar no pipeline
            </p>
            <CardKanbanPreview
              etapaNome={etapaAtual.nome}
              accent={accent}
              composicao={composicao}
              valores={valoresPreview}
            />
          </section>
        </div>
      )}
    </div>
  );
}
