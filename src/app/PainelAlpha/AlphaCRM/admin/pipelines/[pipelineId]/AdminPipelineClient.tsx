"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Bot,
  Check,
  CircleDot,
  Clock3,
  Columns3,
  FileText,
  GitBranch,
  GripVertical,
  LayoutDashboard,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import { PublicarConfiguracaoPipelineBpm } from "@/actions/bpm/ConfiguracaoPipeline";
import type { TemaAlpha } from "@/lib/temas";
import {
  FINANCIAL_PIPELINE_NAME,
  hasConfiguredFinancialPipeline,
} from "@/lib/bpm/pipeline-financeiro";
import { ConfigurarEtapasFinanceiroButton } from "./ConfigurarEtapasFinanceiroButton";
import { VisibilidadeEtapasSection } from "./VisibilidadeEtapasSection";
import {
  EtapaAvancadaSection,
  type SubStatusBpm,
  type TransicaoBpm,
} from "./EtapaAvancadaSection";
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
import { Switch } from "@/components/ui/switch";
import type { SlaConfiguracaoAdmin } from "@/lib/validations/bpm-sla";
import { SlaConfigSection } from "./SlaConfigSection";
import { CadenciaEtapasSection } from "./CadenciaEtapasSection";
import type { CadenciaView } from "@/components/bpm/cadencias/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  FormularioEtapaWorkspace,
  type FormularioEtapaAdmin,
} from "./FormularioEtapaWorkspace";
import {
  AutomationsOverview,
  KanbanCardPreview,
  PipelineHealthOverview,
  PipelineHistory,
  TransitionMatrix,
  type AuditoriaWorkspace,
  type AutomacaoWorkspace,
} from "./PipelineWorkspaceSections";

interface EtapaBpm {
  id: string;
  chave?: string | null;
  nome: string;
  ordem: number;
  cor: string | null;
  ativo: boolean;
  ehInicial: boolean;
  ehFinal: boolean;
  capabilitiesJson?: string | null;
  subStatus: SubStatusBpm[];
  formulario?: FormularioEtapaAdmin | null;
  automacoes?: AutomacaoWorkspace[];
}

interface CampoBpm {
  id: string;
  pipelineId: string;
  chave?: string | null;
  etapaId: string | null;
  nome: string;
  tipo: string;
  opcoesJson: string | null;
  obrigatorio: boolean;
  ordem: number;
  ativo?: boolean;
  escopo?: string;
  valorPadrao?: string | null;
  fonteEntidade?: string | null;
  fonteAtributo?: string | null;
  entidadeGlobal?: string | null;
  visivel?: boolean;
  editavel?: boolean;
  somenteLeitura?: boolean;
  pipeline?: { id: string; nome: string };
  pipelinesAssociados?: {
    pipelineId: string;
    pipeline?: { id: string; nome: string };
  }[];
  etapaConfiguracoes?: Array<
    ConfigEtapaCampo & {
      etapa?: { id: string; nome: string; pipelineId: string };
    }
  >;
  acessos?: {
    perfil: string;
    visivel: boolean;
    editavel: boolean;
    somenteLeitura: boolean;
    obrigatorio: boolean;
  }[];
  opcoes?: {
    id: string;
    chave: string;
    rotulo: string;
    ordem: number;
    ativo: boolean;
  }[];
  mapeamentoDestino?: {
    campoOrigemId: string;
    modo: string;
    ativo: boolean;
  } | null;
}

type ConfigEtapaCampo = {
  etapaId: string;
  visivel: boolean;
  editavel: boolean;
  somenteLeitura: boolean;
  obrigatorio: boolean;
  obrigatorioEntrada: boolean;
  obrigatorioSaida: boolean;
  ordem: number;
  grupo?: string | null;
  valorPadrao?: string | null;
  condicaoVisibilidadeJson?: string | null;
  condicaoObrigatoriedadeJson?: string | null;
};

