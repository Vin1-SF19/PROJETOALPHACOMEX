"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { toast } from "sonner";

import {
  ListarCatalogoCardKanban,
  ObterConfiguracaoCardKanban,
  SalvarConfiguracaoCardKanban,
  ObterValoresExemploCardKanban,
} from "@/actions/bpm/CardKanban";
import { ListarCardsPipelineBpm } from "@/actions/bpm/Cards";
import { KanbanCard, type CardBpm } from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient";
import {
  composicaoCardKanbanSemAlteracao,
  elementoCardKanbanChaveEstavel,
  type CardKanbanComposicao,
  type CardKanbanElemento,
} from "@/lib/bpm/card-kanban";
import type { CardKanbanValores } from "@/components/bpm/kanban/CardKanbanRenderer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { etapaEhNovosLeads } from "@/lib/bpm/novos-leads";
import { etapaEhAgendarReuniao } from "@/lib/bpm/agendar-reuniao";

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

/** Usa o mesmo componente do board, com dados reais quando há empresa na etapa. */
function CardKanbanPreview({
  etapaNome,
  accent,
  composicao,
  valores,
  cardExemplo,
  usarLayoutAtual,
}: {
  etapaNome: string;
  accent: string;
  composicao: CardKanbanComposicao;
  valores: CardKanbanValores;
  cardExemplo: CardBpm | null;
  usarLayoutAtual: boolean;
}) {
  const demonstracao: CardBpm = {
    id: "preview-card-demonstrativo", etapaId: "preview", servico: null, status: "ATIVO",
    origem: "real", nolossLeadId: null, createdAt: new Date(), primeiraVisualizacaoEm: new Date(),
    dataReuniao: null, googleMeetLink: null, statusPosFechamento: null,
    empresa: { id: 0, razaoSocial: "Empresa demonstrativa", nomeFantasia: null, cnpj: null },
    responsavel: { id: 0, nome: "Responsável" }, membros: [],
    _count: { tarefas: 0, anexos: 0 }, tarefas: [], podeAgirEtapa: false,
  };
  const cardBase = cardExemplo ?? demonstracao;
  const cardPreview: CardBpm = { ...cardBase,
    cardViewComposicao: usarLayoutAtual ? undefined : composicao,
    cardViewValores: usarLayoutAtual ? undefined : valores };
  return (
    <div className="mx-auto w-full max-w-[260px]" aria-label={`Pré-visualização com ${cardBase.empresa.razaoSocial}`}>
      <DndContext>
        <SortableContext items={[cardPreview.id]} strategy={verticalListSortingStrategy}>
          <div className="pointer-events-none">
            <KanbanCard card={cardPreview} etapaNome={etapaNome} accent={accent}
              novosLeads={etapaEhNovosLeads(etapaNome)} arrastoDesabilitado onAbrir={() => {}} />
          </div>
        </SortableContext>
      </DndContext>
      <p className="mt-2 text-center text-[10px] text-slate-500">
        {cardExemplo ? `Empresa da etapa: ${cardExemplo.empresa.razaoSocial}` : "Empresa demonstrativa"}
      </p>
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
  const [cardExemplo, setCardExemplo] = useState<CardBpm | null>(null);
  const [valoresReais, setValoresReais] = useState<CardKanbanValores | null>(null);

  const etapaAtual = etapas.find((etapa) => etapa.id === etapaId);

  const carregar = useCallback(async () => {
    if (!etapaId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    setCardExemplo(null);
    setValoresReais(null);
    const [catalogoResultado, configuracaoResultado, cardsResultado] = await Promise.all([
      ListarCatalogoCardKanban(pipelineId, etapaId),
      ObterConfiguracaoCardKanban(pipelineId, etapaId),
      ListarCardsPipelineBpm(pipelineId),
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
    if (cardsResultado.success) {
      const exemplo = (cardsResultado.data as CardBpm[]).find((card) => card.etapaId === etapaId && card.origem === "real") ?? null;
      if (exemplo) {
        setCardExemplo(exemplo);
        const valoresResultado = await ObterValoresExemploCardKanban(pipelineId, etapaId, exemplo.id);
        if (valoresResultado.success) {
          setValoresReais({
            nativos: { ...exemplo.cardViewValores?.nativos, ...valoresResultado.data.nativos },
            campos: { ...exemplo.cardViewValores?.campos, ...valoresResultado.data.campos },
            camposLabel: { ...exemplo.cardViewValores?.camposLabel, ...valoresResultado.data.camposLabel },
          });
        }
      }
    }
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
    () => valoresReais ?? valoresDeExemplo(composicao, labelsPorChave),
    [composicao, labelsPorChave, valoresReais],
  );
  const etapaEhSiteLeads = etapaAtual ? etapaEhNovosLeads(etapaAtual.nome) : false;
  const possuiAlteracoes = !composicaoCardKanbanSemAlteracao(composicaoSalva, composicao);
  const podeSalvar = versao === null || possuiAlteracoes;

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

  function usarCamposDoCardAtual() {
    if (!cardExemplo) return;
    const nativos = [
      "EMPRESA_NOME",
      ...(cardExemplo.empresa.nomeFantasia ? ["NOME_FANTASIA"] : []),
      ...(cardExemplo.empresa.cnpj ? ["CNPJ"] : []),
      ...(cardExemplo.servico ? ["SERVICO"] : []),
      ...(etapaAtual && etapaEhAgendarReuniao(etapaAtual.nome) ? ["AGENDAMENTO_REUNIAO"] : []),
      ...(cardExemplo.statusPosFechamento ? ["STATUS_POS_FECHAMENTO"] : []),
      ...(cardExemplo.proximoContatoEm ? ["PROXIMO_CONTATO"] : []),
      ...(cardExemplo.tarefas.some((tarefa) => tarefa.prazo) ? ["PROXIMA_TAREFA"] : []),
      ...(cardExemplo.tarefas.some((tarefa) => tarefa.tipo === "LEMBRETE_RAPIDO") ? ["ANOTACAO_RAPIDA"] : []),
      ...(cardExemplo._count.tarefas > 0 ? ["TAREFAS"] : []),
      ...(cardExemplo._count.anexos > 0 ? ["ANEXOS"] : []),
    ];
    const camposVisiveis = new Set(cardExemplo.campoValores?.filter((item) => item.valor?.trim()).map((item) => item.campo.nome) ?? []);
    setComposicao(catalogo.filter((item) =>
      item.elemento.kind === "NATIVE"
        ? nativos.includes(item.elemento.key)
        : camposVisiveis.has(item.label),
    ).map((item) => item.elemento));
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
              {versao === null && <p className="mt-2 text-xs text-amber-200">Esta etapa ainda usa o layout anterior. Escolha os campos e salve para aplicar a composição a todos os cards, inclusive os existentes. Também é possível salvar uma composição vazia.</p>}
              {versao === null && cardExemplo && composicao.length === 0 && (
                <button type="button" onClick={usarCamposDoCardAtual}
                  className="mt-2 rounded-lg border border-cyan-400/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10">
                  Começar com os dados deste card
                </button>
              )}
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
                disabled={!podeSalvar || salvando}
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
              cardExemplo={cardExemplo}
              usarLayoutAtual={versao === null && !possuiAlteracoes}
            />
            {!cardExemplo && <p className="mt-3 text-center text-xs text-slate-400">Ainda não há empresa cadastrada nesta etapa; a prévia usa dados demonstrativos.</p>}
          </section>
        </div>
      )}
    </div>
  );
}