interface PipelineBpm {
  id: string;
  nome: string;
  ativo?: boolean;
  configVersion: number;
  updatedAt: string | Date;
  etapas: EtapaBpm[];
  campos: CampoBpm[];
  automacoesGlobais?: AutomacaoWorkspace[];
  configAuditoria?: AuditoriaWorkspace[];
}

const inputCls =
  "bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20";

export default function AdminPipelineClient({
  pipeline,
  transicoesIniciais,
  configuracoesSlaIniciais,
  servicosComerciais,
  cadenciasIniciais,
  visual,
}: {
  pipeline: PipelineBpm;
  transicoesIniciais: TransicaoBpm[];
  configuracoesSlaIniciais: SlaConfiguracaoAdmin[];
  servicosComerciais: { id: number; nome: string }[];
  cadenciasIniciais: CadenciaView[];
  visual: TemaAlpha;
}) {
  const accent = visual.accent;
  const router = useRouter();
  const etapasIniciais = pipeline.etapas
    .slice()
    .sort((a, b) => a.ordem - b.ordem);
  const [etapas, setEtapas] = useState(etapasIniciais);
  const [etapasConfirmadas, setEtapasConfirmadas] = useState(etapasIniciais);
  const campos = pipeline.campos;
  const [transicoes, setTransicoes] = useState(transicoesIniciais);
  const [transicoesConfirmadas, setTransicoesConfirmadas] =
    useState(transicoesIniciais);
  const [baseVersion, setBaseVersion] = useState(pipeline.configVersion);
  const [conflitoPublicacao, setConflitoPublicacao] = useState(false);
  const [novaEtapaNome, setNovaEtapaNome] = useState("");
  const [abaAtiva, setAbaAtiva] = useState("overview");
  const [etapaSelecionadaId, setEtapaSelecionadaId] = useState<string | null>(
    null,
  );
  const [erro, setErro] = useState<string | null>(null);
  const [operacao, setOperacao] = useState<string | null>(null);
  const etapaSelecionada =
    etapas.find((etapa) => etapa.id === etapaSelecionadaId) ?? null;
  const etapaConfirmadaSelecionada =
    etapasConfirmadas.find((etapa) => etapa.id === etapaSelecionadaId) ?? null;
  const etapasComRascunho = etapas.filter((etapa) => {
    const confirmada = etapasConfirmadas.find((item) => item.id === etapa.id);
    return (
      !confirmada ||
      Boolean(
        etapa.nome !== confirmada.nome ||
        etapa.cor !== confirmada.cor ||
        etapa.ordem !== confirmada.ordem ||
        etapa.ativo !== confirmada.ativo ||
        etapa.ehInicial !== confirmada.ehInicial ||
        etapa.ehFinal !== confirmada.ehFinal,
      )
    );
  });
  const etapaComRascunho = Boolean(
    etapaSelecionada &&
    etapasComRascunho.some((item) => item.id === etapaSelecionada.id),
  );
  const transicoesComRascunho = transicoes.filter((transicao) => {
    const confirmada = transicoesConfirmadas.find(
      (item) => item.id === transicao.id,
    );
    return (
      !confirmada ||
      confirmada.permitida !== transicao.permitida ||
      confirmada.origem !== transicao.origem
    );
  });
  const alteracoesPendentes =
    etapasComRascunho.length + transicoesComRascunho.length;
  const automacoes = useMemo(() => {
    const unicas = new Map<string, AutomacaoWorkspace>();
    for (const automacao of pipeline.automacoesGlobais ?? [])
      unicas.set(automacao.id, automacao);
    for (const etapa of etapas)
      for (const automacao of etapa.automacoes ?? [])
        unicas.set(automacao.id, automacao);
    return [...unicas.values()];
  }, [etapas, pipeline.automacoesGlobais]);

  function descartarAlteracoes() {
    setEtapas(etapasConfirmadas);
    setTransicoes(transicoesConfirmadas);
    setConflitoPublicacao(false);
    setErro(null);
  }

  async function publicarConfiguracaoVersionada() {
    if (operacao || alteracoesPendentes === 0) return;
    setOperacao("publicar-configuracao");
    setConflitoPublicacao(false);
    setErro(null);
    const resultado = await PublicarConfiguracaoPipelineBpm({
      pipelineId: pipeline.id,
      baseVersion,
      etapas: etapas.map(
        ({ id, nome, cor, ordem, ativo, ehInicial, ehFinal }) => ({
          id,
          nome,
          cor,
          ordem,
          ativo,
          ehInicial,
          ehFinal,
        }),
      ),
      transicoes: transicoes.map(
        ({ id, etapaOrigemId, etapaDestinoId, permitida, origem }) => ({
          id,
          etapaOrigemId,
          etapaDestinoId,
          permitida,
          origem,
        }),
      ),
      campos: campos.map(({ id, ativo }) => ({ id, ativo: ativo !== false })),
    });
    setOperacao(null);
    if (resultado.success) {
      setBaseVersion(resultado.data.configVersion);
      setEtapasConfirmadas(etapas);
      setTransicoesConfirmadas(transicoes);
      toast.success("Configuração publicada, versionada e auditada");
      router.refresh();
      return;
    }
    if ("conflict" in resultado && resultado.conflict)
      setConflitoPublicacao(true);
    setErro(
      Array.isArray(resultado.error)
        ? resultado.error.join(" ")
        : typeof resultado.error === "string"
          ? resultado.error
          : "Erro ao publicar configuração",
    );
  }

  function publicarAlteracoes() {
    void publicarConfiguracaoVersionada();
  }

  function handleCriarEtapa() {
    if (!novaEtapaNome.trim() || operacao) return;
    setErro(null);
    const id = `draft-stage-${crypto.randomUUID()}`;
    const nova: EtapaBpm = {
      id,
      nome: novaEtapaNome.trim(),
      ordem: etapas.length,
      cor: null,
      ativo: true,
      ehInicial: false,
      ehFinal: false,
      subStatus: [],
      formulario: null,
    };
    const bloqueadas: TransicaoBpm[] = etapas.flatMap((etapa) => [
      {
        id: `draft-${crypto.randomUUID()}`,
        etapaOrigemId: id,
        etapaDestinoId: etapa.id,
        permitida: false,
        origem: "AMBOS",
      },
      {
        id: `draft-${crypto.randomUUID()}`,
        etapaOrigemId: etapa.id,
        etapaDestinoId: id,
        permitida: false,
        origem: "AMBOS",
      },
    ]);
    setEtapas((prev) => [...prev, nova]);
    setTransicoes((prev) => [...prev, ...bloqueadas]);
    setNovaEtapaNome("");
    setConflitoPublicacao(false);
    toast.success("Etapa adicionada ao rascunho; configure o fluxo e publique");
  }

  function descartarEtapa() {
    if (!etapaConfirmadaSelecionada) return;
    setEtapas((prev) =>
      prev.map((etapa) =>
        etapa.id === etapaConfirmadaSelecionada.id
          ? etapaConfirmadaSelecionada
          : etapa,
      ),
    );
  }

  function handleMoverEtapa(index: number, direcao: -1 | 1) {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= etapas.length || operacao) return;

    const reordenadas = etapas.slice();
    [reordenadas[index], reordenadas[novoIndex]] = [
      reordenadas[novoIndex],
      reordenadas[index],
    ];
    const comOrdemAtualizada = reordenadas.map((e, i) => ({ ...e, ordem: i }));
    setEtapas(comOrdemAtualizada);
    setConflitoPublicacao(false);
    toast.success("Nova ordem adicionada ao rascunho");
  }

  function handleToggleAtivoEtapa(etapaId: string, ativo: boolean) {
    if (operacao) return;
    setEtapas((prev) =>
      prev.map((e) => (e.id === etapaId ? { ...e, ativo } : e)),
    );
    setConflitoPublicacao(false);
    toast.success("Alteração adicionada ao rascunho");
  }

  function handleEtapasAtualizadas(patch: Record<string, Partial<EtapaBpm>>) {
    setEtapas((prev) =>
      prev.map((e) => (patch[e.id] ? { ...e, ...patch[e.id] } : e)),
    );
  }

  function handleSubStatusAtualizado(sub: SubStatusBpm) {
    const atualizar = (prev: EtapaBpm[]) =>
      prev.map((e) => {
        if (e.id !== sub.etapaId) return e;
        const existe = e.subStatus.some((s) => s.id === sub.id);
        return {
          ...e,
          subStatus: existe
            ? e.subStatus.map((s) => (s.id === sub.id ? sub : s))
            : [...e.subStatus, sub],
        };
      });
    setEtapas(atualizar);
    setEtapasConfirmadas(atualizar);
  }

  function handleTransicaoAtualizada(transicao: TransicaoBpm) {
    setTransicoes((prev) => {
      const existe = prev.some((t) => t.id === transicao.id);
      return existe
        ? prev.map((t) => (t.id === transicao.id ? transicao : t))
        : [...prev, transicao];
    });
  }

  function handleFormularioAtualizado(
    etapaId: string,
    formulario: FormularioEtapaAdmin,
  ) {
    const atualizar = (atuais: EtapaBpm[]) =>
      atuais.map((etapa) =>
        etapa.id === etapaId ? { ...etapa, formulario } : etapa,
      );
    setEtapas(atualizar);
    setEtapasConfirmadas(atualizar);
  }

  function navegarPara(aba: string, etapaId?: string) {
    setAbaAtiva(aba);
    if (etapaId) setEtapaSelecionadaId(etapaId);
  }

  function abrirEtapa(etapaId: string) {
    setEtapaSelecionadaId(etapaId);
  }

  return (
    <div className="min-w-0 space-y-5 p-4 sm:p-6 xl:p-8">
      <header className="-mx-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-slate-950/90 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Pipeline Comercial
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-black text-white">
              {pipeline.nome}
            </h1>
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-bold ${pipeline.ativo === false ? "bg-slate-700 text-slate-300" : "bg-emerald-400/10 text-emerald-200"}`}
            >
              {pipeline.ativo === false ? "Inativo" : "Ativo"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Rascunho principal: etapas e fluxo
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-600">
            Versão de configuração {baseVersion}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            role="status"
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold ${erro || conflitoPublicacao ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : operacao ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" : alteracoesPendentes ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200"}`}
          >
            {operacao ? (
              <Loader2 size={14} className="animate-spin" />
            ) : alteracoesPendentes ? (
              <CircleDot size={14} />
            ) : (
              <Check size={14} />
            )}
            {conflitoPublicacao
              ? "Conflito — recarregue"
              : erro
                ? "Erro ao publicar"
                : operacao
                  ? "Publicando…"
                  : alteracoesPendentes
                    ? `${alteracoesPendentes} alteração(ões) no rascunho principal`
                    : "Publicado"}
          </span>
          <button
            type="button"
            disabled={!alteracoesPendentes || Boolean(operacao)}
            onClick={descartarAlteracoes}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold text-slate-300 hover:bg-white/5 disabled:opacity-35"
          >
            <X size={14} /> Descartar alterações
          </button>
          <button
            type="button"
            disabled={!alteracoesPendentes || Boolean(operacao)}
            onClick={publicarAlteracoes}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-white disabled:opacity-35"
            style={{ background: `rgba(${accent},0.85)` }}
          >
            <Save size={14} /> Publicar rascunho principal
          </button>
        </div>
      </header>

      {erro && (
        <div
          role="alert"
          className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
        >
          {erro}
        </div>
      )}
      {conflitoPublicacao && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
        >
          <span>
            A configuração mudou desde que este workspace foi aberto. Recarregue
            para evitar sobrescrever trabalho de outro administrador.
          </span>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="min-h-9 rounded-lg border border-rose-200/20 px-3 text-xs font-bold"
          >
            Recarregar configuração
          </button>
        </div>
      )}

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="gap-5">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max gap-1 p-1.5">
            <TabsTrigger value="overview">
              <LayoutDashboard size={14} /> Visão geral
            </TabsTrigger>
            <TabsTrigger value="stages">
              <GitBranch size={14} /> Etapas e fluxo
            </TabsTrigger>
            <TabsTrigger value="fields">
              <FileText size={14} /> Campos e formulários
            </TabsTrigger>
            <TabsTrigger value="card">
              <Columns3 size={14} /> Card do Kanban
            </TabsTrigger>
            <TabsTrigger value="sla">
              <Clock3 size={14} /> SLA
            </TabsTrigger>
            <TabsTrigger value="automations">
              <Bot size={14} /> Automações
            </TabsTrigger>
            <TabsTrigger value="permissions">
              <ShieldCheck size={14} /> Permissões
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock3 size={14} /> Histórico
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <PipelineHealthOverview
            etapas={etapas}
            campos={campos}
            transicoes={transicoes}
            slas={configuracoesSlaIniciais}
            automacoes={automacoes}
            onNavigate={navegarPara}
          />
          {pipeline.nome === FINANCIAL_PIPELINE_NAME &&
            (hasConfiguredFinancialPipeline(etapas, campos) ? (
              <div
                className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
                role="status"
              >
                Pipeline Financeiro configurado com as cinco etapas e campos
                oficiais.
              </div>
            ) : (
              <ConfigurarEtapasFinanceiroButton
                pipelineId={pipeline.id}
                accent={accent}
                onConfigured={() => router.refresh()}
              />
            ))}
        </TabsContent>

        <TabsContent value="stages" className="space-y-4">
          <div className="grid gap-4 2xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-white/10 bg-slate-900/35 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-white">Etapas</h2>
                  <p className="text-xs text-slate-500">
                    Selecione para editar
                  </p>
                </div>
                <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-slate-400">
                  {etapas.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {etapas.map((etapa, i) => {
                  const quantidadeCampos = campos.filter((campo) =>
                    campo.etapaConfiguracoes?.some(
                      (config) => config.etapaId === etapa.id,
                    ),
                  ).length;
                  const quantidadeTransicoes = transicoes.filter(
                    (transicao) =>
                      transicao.etapaOrigemId === etapa.id &&
                      transicao.permitida,
                  ).length;
                  const quantidadeSla = configuracoesSlaIniciais.filter(
                    (sla) => sla.etapaId === etapa.id && sla.ativa,
                  ).length;
                  return (
                    <div
                      key={etapa.id}
                      className={`group flex items-center gap-2 rounded-xl border px-2 py-2 ${etapaSelecionadaId === etapa.id ? "border-cyan-400/30 bg-cyan-400/[0.07]" : "border-transparent bg-slate-950/35 hover:border-white/10"}`}
                    >
                      <GripVertical size={14} className="text-slate-600" />
                      <button
                        type="button"
                        onClick={() => abrirEtapa(etapa.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="flex items-center gap-2">
                          <i
                            className="size-2.5 rounded-full"
                            style={{ background: etapa.cor ?? "#64748b" }}
                          />
                          <strong className="truncate text-sm text-slate-100">
                            {etapa.nome}
                          </strong>
                          {!etapa.ativo && (
                            <span className="text-[9px] text-slate-600">
                              INATIVA
                            </span>
                          )}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1 text-[9px] text-slate-500">
                          {etapa.ehInicial && (
                            <em className="not-italic text-emerald-300">
                              Inicial
                            </em>
                          )}
                          {etapa.ehFinal && (
                            <em className="not-italic text-rose-300">Final</em>
                          )}
                          {!etapa.ehInicial && !etapa.ehFinal && (
                            <em className="not-italic">Intermediária</em>
                          )}
                          <span>· {quantidadeCampos} campos</span>
                          <span>· {quantidadeTransicoes} saídas</span>
                          {quantidadeSla > 0 && (
                            <span>· {quantidadeSla} SLA</span>
                          )}
                        </span>
                      </button>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          aria-label={`Mover ${etapa.nome} para cima`}
                          onClick={() => void handleMoverEtapa(i, -1)}
                          disabled={
                            i === 0 || Boolean(operacao) || etapaComRascunho
                          }
                          className="px-1 text-xs text-slate-500 hover:text-white disabled:opacity-25"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Mover ${etapa.nome} para baixo`}
                          onClick={() => void handleMoverEtapa(i, 1)}
                          disabled={
                            i === etapas.length - 1 ||
                            Boolean(operacao) ||
                            etapaComRascunho
                          }
                          className="px-1 text-xs text-slate-500 hover:text-white disabled:opacity-25"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="min-w-0 space-y-3">
              <div>
                <h2 className="font-bold text-white">Matriz de transições</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Clique numa origem para abrir suas regras. Ausência permanece
                  bloqueada no runtime.
                </p>
              </div>
              <TransitionMatrix
                etapas={etapas}
                transicoes={transicoes}
                onSelectEtapa={abrirEtapa}
              />
            </section>
          </div>
          <div className="flex max-w-xl gap-2 rounded-2xl border border-white/10 bg-slate-900/35 p-3">
            <input
              className={`${inputCls} flex-1`}
              placeholder="Nome da nova etapa"
              value={novaEtapaNome}
              disabled={Boolean(operacao)}
              onChange={(e) => setNovaEtapaNome(e.target.value)}
            />
            <button
              onClick={handleCriarEtapa}
              disabled={Boolean(operacao) || !novaEtapaNome.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: `rgba(${accent},0.85)` }}
            >
              {operacao === "criar-etapa" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}{" "}
              Adicionar
            </button>
          </div>
          <Sheet
            open={Boolean(etapaSelecionada)}
            onOpenChange={(aberto) => {
              if (!aberto) {
                descartarEtapa();
                setEtapaSelecionadaId(null);
              }
            }}
          >
            <SheetContent
              side="right"
              className="w-full overflow-y-auto sm:max-w-2xl"
            >
              {etapaSelecionada && (
                <>
                  <SheetHeader className="border-b border-white/10">
                    <SheetTitle>
                      Editar etapa — {etapaSelecionada.nome}
                    </SheetTitle>
                    <SheetDescription>
                      Geral, workflow, substatus e transições explícitas.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="space-y-6 px-5 pb-8">
                    <section className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        Geral
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-[80px_minmax(0,1fr)]">
                        <label className="space-y-1 text-xs text-slate-400">
                          <span>Cor</span>
                          <input
                            type="color"
                            value={etapaSelecionada.cor ?? "#64748b"}
                            onChange={(event) =>
                              setEtapas((atuais) =>
                                atuais.map((item) =>
                                  item.id === etapaSelecionada.id
                                    ? { ...item, cor: event.target.value }
                                    : item,
                                ),
                              )
                            }
                            className="h-10 w-full rounded-lg border border-white/10 bg-transparent"
                          />
                        </label>
                        <label className="space-y-1 text-xs text-slate-400">
                          <span>Nome</span>
                          <input
                            value={etapaSelecionada.nome}
                            onChange={(event) =>
                              setEtapas((atuais) =>
                                atuais.map((item) =>
                                  item.id === etapaSelecionada.id
                                    ? { ...item, nome: event.target.value }
                                    : item,
                                ),
                              )
                            }
                            className={`${inputCls} h-10 w-full`}
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 p-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">
                            Etapa {etapaSelecionada.ativo ? "ativa" : "inativa"}
                          </p>
                          <p className="text-xs text-slate-500">
                            Cards existentes não são movidos ao desativar.
                          </p>
                        </div>
                        {etapaSelecionada.ativo ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button type="button" className="inline-flex">
                                <Switch checked size="sm" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Desativar etapa
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Desativar &quot;{etapaSelecionada.nome}&quot;
                                  a oculta do board e das novas entradas. Cards
                                  existentes permanecem nela.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    void handleToggleAtivoEtapa(
                                      etapaSelecionada.id,
                                      false,
                                    )
                                  }
                                >
                                  Desativar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              void handleToggleAtivoEtapa(
                                etapaSelecionada.id,
                                true,
                              )
                            }
                          >
                            <Switch checked={false} size="sm" />
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!etapaComRascunho || Boolean(operacao)}
                          onClick={descartarEtapa}
                          className="min-h-10 rounded-xl border border-white/10 px-3 text-xs font-bold text-slate-300 disabled:opacity-35"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={!etapaComRascunho || Boolean(operacao)}
                          onClick={() => setEtapaSelecionadaId(null)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-400 px-3 text-xs font-bold text-slate-950 disabled:opacity-35"
                        >
                          <Save size={14} /> Manter no rascunho
                        </button>
                      </div>
                    </section>
                    <div className="border-t border-white/10 pt-5">
                      <EtapaAvancadaSection
                        pipelineId={pipeline.id}
                        etapa={etapaSelecionada}
                        todasEtapas={etapas}
                        subStatus={etapaSelecionada.subStatus}
                        transicoes={transicoes}
                        accent={accent}
                        onEtapasAtualizadas={handleEtapasAtualizadas}
                        onSubStatusAtualizado={handleSubStatusAtualizado}
                        onTransicaoAtualizada={handleTransicaoAtualizada}
                        publicationBlocked={alteracoesPendentes > 0}
                        onPublished={() => router.refresh()}
                      />
                    </div>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
        </TabsContent>

        <TabsContent value="permissions">
          <VisibilidadeEtapasSection
            pipelineId={pipeline.id}
            etapas={etapas}
            accent={accent}
            publicationBlocked={alteracoesPendentes > 0}
            onPublished={() => router.refresh()}
          />
        </TabsContent>

        <TabsContent value="sla">
          <SlaConfigSection
            pipelineId={pipeline.id}
            pipelineNome={pipeline.nome}
            etapas={etapas}
            servicos={servicosComerciais}
            configuracoesIniciais={configuracoesSlaIniciais}
            publicationBlocked={alteracoesPendentes > 0}
            onPublished={() => router.refresh()}
          />
        </TabsContent>

        <TabsContent value="automations" className="space-y-7">
          <AutomationsOverview automacoes={automacoes} />
          <div className="border-t border-white/10 pt-6">
            <CadenciaEtapasSection
              pipelineId={pipeline.id}
              etapas={etapas}
              cadencias={cadenciasIniciais}
              publicationBlocked={alteracoesPendentes > 0}
              onPublished={() => router.refresh()}
            />
          </div>
        </TabsContent>

        <TabsContent value="card" className="space-y-8">
          <FormularioEtapaWorkspace
            pipelineId={pipeline.id}
            etapas={etapas}
            campos={campos}
            onFormularioAtualizado={handleFormularioAtualizado}
            publicationBlocked={alteracoesPendentes > 0}
            onPublished={() => router.refresh()}
          />
          <section className="space-y-3 border-t border-white/10 pt-7">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                Pré-visualização publicada
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Confirme como a composição salva será apresentada em cada etapa.
              </p>
            </div>
            <KanbanCardPreview etapas={etapas} campos={campos} />
          </section>
        </TabsContent>

        <TabsContent value="history">
          <PipelineHistory auditoria={pipeline.configAuditoria ?? []} />
        </TabsContent>

        <TabsContent value="fields" className="space-y-8">
          <div className="border-t border-white/10 pt-7">
            <FormularioEtapaWorkspace
              pipelineId={pipeline.id}
              etapas={etapas}
              campos={campos}
              onFormularioAtualizado={handleFormularioAtualizado}
              publicationBlocked={alteracoesPendentes > 0}
              onPublished={() => router.refresh()}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
