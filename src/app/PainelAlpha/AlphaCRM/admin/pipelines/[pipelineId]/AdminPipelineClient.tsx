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
  Pencil,
  Plus,
  Power,
  Save,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  CriarEtapaBpm,
  AtualizarEtapaBpm,
  ReordenarEtapasBpm,
  AtivarDesativarEtapaBpm,
} from "@/actions/bpm/Etapas";
import { CriarCampoBpm, AtualizarCampoBpm } from "@/actions/bpm/Campos";
import { PublicarConfiguracaoPipelineBpm } from "@/actions/bpm/ConfiguracaoPipeline";
import type { TemaAlpha } from "@/lib/temas";
import { agruparCamposPorColuna } from "@/lib/bpm/campos-admin";
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
  nome: string;
  ordem: number;
  cor: string | null;
  ativo: boolean;
  ehInicial: boolean;
  ehFinal: boolean;
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

type AcessoCampo = NonNullable<CampoBpm["acessos"]>[number];
type PerfilCampo = "ADMIN" | "RESPONSAVEL" | "MEMBRO";
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
type OpcaoCampoAdmin = {
  id?: string;
  chave?: string;
  rotulo: string;
  ordem: number;
  ativo: boolean;
};

const PERFIS_CAMPO: { value: PerfilCampo; label: string }[] = [
  { value: "ADMIN", label: "Administrador" },
  { value: "RESPONSAVEL", label: "Responsável" },
  { value: "MEMBRO", label: "Membro" },
];

interface PipelineBpm {
  id: string;
  nome: string;
  ativo?: boolean;
  updatedAt: string | Date;
  etapas: EtapaBpm[];
  campos: CampoBpm[];
  automacoesGlobais?: AutomacaoWorkspace[];
  configAuditoria?: AuditoriaWorkspace[];
}

const TIPOS_CAMPO: { value: string; label: string }[] = [
  { value: "texto", label: "Texto" },
  { value: "texto_longo", label: "Texto longo" },
  { value: "numero", label: "Número" },
  { value: "moeda", label: "Moeda" },
  { value: "percentual", label: "Porcentagem" },
  { value: "data", label: "Data" },
  { value: "data_hora", label: "Data e hora" },
  { value: "selecao", label: "Seleção" },
  { value: "multiselecao", label: "Multiseleção" },
  { value: "booleano", label: "Sim/Não" },
  { value: "usuario", label: "Usuário" },
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "url", label: "URL" },
  { value: "arquivo", label: "Arquivo" },
  { value: "relacionamento", label: "Relacionamento" },
];

const TIPOS_COM_OPICOES = new Set(["selecao", "multiselecao"]);
const FONTES_ATRIBUTOS: Record<string, string[]> = {
  CLIENTE: [
    "cnpj",
    "razaoSocial",
    "nomeFantasia",
    "uf",
    "municipio",
    "regimeTributario",
    "status",
  ],
  CONTATO: [
    "nome",
    "cpf",
    "celular",
    "email",
    "telefoneExtra",
    "vinculo",
    "cargo",
  ],
  PARCEIRO: [
    "documento",
    "nome",
    "nomeFantasia",
    "email",
    "telefone",
    "segmento",
    "ativo",
  ],
  CONTRATO: [
    "valorContrato",
    "formaPagamento",
    "servico",
    "status",
    "contratoUrl",
  ],
  SERVICO: ["id", "nome"],
  PROCESSO: [
    "id",
    "status",
    "dataInicio",
    "dataProtocolo",
    "dataExito",
    "tentativas",
  ],
  CARD: [
    "id",
    "servico",
    "tipoProcesso",
    "status",
    "responsavelId",
    "createdAt",
  ],
};

const inputCls =
  "bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20";

export default function AdminPipelineClient({
  pipeline,
  transicoesIniciais,
  configuracoesSlaIniciais,
  servicosComerciais,
  pipelinesDisponiveis,
  cadenciasIniciais,
  visual,
}: {
  pipeline: PipelineBpm;
  transicoesIniciais: TransicaoBpm[];
  configuracoesSlaIniciais: SlaConfiguracaoAdmin[];
  servicosComerciais: { id: number; nome: string }[];
  pipelinesDisponiveis: { id: string; nome: string }[];
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
  const [campos, setCampos] = useState(pipeline.campos);
  const [camposConfirmados, setCamposConfirmados] = useState(pipeline.campos);
  const [transicoes, setTransicoes] = useState(transicoesIniciais);
  const [versao, setVersao] = useState(() =>
    new Date(pipeline.updatedAt).toISOString(),
  );
  const [conflitoPublicacao, setConflitoPublicacao] = useState(false);
  const [novaEtapaNome, setNovaEtapaNome] = useState("");
  const [novoCampoNome, setNovoCampoNome] = useState("");
  const [novoCampoTipo, setNovoCampoTipo] = useState("texto");
  const [novoCampoEtapaId, setNovoCampoEtapaId] = useState<string>("");
  const [novoCampoObrigatorio, setNovoCampoObrigatorio] = useState(false);
  const [novoCampoOpcoes, setNovoCampoOpcoes] = useState("");
  const [novoCampoEscopo, setNovoCampoEscopo] = useState("CARD");
  const [novoCampoFonteEntidade, setNovoCampoFonteEntidade] =
    useState("CLIENTE");
  const [novoCampoFonteAtributo, setNovoCampoFonteAtributo] = useState("cnpj");
  const [novoCampoValorPadrao, setNovoCampoValorPadrao] = useState("");
  const [novoCampoSomenteLeitura, setNovoCampoSomenteLeitura] = useState(false);
  const [novoCampoPipelineIds, setNovoCampoPipelineIds] = useState<string[]>([
    pipeline.id,
  ]);
  const [editandoCampoId, setEditandoCampoId] = useState<string | null>(null);
  const [editCampoNome, setEditCampoNome] = useState("");
  const [editCampoTipo, setEditCampoTipo] = useState("texto");
  const [editCampoOpcoes, setEditCampoOpcoes] = useState<OpcaoCampoAdmin[]>([]);
  const [editCampoEscopo, setEditCampoEscopo] = useState("CARD");
  const [editCampoFonteEntidade, setEditCampoFonteEntidade] =
    useState("CLIENTE");
  const [editCampoFonteAtributo, setEditCampoFonteAtributo] = useState("cnpj");
  const [editCampoValorPadrao, setEditCampoValorPadrao] = useState("");
  const [editCampoVisivel, setEditCampoVisivel] = useState(true);
  const [editCampoEditavel, setEditCampoEditavel] = useState(true);
  const [editCampoSomenteLeitura, setEditCampoSomenteLeitura] = useState(false);
  const [editCampoPipelineIds, setEditCampoPipelineIds] = useState<string[]>([
    pipeline.id,
  ]);
  const [editCampoEtapaConfigs, setEditCampoEtapaConfigs] = useState<
    ConfigEtapaCampo[]
  >([]);
  const [editCampoAcessos, setEditCampoAcessos] = useState<AcessoCampo[]>([]);
  const [editMapOrigemId, setEditMapOrigemId] = useState("");
  const [editMapModo, setEditMapModo] = useState("COPIAR");
  const [abaAtiva, setAbaAtiva] = useState("overview");
  const [etapaSelecionadaId, setEtapaSelecionadaId] = useState<string | null>(
    null,
  );
  const [buscaCampo, setBuscaCampo] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<
    "TODOS" | "ATIVOS" | "INATIVOS"
  >("TODOS");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroEtapa, setFiltroEtapa] = useState("TODAS");
  const [filtroEscopo, setFiltroEscopo] = useState("TODOS");
  const [filtroPropriedade, setFiltroPropriedade] = useState("TODOS");
  const [erro, setErro] = useState<string | null>(null);
  const [operacao, setOperacao] = useState<string | null>(null);
  const camposFiltrados = useMemo(() => {
    const termo = buscaCampo.trim().toLocaleLowerCase("pt-BR");
    return campos.filter(
      (campo) =>
        (!termo ||
          `${campo.nome} ${campo.tipo}`
            .toLocaleLowerCase("pt-BR")
            .includes(termo)) &&
        (filtroAtivo === "TODOS" ||
          (filtroAtivo === "ATIVOS"
            ? campo.ativo !== false
            : campo.ativo === false)) &&
        (filtroTipo === "TODOS" || campo.tipo === filtroTipo) &&
        (filtroEtapa === "TODAS" ||
          (filtroEtapa === "SEM_CONFIG"
            ? !campo.etapaConfiguracoes?.length
            : campo.etapaConfiguracoes?.some(
                (config) => config.etapaId === filtroEtapa,
              ))) &&
        (filtroEscopo === "TODOS" || campo.escopo === filtroEscopo) &&
        (filtroPropriedade === "TODOS" ||
          (filtroPropriedade === "LOCAL"
            ? campo.pipelineId === pipeline.id
            : campo.pipelineId !== pipeline.id)),
    );
  }, [
    buscaCampo,
    campos,
    filtroAtivo,
    filtroEscopo,
    filtroEtapa,
    filtroPropriedade,
    filtroTipo,
    pipeline.id,
  ]);
  const etapaSelecionada =
    etapas.find((etapa) => etapa.id === etapaSelecionadaId) ?? null;
  const gruposCampos = useMemo(() => {
    const filtrados = camposFiltrados;
    return agruparCamposPorColuna(filtrados, etapas);
  }, [camposFiltrados, etapas]);
  const etapaConfirmadaSelecionada =
    etapasConfirmadas.find((etapa) => etapa.id === etapaSelecionadaId) ?? null;
  const etapaComRascunho = Boolean(
    etapaSelecionada &&
    etapaConfirmadaSelecionada &&
    (etapaSelecionada.nome !== etapaConfirmadaSelecionada.nome ||
      etapaSelecionada.cor !== etapaConfirmadaSelecionada.cor),
  );
  const camposComAtivacaoPendente = campos.filter((campo) => {
    const confirmado = camposConfirmados.find((item) => item.id === campo.id);
    return Boolean(
      confirmado && (campo.ativo ?? true) !== (confirmado.ativo ?? true),
    );
  });
  const alteracoesPendentes =
    Number(etapaComRascunho) +
    Number(Boolean(editandoCampoId)) +
    camposComAtivacaoPendente.length;
  const selecoesAtivasSemCatalogo = campos.filter((campo) => {
    if (campo.ativo === false || !TIPOS_COM_OPICOES.has(campo.tipo))
      return false;
    let possuiLegado = false;
    try {
      const valor = campo.opcoesJson ? JSON.parse(campo.opcoesJson) : [];
      possuiLegado = Array.isArray(valor) && valor.length > 0;
    } catch {
      possuiLegado = false;
    }
    return (
      !campo.fonteEntidade &&
      !campo.opcoes?.some((opcao) => opcao.ativo) &&
      !possuiLegado
    );
  });
  const automacoes = useMemo(() => {
    const unicas = new Map<string, AutomacaoWorkspace>();
    for (const automacao of pipeline.automacoesGlobais ?? [])
      unicas.set(automacao.id, automacao);
    for (const etapa of etapas)
      for (const automacao of etapa.automacoes ?? [])
        unicas.set(automacao.id, automacao);
    return [...unicas.values()];
  }, [etapas, pipeline.automacoesGlobais]);

  function prepararCorrecoesAprovadas() {
    if (selecoesAtivasSemCatalogo.length === 0) return;
    const ids = new Set(selecoesAtivasSemCatalogo.map((campo) => campo.id));
    setCampos((atuais) =>
      atuais.map((campo) =>
        ids.has(campo.id) ? { ...campo, ativo: false } : campo,
      ),
    );
    setConflitoPublicacao(false);
    setAbaAtiva("fields");
    toast.success(
      `${ids.size} campo(s) sem catálogo foram desativados no rascunho`,
    );
  }

  function descartarAlteracoes() {
    descartarEtapa();
    cancelarEdicao();
    setCampos(camposConfirmados);
    setConflitoPublicacao(false);
    setErro(null);
  }

  async function publicarConfiguracaoVersionada() {
    if (operacao || camposComAtivacaoPendente.length === 0) return;
    setOperacao("publicar-configuracao");
    setConflitoPublicacao(false);
    setErro(null);
    const resultado = await PublicarConfiguracaoPipelineBpm({
      pipelineId: pipeline.id,
      versaoEsperada: versao,
      etapas: etapas.map(({ id, ordem, ativo, ehInicial, ehFinal }) => ({
        id,
        ordem,
        ativo,
        ehInicial,
        ehFinal,
      })),
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
      setVersao(resultado.data.versao);
      setCamposConfirmados(campos);
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
    if (editandoCampoId) {
      void salvarEdicao(editandoCampoId);
      return;
    }
    if (etapaComRascunho) {
      void handleSalvarEtapa();
      return;
    }
    void publicarConfiguracaoVersionada();
  }

  async function handleCriarEtapa() {
    if (!novaEtapaNome.trim() || operacao) return;
    setOperacao("criar-etapa");
    setErro(null);
    try {
      const res = await CriarEtapaBpm({
        pipelineId: pipeline.id,
        nome: novaEtapaNome,
        ordem: etapas.length,
      });
      if (res.success && res.data) {
        const nova = { ...res.data, subStatus: [] };
        setEtapas((prev) => [...prev, nova]);
        setEtapasConfirmadas((prev) => [...prev, nova]);
        setNovaEtapaNome("");
        toast.success("Etapa criada com transições bloqueadas por padrão");
        router.refresh();
      } else {
        setErro(
          typeof res.error === "string" ? res.error : "Erro ao criar etapa",
        );
      }
    } finally {
      setOperacao(null);
    }
  }

  async function handleSalvarEtapa() {
    const rascunho = etapaSelecionada;
    const anterior = etapaConfirmadaSelecionada;
    if (
      !rascunho ||
      !anterior ||
      !rascunho.nome.trim() ||
      operacao ||
      !etapaComRascunho
    )
      return;
    setOperacao(`etapa:${rascunho.id}`);
    setErro(null);
    const res = await AtualizarEtapaBpm({
      etapaId: rascunho.id,
      nome: rascunho.nome.trim(),
      cor: rascunho.cor,
    });
    if (res.success && res.data) {
      const confirmada = { ...anterior, ...res.data };
      setEtapas((prev) =>
        prev.map((etapa) => (etapa.id === rascunho.id ? confirmada : etapa)),
      );
      setEtapasConfirmadas((prev) =>
        prev.map((etapa) => (etapa.id === rascunho.id ? confirmada : etapa)),
      );
      toast.success("Alterações da etapa publicadas");
    } else {
      setEtapas((prev) =>
        prev.map((etapa) => (etapa.id === rascunho.id ? anterior : etapa)),
      );
      setErro(
        typeof res.error === "string" ? res.error : "Erro ao publicar etapa",
      );
    }
    setOperacao(null);
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

  async function handleMoverEtapa(index: number, direcao: -1 | 1) {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= etapas.length || operacao) return;

    const anteriores = etapas;
    const reordenadas = etapas.slice();
    [reordenadas[index], reordenadas[novoIndex]] = [
      reordenadas[novoIndex],
      reordenadas[index],
    ];
    const comOrdemAtualizada = reordenadas.map((e, i) => ({ ...e, ordem: i }));
    setEtapas(comOrdemAtualizada);
    setOperacao("reordenar-etapas");
    const resultado = await ReordenarEtapasBpm({
      pipelineId: pipeline.id,
      ordem: comOrdemAtualizada.map((e) => ({ etapaId: e.id, ordem: e.ordem })),
    });
    if (resultado.success) {
      setEtapasConfirmadas(comOrdemAtualizada);
      toast.success("Ordem das etapas salva");
      router.refresh();
    } else {
      setEtapas(anteriores);
      setErro(
        typeof resultado.error === "string"
          ? resultado.error
          : "Erro ao reordenar etapas",
      );
    }
    setOperacao(null);
  }

  async function handleToggleAtivoEtapa(etapaId: string, ativo: boolean) {
    if (operacao) return;
    setOperacao(`etapa:${etapaId}`);
    const res = await AtivarDesativarEtapaBpm({ etapaId, ativo });
    if (res.success) {
      setEtapas((prev) =>
        prev.map((e) => (e.id === etapaId ? { ...e, ativo } : e)),
      );
      setEtapasConfirmadas((prev) =>
        prev.map((e) => (e.id === etapaId ? { ...e, ativo } : e)),
      );
      toast.success(ativo ? "Etapa ativada" : "Etapa desativada");
      router.refresh();
    } else {
      toast.error(
        typeof res.error === "string"
          ? res.error
          : "Erro ao atualizar status da etapa",
      );
    }
    setOperacao(null);
  }

  function handleEtapasAtualizadas(patch: Record<string, Partial<EtapaBpm>>) {
    setEtapas((prev) =>
      prev.map((e) => (patch[e.id] ? { ...e, ...patch[e.id] } : e)),
    );
    setEtapasConfirmadas((prev) =>
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
    if (editandoCampoId) cancelarEdicao();
    setEtapaSelecionadaId(etapaId);
  }

  async function handleCriarCampo() {
    if (!novoCampoNome.trim() || operacao) return;
    const opcoes = TIPOS_COM_OPICOES.has(novoCampoTipo)
      ? novoCampoOpcoes
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    if (
      TIPOS_COM_OPICOES.has(novoCampoTipo) &&
      opcoes.length === 0 &&
      !(novoCampoEscopo === "GLOBAL" && novoCampoFonteEntidade)
    ) {
      setErro(
        "Campo do tipo Seleção requer ao menos uma opção (uma por linha)",
      );
      return;
    }
    setOperacao("criar-campo");
    const res = await CriarCampoBpm({
      pipelineId: pipeline.id,
      nome: novoCampoNome,
      tipo: novoCampoTipo,
      opcoes,
      ordem: campos.length,
      escopo: novoCampoEscopo,
      valorPadrao: novoCampoValorPadrao || null,
      fonteEntidade:
        novoCampoEscopo === "GLOBAL" && novoCampoFonteEntidade
          ? novoCampoFonteEntidade
          : null,
      fonteAtributo:
        novoCampoEscopo === "GLOBAL" && novoCampoFonteEntidade
          ? novoCampoFonteAtributo
          : null,
      entidadeGlobal:
        novoCampoEscopo === "GLOBAL" && !novoCampoFonteEntidade
          ? "CLIENTE"
          : null,
      somenteLeitura:
        (novoCampoEscopo === "GLOBAL" && Boolean(novoCampoFonteEntidade)) ||
        novoCampoSomenteLeitura,
      editavel:
        !(novoCampoEscopo === "GLOBAL" && Boolean(novoCampoFonteEntidade)) &&
        !novoCampoSomenteLeitura,
      pipelineIds: novoCampoPipelineIds,
      etapaConfiguracoes: novoCampoEtapaId
        ? [
            {
              etapaId: novoCampoEtapaId,
              visivel: true,
              editavel:
                !(
                  novoCampoEscopo === "GLOBAL" &&
                  Boolean(novoCampoFonteEntidade)
                ) && !novoCampoSomenteLeitura,
              somenteLeitura:
                (novoCampoEscopo === "GLOBAL" &&
                  Boolean(novoCampoFonteEntidade)) ||
                novoCampoSomenteLeitura,
              obrigatorio: novoCampoObrigatorio,
              ordem: campos.length,
            },
          ]
        : [],
    });
    if (res.success && res.data) {
      setCampos((prev) => [...prev, res.data]);
      setCamposConfirmados((prev) => [...prev, res.data]);
      setNovoCampoNome("");
      setNovoCampoObrigatorio(false);
      setNovoCampoOpcoes("");
      setNovoCampoValorPadrao("");
      setNovoCampoEtapaId("");
      toast.success("Campo criado com o agregado confirmado pelo servidor");
    } else {
      setErro(
        typeof res.error === "string" ? res.error : "Erro ao criar campo",
      );
    }
    setOperacao(null);
  }

  /* ===== Editor / Exclusão de campos (D-24) =========================== */
  function abrirEditor(c: CampoBpm) {
    if (etapaComRascunho) descartarEtapa();
    setEtapaSelecionadaId(null);
    let opcoes: OpcaoCampoAdmin[] = (c.opcoes ?? []).map((opcao) => ({
      ...opcao,
    }));
    if (opcoes.length === 0) {
      try {
        const parsed: unknown = c.opcoesJson ? JSON.parse(c.opcoesJson) : [];
        if (Array.isArray(parsed)) {
          opcoes = parsed
            .filter((opcao): opcao is string => typeof opcao === "string")
            .map((rotulo, ordem) => ({ rotulo, ordem, ativo: true }));
        }
      } catch {
        opcoes = [];
      }
    }
    setEditCampoNome(c.nome);
    setEditCampoTipo(c.tipo);
    setEditCampoOpcoes(opcoes.sort((a, b) => a.ordem - b.ordem));
    setEditCampoEscopo(c.escopo ?? "CARD");
    setEditCampoFonteEntidade(
      c.escopo === "GLOBAL" && !c.fonteEntidade
        ? ""
        : (c.fonteEntidade ?? "CLIENTE"),
    );
    setEditCampoFonteAtributo(c.fonteAtributo ?? "cnpj");
    setEditCampoValorPadrao(c.valorPadrao ?? "");
    setEditCampoVisivel(c.visivel ?? true);
    setEditCampoEditavel(c.editavel ?? true);
    setEditCampoSomenteLeitura(c.somenteLeitura ?? false);
    setEditCampoPipelineIds(
      c.pipelinesAssociados?.map((item) => item.pipelineId) ?? [pipeline.id],
    );
    setEditCampoEtapaConfigs(
      c.etapaConfiguracoes?.map((item) => ({
        ...item,
        obrigatorioEntrada: item.obrigatorioEntrada ?? false,
        obrigatorioSaida: item.obrigatorioSaida ?? false,
      })) ?? [],
    );
    setEditCampoAcessos(
      PERFIS_CAMPO.map(
        ({ value: perfil }) =>
          c.acessos?.find((item) => item.perfil === perfil) ?? {
            perfil,
            visivel: c.visivel ?? true,
            editavel: c.editavel ?? true,
            somenteLeitura: c.somenteLeitura ?? false,
            obrigatorio: c.obrigatorio,
          },
      ),
    );
    setEditMapOrigemId(
      c.mapeamentoDestino?.ativo ? c.mapeamentoDestino.campoOrigemId : "",
    );
    setEditMapModo(c.mapeamentoDestino?.modo ?? "COPIAR");
    setEditandoCampoId(c.id);
  }

  function cancelarEdicao() {
    setEditandoCampoId(null);
  }

  async function salvarEdicao(campoId: string) {
    if (operacao) return;
    if (!editCampoNome.trim()) {
      setErro("Nome do campo é obrigatório");
      return;
    }
    const opcoes = TIPOS_COM_OPICOES.has(editCampoTipo)
      ? editCampoOpcoes
          .filter((opcao) => opcao.rotulo.trim())
          .map((opcao, ordem) =>
            opcao.chave
              ? { ...opcao, rotulo: opcao.rotulo.trim(), ordem }
              : opcao.rotulo.trim(),
          )
      : [];
    setOperacao(`campo:${campoId}`);
    const res = await AtualizarCampoBpm({
      campoId,
      nome: editCampoNome.trim(),
      tipo: editCampoTipo,
      opcoes,
      escopo: editCampoEscopo,
      valorPadrao: editCampoValorPadrao || null,
      fonteEntidade:
        editCampoEscopo === "GLOBAL" && editCampoFonteEntidade
          ? editCampoFonteEntidade
          : null,
      fonteAtributo:
        editCampoEscopo === "GLOBAL" && editCampoFonteEntidade
          ? editCampoFonteAtributo
          : null,
      entidadeGlobal:
        editCampoEscopo === "GLOBAL" && !editCampoFonteEntidade
          ? "CLIENTE"
          : null,
      visivel: editCampoVisivel,
      editavel:
        !(editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade)) &&
        !editCampoSomenteLeitura &&
        editCampoEditavel,
      somenteLeitura:
        (editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade)) ||
        editCampoSomenteLeitura,
      pipelineIds: editCampoPipelineIds,
      etapaConfiguracoes: editCampoEtapaConfigs,
      acessos: editCampoAcessos.map((acesso) => ({
        ...acesso,
        editavel:
          (editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade)) ||
          acesso.somenteLeitura
            ? false
            : acesso.editavel,
        somenteLeitura:
          (editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade)) ||
          acesso.somenteLeitura,
      })),
      mapeamento: editMapOrigemId
        ? { campoOrigemId: editMapOrigemId, modo: editMapModo, ativo: true }
        : null,
    });
    if (res.success && res.data) {
      setCampos((prev) => prev.map((c) => (c.id === campoId ? res.data : c)));
      setCamposConfirmados((prev) =>
        prev.map((c) => (c.id === campoId ? res.data : c)),
      );
      toast.success("Campo salvo");
      cancelarEdicao();
      router.refresh();
    } else {
      setErro(
        typeof res.error === "string" ? res.error : "Erro ao salvar campo",
      );
    }
    setOperacao(null);
  }

  async function alterarAtivacaoCampo(
    campoId: string,
    nome: string,
    ativo: boolean,
  ) {
    if (
      operacao ||
      !confirm(
        `${ativo ? "Ativar" : "Desativar"} o campo "${nome}"? Os valores históricos serão preservados.`,
      )
    )
      return;
    setCampos((prev) =>
      prev.map((campo) => (campo.id === campoId ? { ...campo, ativo } : campo)),
    );
    setConflitoPublicacao(false);
    if (editandoCampoId === campoId) cancelarEdicao();
    toast.success("Alteração adicionada ao rascunho; publique para confirmar");
  }

  return (
    <div className="min-w-0 space-y-5 p-4 sm:p-6 xl:p-8">
      <header className="sticky top-0 z-30 -mx-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-slate-950/90 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8">
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
            Workspace administrativo · publicação atômica e auditada
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-600">Versão {versao}</p>
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
                  ? `${alteracoesPendentes} alteração(ões) não publicada(s)`
                  : "Salvo"}
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
            <Save size={14} /> Publicar alterações
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
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          <span>A configuração mudou desde que este workspace foi aberto. Recarregue para evitar sobrescrever trabalho de outro administrador.</span>
          <button type="button" onClick={() => router.refresh()} className="min-h-9 rounded-lg border border-rose-200/20 px-3 text-xs font-bold">Recarregar configuração</button>
        </div>
      )}
      {selecoesAtivasSemCatalogo.length > 0 && !camposComAtivacaoPendente.length && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100">
          <span>{selecoesAtivasSemCatalogo.length} seleção(ões) customizada(s) ativa(s) não possuem catálogo e não podem ser publicadas como válidas.</span>
          <button type="button" onClick={prepararCorrecoesAprovadas} className="min-h-9 rounded-lg border border-amber-200/20 px-3 text-xs font-bold">Preparar desativação segura</button>
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
          <section className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4" aria-labelledby="decisoes-aprovadas">
            <h2 id="decisoes-aprovadas" className="text-sm font-bold text-amber-100">Decisões administrativas aprovadas</h2>
            <p className="mt-1 text-xs text-amber-100/70">Preservar etapa inicial, etapas finais e transições atuais. Desativar seleções sem fonte ou catálogo até a aprovação do catálogo.</p>
            <button type="button" disabled={selecoesAtivasSemCatalogo.length === 0} onClick={prepararCorrecoesAprovadas} className="mt-3 min-h-10 rounded-xl border border-amber-300/25 px-3 text-xs font-bold text-amber-100 hover:bg-amber-300/10 disabled:opacity-35">Aplicar {selecoesAtivasSemCatalogo.length} correção(ões) ao rascunho</button>
          </section>
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
                          onClick={() => void handleSalvarEtapa()}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-400 px-3 text-xs font-bold text-slate-950 disabled:opacity-35"
                        >
                          {operacao === `etapa:${etapaSelecionada.id}` ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Save size={14} />
                          )}{" "}
                          Salvar geral
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
          />
        </TabsContent>

        <TabsContent value="sla">
          <SlaConfigSection
            pipelineId={pipeline.id}
            pipelineNome={pipeline.nome}
            etapas={etapas}
            servicos={servicosComerciais}
            configuracoesIniciais={configuracoesSlaIniciais}
          />
        </TabsContent>

        <TabsContent value="automations" className="space-y-7">
          <AutomationsOverview automacoes={automacoes} />
          <div className="border-t border-white/10 pt-6">
            <CadenciaEtapasSection
              pipelineId={pipeline.id}
              etapas={etapas}
              cadencias={cadenciasIniciais}
            />
          </div>
        </TabsContent>

        <TabsContent value="card">
          <KanbanCardPreview etapas={etapas} campos={campos} />
        </TabsContent>

        <TabsContent value="history">
          <PipelineHistory auditoria={pipeline.configAuditoria ?? []} />
        </TabsContent>

        <TabsContent value="fields" className="space-y-8">
          {/* Campos personalizados */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                  Campos Personalizados
                </h2>
                <p className="text-xs text-slate-500">
                  Tipos, escopo, acesso por etapa, fontes canônicas e
                  mapeamentos.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-2.5 text-slate-500"
                    aria-hidden="true"
                  />
                  <input
                    aria-label="Buscar campos"
                    className={`${inputCls} pl-8`}
                    value={buscaCampo}
                    onChange={(event) => setBuscaCampo(event.target.value)}
                    placeholder="Buscar campo"
                  />
                </label>
                <select
                  aria-label="Filtrar campos por status"
                  className={inputCls}
                  value={filtroAtivo}
                  onChange={(event) =>
                    setFiltroAtivo(event.target.value as typeof filtroAtivo)
                  }
                >
                  <option value="TODOS">Todos</option>
                  <option value="ATIVOS">Ativos</option>
                  <option value="INATIVOS">Inativos</option>
                </select>
                <select
                  aria-label="Filtrar campos por tipo"
                  className={inputCls}
                  value={filtroTipo}
                  onChange={(event) => setFiltroTipo(event.target.value)}
                >
                  <option value="TODOS">Todos os tipos</option>
                  {TIPOS_CAMPO.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar campos por etapa"
                  className={inputCls}
                  value={filtroEtapa}
                  onChange={(event) => setFiltroEtapa(event.target.value)}
                >
                  <option value="TODAS">Todas as etapas</option>
                  <option value="SEM_CONFIG">Sem configuração</option>
                  {etapas.map((etapa) => (
                    <option key={etapa.id} value={etapa.id}>
                      {etapa.nome}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar campos por escopo"
                  className={inputCls}
                  value={filtroEscopo}
                  onChange={(event) => setFiltroEscopo(event.target.value)}
                >
                  <option value="TODOS">Todos os escopos</option>
                  <option value="CARD">Card</option>
                  <option value="GLOBAL">Global</option>
                </select>
                <select
                  aria-label="Filtrar campos por propriedade"
                  className={inputCls}
                  value={filtroPropriedade}
                  onChange={(event) => setFiltroPropriedade(event.target.value)}
                >
                  <option value="TODOS">Locais e compartilhados</option>
                  <option value="LOCAL">Locais</option>
                  <option value="COMPARTILHADO">Compartilhados</option>
                </select>
              </div>
            </div>
            <div className="space-y-4">
              {gruposCampos.map((grupo) => (
                <div
                  key={grupo.id}
                  role="table"
                  aria-label="Campos do pipeline"
                  className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/35"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {grupo.nome}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {grupo.tipo === "ETAPA"
                          ? "Campos aplicáveis nesta etapa"
                          : grupo.tipo === "ASSOCIADO_SEM_ETAPA"
                            ? "Campos compartilhados com o pipeline, ainda sem etapa aplicável"
                            : "Campos próprios ou globais ainda sem configuração por etapa"}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                      {grupo.campos.length}{" "}
                      {grupo.campos.length === 1 ? "campo" : "campos"}
                    </span>
                  </div>

                  <div
                    role="row"
                    className="hidden grid-cols-[minmax(180px,1.3fr)_100px_minmax(150px,1fr)_minmax(180px,1.2fr)_110px_90px_72px] gap-3 border-b border-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 xl:grid"
                  >
                    <span role="columnheader">Campo</span>
                    <span role="columnheader">Tipo</span>
                    <span role="columnheader">Owner/Escopo</span>
                    <span role="columnheader">Etapas aplicáveis</span>
                    <span role="columnheader">Origem</span>
                    <span role="columnheader">Obrigatoriedade</span>
                    <span role="columnheader">Status</span>
                  </div>
                  {grupo.campos.length === 0 ? (
                    <p className="px-4 py-5 text-sm text-slate-500">
                      Nenhum campo configurado nesta coluna
                    </p>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {grupo.campos.map((campo) => {
                        const editando = editandoCampoId === campo.id;
                        const obrigatorioContextual =
                          campo.etapaConfiguracoes?.some(
                            (config) =>
                              config.obrigatorio ||
                              config.obrigatorioEntrada ||
                              config.obrigatorioSaida,
                          ) ?? false;
                        const opcoesLegadas = (() => {
                          try {
                            return (
                              Array.isArray(
                                campo.opcoesJson
                                  ? JSON.parse(campo.opcoesJson)
                                  : [],
                              ) &&
                              JSON.parse(campo.opcoesJson ?? "[]").length > 0
                            );
                          } catch {
                            return false;
                          }
                        })();
                        const selecaoSemCatalogo =
                          TIPOS_COM_OPICOES.has(campo.tipo) &&
                          !campo.fonteEntidade &&
                          !(
                            campo.opcoes?.some((opcao) => opcao.ativo) ||
                            opcoesLegadas
                          );
                        const pipelinesCompartilhados =
                          campo.pipelinesAssociados
                            ?.filter(
                              (item) => item.pipelineId !== campo.pipelineId,
                            )
                            .map(
                              (item) => item.pipeline?.nome ?? item.pipelineId,
                            ) ?? [];
                        const etapasAplicaveis =
                          campo.etapaConfiguracoes?.map(
                            (config) =>
                              config.etapa?.nome ??
                              etapas.find(
                                (etapa) => etapa.id === config.etapaId,
                              )?.nome ??
                              config.etapaId,
                          ) ?? [];
                        return (
                          <div
                            key={campo.id}
                            role="rowgroup"
                            className={`bg-slate-800/40 ${campo.ativo === false ? "opacity-55" : ""}`}
                          >
                            <div
                              role="row"
                              className="grid items-center gap-2 px-3 py-3 xl:grid-cols-[minmax(180px,1.3fr)_100px_minmax(150px,1fr)_minmax(180px,1.2fr)_110px_90px_72px] xl:gap-3"
                            >
                              <span role="cell" className="min-w-0">
                                <strong className="block truncate text-sm text-white">
                                  {campo.nome}
                                </strong>
                                {selecaoSemCatalogo && (
                                  <small className="text-[10px] text-rose-200">
                                    Sem opções válidas
                                  </small>
                                )}
                              </span>
                              <span
                                role="cell"
                                className="text-xs text-slate-500"
                              >
                                {campo.tipo}
                              </span>
                              <span
                                role="cell"
                                className="text-[11px] text-slate-400"
                              >
                                <span className="block">
                                  {campo.escopo === "GLOBAL"
                                    ? "Global"
                                    : "Card"}
                                </span>
                                <span
                                  title={pipelinesCompartilhados.join(", ")}
                                >
                                  {campo.pipelineId === pipeline.id
                                    ? "Próprio"
                                    : `Compartilhado · ${campo.pipeline?.nome ?? "outro pipeline"}`}
                                </span>
                              </span>
                              <span
                                role="cell"
                                title={etapasAplicaveis.join(", ")}
                                className={`truncate text-xs ${etapasAplicaveis.length ? "text-slate-300" : "text-amber-200"}`}
                              >
                                {etapasAplicaveis.join(", ") ||
                                  "Sem configuração por etapa"}
                              </span>
                              <span
                                role="cell"
                                className="text-xs text-slate-400"
                              >
                                {campo.fonteEntidade
                                  ? `${campo.fonteEntidade}.${campo.fonteAtributo ?? "*"}`
                                  : "Valor do card"}
                              </span>
                              <span
                                role="cell"
                                className="text-xs text-slate-400"
                              >
                                {obrigatorioContextual ? "Obrigatório por etapa" : "Não"}
                              </span>
                              <span
                                role="cell"
                                className="flex items-center justify-end gap-1"
                              >
                                <span
                                  className={`mr-1 size-2 rounded-full ${campo.ativo === false ? "bg-slate-600" : "bg-emerald-400"}`}
                                  title={
                                    campo.ativo === false ? "Inativo" : "Ativo"
                                  }
                                />
                                <button
                                  onClick={() =>
                                    editando
                                      ? cancelarEdicao()
                                      : abrirEditor(campo)
                                  }
                                  className="p-1.5 rounded text-slate-400 hover:text-white"
                                  aria-label={
                                    editando
                                      ? "Cancelar edição do campo"
                                      : `Editar campo ${campo.nome}`
                                  }
                                  title={
                                    editando
                                      ? "Cancelar edição"
                                      : "Editar campo"
                                  }
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() =>
                                    void alterarAtivacaoCampo(
                                      campo.id,
                                      campo.nome,
                                      campo.ativo === false,
                                    )
                                  }
                                  disabled={editando || Boolean(operacao)}
                                  className="p-1.5 rounded text-slate-400 hover:text-amber-300 disabled:opacity-30"
                                  aria-label={`${campo.ativo === false ? "Ativar" : "Desativar"} campo ${campo.nome}`}
                                  title={
                                    campo.ativo === false
                                      ? "Ativar campo"
                                      : "Desativar campo"
                                  }
                                >
                                  <Power size={14} />
                                </button>
                              </span>
                            </div>

                            {editando && (
                              <div
                                role="dialog"
                                aria-modal="true"
                                aria-label={`Editar campo ${campo.nome}`}
                                className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl space-y-4 overflow-y-auto border-l border-white/10 bg-slate-950 p-5 shadow-2xl"
                              >
                                <div className="sticky top-0 z-10 -mx-5 -mt-5 flex items-start justify-between gap-3 border-b border-white/10 bg-slate-950/95 p-5 backdrop-blur">
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                      Editor de campo
                                    </p>
                                    <h3 className="mt-1 text-lg font-bold text-white">
                                      {campo.nome}
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Identidade, propriedade, comportamento,
                                      regras, permissões e mapeamento.
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={cancelarEdicao}
                                    aria-label="Fechar editor de campo"
                                    className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                                {campo.pipelineId !== pipeline.id && (
                                  <div
                                    className="rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2 text-xs text-amber-100"
                                    role="alert"
                                  >
                                    Este campo pertence ao pipeline{" "}
                                    {campo.pipeline?.nome ?? campo.pipelineId} e
                                    é compartilhado com este pipeline.
                                    Alterações de identidade e comportamento
                                    podem impactar todos os pipelines
                                    associados.
                                  </div>
                                )}
                                {pipelinesCompartilhados.length > 0 &&
                                  campo.pipelineId === pipeline.id && (
                                    <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-3 py-2 text-xs text-sky-100">
                                      Este campo é compartilhado com{" "}
                                      {pipelinesCompartilhados.join(", ")}.
                                      Revise o impacto antes de salvar.
                                    </div>
                                  )}
                                <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                  1. Identidade e comportamento
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <label className="space-y-1 text-xs text-slate-400">
                                    <span>Nome</span>
                                    <input
                                      className={inputCls + " w-full"}
                                      value={editCampoNome}
                                      onChange={(e) =>
                                        setEditCampoNome(e.target.value)
                                      }
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-400">
                                    <span>Tipo</span>
                                    <select
                                      className={inputCls + " w-full"}
                                      value={editCampoTipo}
                                      onChange={(e) =>
                                        setEditCampoTipo(e.target.value)
                                      }
                                    >
                                      {TIPOS_CAMPO.map((t) => (
                                        <option key={t.value} value={t.value}>
                                          {t.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  {TIPOS_COM_OPICOES.has(editCampoTipo) && (
                                    <fieldset className="sm:col-span-2 space-y-2 rounded-lg border border-white/10 p-2 text-xs text-slate-400">
                                      <legend className="px-1">
                                        Opções estruturadas
                                      </legend>
                                      {editCampoOpcoes.map((opcao, indice) => (
                                        <div
                                          key={
                                            opcao.id ??
                                            opcao.chave ??
                                            `nova-${indice}`
                                          }
                                          className="flex items-center gap-2"
                                        >
                                          <input
                                            className={inputCls + " flex-1"}
                                            value={opcao.rotulo}
                                            onChange={(event) =>
                                              setEditCampoOpcoes((atuais) =>
                                                atuais.map((item, atual) =>
                                                  atual === indice
                                                    ? {
                                                        ...item,
                                                        rotulo:
                                                          event.target.value,
                                                      }
                                                    : item,
                                                ),
                                              )
                                            }
                                          />
                                          <label className="whitespace-nowrap">
                                            <input
                                              type="checkbox"
                                              checked={opcao.ativo}
                                              onChange={(event) =>
                                                setEditCampoOpcoes((atuais) =>
                                                  atuais.map((item, atual) =>
                                                    atual === indice
                                                      ? {
                                                          ...item,
                                                          ativo:
                                                            event.target
                                                              .checked,
                                                        }
                                                      : item,
                                                  ),
                                                )
                                              }
                                            />{" "}
                                            Ativa
                                          </label>
                                          <button
                                            type="button"
                                            disabled={indice === 0}
                                            className="rounded border border-white/10 px-2 py-1 disabled:opacity-30"
                                            onClick={() =>
                                              setEditCampoOpcoes((atuais) => {
                                                const novas = [...atuais];
                                                [
                                                  novas[indice - 1],
                                                  novas[indice],
                                                ] = [
                                                  novas[indice],
                                                  novas[indice - 1],
                                                ];
                                                return novas.map(
                                                  (item, ordem) => ({
                                                    ...item,
                                                    ordem,
                                                  }),
                                                );
                                              })
                                            }
                                          >
                                            ↑
                                          </button>
                                          <button
                                            type="button"
                                            disabled={
                                              indice ===
                                              editCampoOpcoes.length - 1
                                            }
                                            className="rounded border border-white/10 px-2 py-1 disabled:opacity-30"
                                            onClick={() =>
                                              setEditCampoOpcoes((atuais) => {
                                                const novas = [...atuais];
                                                [
                                                  novas[indice],
                                                  novas[indice + 1],
                                                ] = [
                                                  novas[indice + 1],
                                                  novas[indice],
                                                ];
                                                return novas.map(
                                                  (item, ordem) => ({
                                                    ...item,
                                                    ordem,
                                                  }),
                                                );
                                              })
                                            }
                                          >
                                            ↓
                                          </button>
                                        </div>
                                      ))}
                                      <button
                                        type="button"
                                        className="rounded border border-white/10 px-2 py-1 text-slate-300 hover:text-white"
                                        onClick={() =>
                                          setEditCampoOpcoes((atuais) => [
                                            ...atuais,
                                            {
                                              rotulo: "",
                                              ordem: atuais.length,
                                              ativo: true,
                                            },
                                          ])
                                        }
                                      >
                                        Adicionar opção
                                      </button>
                                      <p className="text-[10px] text-slate-500">
                                        Desative em vez de excluir para
                                        preservar valores e histórico.
                                      </p>
                                    </fieldset>
                                  )}
                                  <label className="space-y-1 text-xs text-slate-400">
                                    <span>Escopo</span>
                                    <select
                                      className={inputCls + " w-full"}
                                      value={editCampoEscopo}
                                      onChange={(event) =>
                                        setEditCampoEscopo(event.target.value)
                                      }
                                    >
                                      <option value="CARD">
                                        Específico do card
                                      </option>
                                      <option value="GLOBAL">
                                        Dado global canônico
                                      </option>
                                    </select>
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-400">
                                    <span>Valor padrão</span>
                                    <input
                                      className={inputCls + " w-full"}
                                      value={editCampoValorPadrao}
                                      onChange={(event) =>
                                        setEditCampoValorPadrao(
                                          event.target.value,
                                        )
                                      }
                                    />
                                  </label>
                                  {editCampoEscopo === "GLOBAL" && (
                                    <>
                                      <label className="space-y-1 text-xs text-slate-400">
                                        <span>Entidade canônica</span>
                                        <select
                                          className={inputCls + " w-full"}
                                          value={editCampoFonteEntidade}
                                          onChange={(event) => {
                                            setEditCampoFonteEntidade(
                                              event.target.value,
                                            );
                                            setEditCampoFonteAtributo(
                                              FONTES_ATRIBUTOS[
                                                event.target.value
                                              ]?.[0] ?? "",
                                            );
                                          }}
                                        >
                                          <option value="">
                                            Valor global personalizado do
                                            cliente
                                          </option>
                                          {Object.keys(FONTES_ATRIBUTOS).map(
                                            (fonte) => (
                                              <option key={fonte}>
                                                {fonte}
                                              </option>
                                            ),
                                          )}
                                        </select>
                                      </label>
                                      {editCampoFonteEntidade && (
                                        <label className="space-y-1 text-xs text-slate-400">
                                          <span>Atributo canônico</span>
                                          <select
                                            className={inputCls + " w-full"}
                                            value={editCampoFonteAtributo}
                                            onChange={(event) =>
                                              setEditCampoFonteAtributo(
                                                event.target.value,
                                              )
                                            }
                                          >
                                            {(
                                              FONTES_ATRIBUTOS[
                                                editCampoFonteEntidade
                                              ] ?? []
                                            ).map((atributo) => (
                                              <option key={atributo}>
                                                {atributo}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      )}
                                    </>
                                  )}
                                  <label className="space-y-1 text-xs text-slate-400">
                                    <span>
                                      Pipelines (Ctrl/Cmd para múltiplos)
                                    </span>
                                    <select
                                      multiple
                                      className={inputCls + " min-h-24 w-full"}
                                      value={editCampoPipelineIds}
                                      onChange={(event) =>
                                        setEditCampoPipelineIds(
                                          Array.from(
                                            event.currentTarget.selectedOptions,
                                            (option) => option.value,
                                          ),
                                        )
                                      }
                                    >
                                      {pipelinesDisponiveis.map((item) => (
                                        <option key={item.id} value={item.id}>
                                          {item.nome}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-400">
                                    <span>Etapas aplicáveis</span>
                                    <select
                                      multiple
                                      className={inputCls + " min-h-24 w-full"}
                                      value={editCampoEtapaConfigs.map(
                                        (item) => item.etapaId,
                                      )}
                                      onChange={(event) => {
                                        const selecionadas = Array.from(
                                          event.currentTarget.selectedOptions,
                                          (option) => option.value,
                                        );
                                        setEditCampoEtapaConfigs((atuais) =>
                                          selecionadas.map(
                                            (etapaId, ordem) =>
                                              atuais.find(
                                                (item) =>
                                                  item.etapaId === etapaId,
                                              ) ?? {
                                                etapaId,
                                                visivel: true,
                                                editavel:
                                                  !(
                                                    editCampoEscopo ===
                                                      "GLOBAL" &&
                                                    Boolean(
                                                      editCampoFonteEntidade,
                                                    )
                                                  ) && !editCampoSomenteLeitura,
                                                somenteLeitura:
                                                  (editCampoEscopo ===
                                                    "GLOBAL" &&
                                                    Boolean(
                                                      editCampoFonteEntidade,
                                                    )) ||
                                                  editCampoSomenteLeitura,
                                                obrigatorio: false,
                                                obrigatorioEntrada: false,
                                                obrigatorioSaida: false,
                                                ordem,
                                                grupo: null,
                                                valorPadrao: null,
                                                condicaoVisibilidadeJson: null,
                                                condicaoObrigatoriedadeJson:
                                                  null,
                                              },
                                          ),
                                        );
                                      }}
                                    >
                                      {etapas.map((item) => (
                                        <option key={item.id} value={item.id}>
                                          {item.nome}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  {editCampoEtapaConfigs.length > 0 && (
                                    <fieldset className="sm:col-span-2 space-y-3 rounded-lg border border-sky-400/20 bg-sky-400/[0.03] p-3 text-xs text-slate-400">
                                      <legend className="px-1 font-semibold text-sky-200">
                                        Configuração por etapa
                                      </legend>
                                      {editCampoEtapaConfigs.map(
                                        (config, indice) => {
                                          const etapa = etapas.find(
                                            (item) =>
                                              item.id === config.etapaId,
                                          );
                                          const atualizar = (
                                            patch: Partial<ConfigEtapaCampo>,
                                          ) =>
                                            setEditCampoEtapaConfigs((atuais) =>
                                              atuais.map((item) =>
                                                item.etapaId === config.etapaId
                                                  ? {
                                                      ...item,
                                                      ...patch,
                                                      editavel:
                                                        patch.somenteLeitura
                                                          ? false
                                                          : (patch.editavel ??
                                                            item.editavel),
                                                    }
                                                  : item,
                                              ),
                                            );
                                          return (
                                            <div
                                              key={config.etapaId}
                                              className="space-y-2 rounded-lg border border-white/10 bg-slate-950/30 p-3"
                                            >
                                              <div className="flex items-center justify-between gap-2">
                                                <strong className="text-slate-200">
                                                  {etapa?.nome ??
                                                    config.etapaId}
                                                </strong>
                                                <label className="flex items-center gap-1">
                                                  Ordem{" "}
                                                  <input
                                                    type="number"
                                                    min={0}
                                                    className={
                                                      inputCls + " w-20"
                                                    }
                                                    value={config.ordem}
                                                    onChange={(event) =>
                                                      atualizar({
                                                        ordem:
                                                          Number(
                                                            event.target.value,
                                                          ) || 0,
                                                      })
                                                    }
                                                  />
                                                </label>
                                              </div>
                                              <div className="flex flex-wrap gap-3">
                                                <label>
                                                  <input
                                                    type="checkbox"
                                                    checked={config.visivel}
                                                    onChange={(event) =>
                                                      atualizar({
                                                        visivel:
                                                          event.target.checked,
                                                      })
                                                    }
                                                  />{" "}
                                                  Visível
                                                </label>
                                                <label>
                                                  <input
                                                    type="checkbox"
                                                    checked={config.editavel}
                                                    disabled={
                                                      config.somenteLeitura ||
                                                      (editCampoEscopo ===
                                                        "GLOBAL" &&
                                                        Boolean(
                                                          editCampoFonteEntidade,
                                                        ))
                                                    }
                                                    onChange={(event) =>
                                                      atualizar({
                                                        editavel:
                                                          event.target.checked,
                                                      })
                                                    }
                                                  />{" "}
                                                  Editável
                                                </label>
                                                <label>
                                                  <input
                                                    type="checkbox"
                                                    checked={
                                                      config.somenteLeitura ||
                                                      (editCampoEscopo ===
                                                        "GLOBAL" &&
                                                        Boolean(
                                                          editCampoFonteEntidade,
                                                        ))
                                                    }
                                                    disabled={
                                                      editCampoEscopo ===
                                                        "GLOBAL" &&
                                                      Boolean(
                                                        editCampoFonteEntidade,
                                                      )
                                                    }
                                                    onChange={(event) =>
                                                      atualizar({
                                                        somenteLeitura:
                                                          event.target.checked,
                                                      })
                                                    }
                                                  />{" "}
                                                  Somente leitura
                                                </label>
                                                <label>
                                                  <input
                                                    type="checkbox"
                                                    checked={config.obrigatorio}
                                                    onChange={(event) =>
                                                      atualizar({
                                                        obrigatorio:
                                                          event.target.checked,
                                                      })
                                                    }
                                                  />{" "}
                                                  Obrigatório na etapa
                                                </label>
                                                <label>
                                                  <input
                                                    type="checkbox"
                                                    checked={
                                                      config.obrigatorioEntrada
                                                    }
                                                    onChange={(event) =>
                                                      atualizar({
                                                        obrigatorioEntrada:
                                                          event.target.checked,
                                                      })
                                                    }
                                                  />{" "}
                                                  Obrigatório para entrar
                                                </label>
                                                <label>
                                                  <input
                                                    type="checkbox"
                                                    checked={
                                                      config.obrigatorioSaida
                                                    }
                                                    onChange={(event) =>
                                                      atualizar({
                                                        obrigatorioSaida:
                                                          event.target.checked,
                                                      })
                                                    }
                                                  />{" "}
                                                  Obrigatório para sair
                                                </label>
                                              </div>
                                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                <label className="space-y-1">
                                                  <span>Grupo/seção</span>
                                                  <input
                                                    className={
                                                      inputCls + " w-full"
                                                    }
                                                    value={config.grupo ?? ""}
                                                    onChange={(event) =>
                                                      atualizar({
                                                        grupo:
                                                          event.target.value ||
                                                          null,
                                                      })
                                                    }
                                                  />
                                                </label>
                                                <label className="space-y-1">
                                                  <span>
                                                    Valor padrão nesta etapa
                                                  </span>
                                                  <input
                                                    className={
                                                      inputCls + " w-full"
                                                    }
                                                    value={
                                                      config.valorPadrao ?? ""
                                                    }
                                                    onChange={(event) =>
                                                      atualizar({
                                                        valorPadrao:
                                                          event.target.value ||
                                                          null,
                                                      })
                                                    }
                                                  />
                                                </label>
                                                <label className="space-y-1 sm:col-span-2">
                                                  <span>
                                                    Condição de visibilidade
                                                    (JSON do Motor de Regras)
                                                  </span>
                                                  <textarea
                                                    rows={3}
                                                    className={
                                                      inputCls +
                                                      " w-full font-mono text-[11px]"
                                                    }
                                                    value={
                                                      config.condicaoVisibilidadeJson ??
                                                      ""
                                                    }
                                                    onChange={(event) =>
                                                      atualizar({
                                                        condicaoVisibilidadeJson:
                                                          event.target.value ||
                                                          null,
                                                      })
                                                    }
                                                  />
                                                </label>
                                                <label className="space-y-1 sm:col-span-2">
                                                  <span>
                                                    Condição de obrigatoriedade
                                                    (JSON do Motor de Regras)
                                                  </span>
                                                  <textarea
                                                    rows={3}
                                                    className={
                                                      inputCls +
                                                      " w-full font-mono text-[11px]"
                                                    }
                                                    value={
                                                      config.condicaoObrigatoriedadeJson ??
                                                      ""
                                                    }
                                                    onChange={(event) =>
                                                      atualizar({
                                                        condicaoObrigatoriedadeJson:
                                                          event.target.value ||
                                                          null,
                                                      })
                                                    }
                                                  />
                                                </label>
                                              </div>
                                              <span className="sr-only">
                                                Configuração {indice + 1}
                                              </span>
                                            </div>
                                          );
                                        },
                                      )}
                                    </fieldset>
                                  )}
                                  <fieldset className="sm:col-span-2 flex flex-wrap gap-4 rounded-lg border border-white/10 p-2 text-xs text-slate-400">
                                    <legend className="px-1">
                                      Acesso padrão
                                    </legend>
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={editCampoVisivel}
                                        onChange={(event) =>
                                          setEditCampoVisivel(
                                            event.target.checked,
                                          )
                                        }
                                      />{" "}
                                      Visível
                                    </label>
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={editCampoEditavel}
                                        disabled={
                                          editCampoSomenteLeitura ||
                                          (editCampoEscopo === "GLOBAL" &&
                                            Boolean(editCampoFonteEntidade))
                                        }
                                        onChange={(event) =>
                                          setEditCampoEditavel(
                                            event.target.checked,
                                          )
                                        }
                                      />{" "}
                                      Editável
                                    </label>
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={
                                          editCampoSomenteLeitura ||
                                          (editCampoEscopo === "GLOBAL" &&
                                            Boolean(editCampoFonteEntidade))
                                        }
                                        disabled={
                                          editCampoEscopo === "GLOBAL" &&
                                          Boolean(editCampoFonteEntidade)
                                        }
                                        onChange={(event) =>
                                          setEditCampoSomenteLeitura(
                                            event.target.checked,
                                          )
                                        }
                                      />{" "}
                                      Somente leitura
                                    </label>
                                  </fieldset>
                                  <fieldset className="sm:col-span-2 space-y-2 rounded-lg border border-white/10 p-2 text-xs text-slate-400">
                                    <legend className="px-1">
                                      Acesso por perfil
                                    </legend>
                                    {PERFIS_CAMPO.map(
                                      ({ value: perfil, label }) => {
                                        const acesso = editCampoAcessos.find(
                                          (item) => item.perfil === perfil,
                                        );
                                        if (!acesso) return null;
                                        const atualizar = (
                                          patch: Partial<AcessoCampo>,
                                        ) =>
                                          setEditCampoAcessos((atuais) =>
                                            atuais.map((item) =>
                                              item.perfil === perfil
                                                ? {
                                                    ...item,
                                                    ...patch,
                                                    editavel:
                                                      patch.somenteLeitura
                                                        ? false
                                                        : (patch.editavel ??
                                                          item.editavel),
                                                  }
                                                : item,
                                            ),
                                          );
                                        return (
                                          <div
                                            key={perfil}
                                            className="flex flex-wrap items-center gap-3"
                                          >
                                            <span className="w-28 font-semibold text-slate-300">
                                              {label}
                                            </span>
                                            <label>
                                              <input
                                                type="checkbox"
                                                checked={acesso.visivel}
                                                onChange={(event) =>
                                                  atualizar({
                                                    visivel:
                                                      event.target.checked,
                                                  })
                                                }
                                              />{" "}
                                              Visível
                                            </label>
                                            <label>
                                              <input
                                                type="checkbox"
                                                checked={acesso.editavel}
                                                disabled={acesso.somenteLeitura}
                                                onChange={(event) =>
                                                  atualizar({
                                                    editavel:
                                                      event.target.checked,
                                                  })
                                                }
                                              />{" "}
                                              Editável
                                            </label>
                                            <label>
                                              <input
                                                type="checkbox"
                                                checked={acesso.somenteLeitura}
                                                onChange={(event) =>
                                                  atualizar({
                                                    somenteLeitura:
                                                      event.target.checked,
                                                  })
                                                }
                                              />{" "}
                                              Somente leitura
                                            </label>
                                            <label>
                                              <input
                                                type="checkbox"
                                                checked={acesso.obrigatorio}
                                                onChange={(event) =>
                                                  atualizar({
                                                    obrigatorio:
                                                      event.target.checked,
                                                  })
                                                }
                                              />{" "}
                                              Obrigatório
                                            </label>
                                          </div>
                                        );
                                      },
                                    )}
                                  </fieldset>
                                  <label className="space-y-1 text-xs text-slate-400">
                                    <span>Mapear a partir de</span>
                                    <select
                                      className={inputCls + " w-full"}
                                      value={editMapOrigemId}
                                      onChange={(event) =>
                                        setEditMapOrigemId(event.target.value)
                                      }
                                    >
                                      <option value="">Sem mapeamento</option>
                                      {campos
                                        .filter(
                                          (item) =>
                                            item.id !== campo.id &&
                                            item.tipo === editCampoTipo,
                                        )
                                        .map((item) => (
                                          <option key={item.id} value={item.id}>
                                            {item.nome}
                                          </option>
                                        ))}
                                    </select>
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-400">
                                    <span>Modo do mapeamento</span>
                                    <select
                                      className={inputCls + " w-full"}
                                      value={editMapModo}
                                      disabled={!editMapOrigemId}
                                      onChange={(event) =>
                                        setEditMapModo(event.target.value)
                                      }
                                    >
                                      <option value="COPIAR">
                                        Copiar snapshot
                                      </option>
                                      <option value="SINCRONIZAR">
                                        Sincronizar origem → destino
                                      </option>
                                      <option value="REFERENCIAR">
                                        Referenciar origem
                                      </option>
                                    </select>
                                  </label>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    disabled={Boolean(operacao)}
                                    onClick={() => void salvarEdicao(campo.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                                    style={{
                                      background: `rgba(${accent},0.85)`,
                                    }}
                                  >
                                    {operacao === `campo:${campo.id}` && (
                                      <Loader2
                                        size={14}
                                        className="animate-spin"
                                      />
                                    )}{" "}
                                    Salvar
                                  </button>
                                  <button
                                    disabled={Boolean(operacao)}
                                    onClick={cancelarEdicao}
                                    className="px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white disabled:opacity-40"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                className={`${inputCls} flex-1 min-w-[140px]`}
                placeholder="Nome do campo"
                value={novoCampoNome}
                onChange={(e) => setNovoCampoNome(e.target.value)}
              />
              <select
                className={inputCls}
                value={novoCampoTipo}
                onChange={(e) => setNovoCampoTipo(e.target.value)}
              >
                {TIPOS_CAMPO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {TIPOS_COM_OPICOES.has(novoCampoTipo) && (
                <textarea
                  className={`${inputCls} min-w-[160px] min-h-[36px] font-mono`}
                  placeholder="Opções (uma por linha)"
                  value={novoCampoOpcoes}
                  onChange={(e) => setNovoCampoOpcoes(e.target.value)}
                />
              )}
              <select
                className={inputCls}
                value={novoCampoEtapaId}
                onChange={(e) => {
                  setNovoCampoEtapaId(e.target.value);
                  if (!e.target.value) setNovoCampoObrigatorio(false);
                }}
              >
                <option value="">Sem etapa aplicável</option>
                {etapas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
              <select
                aria-label="Escopo do novo campo"
                className={inputCls}
                value={novoCampoEscopo}
                onChange={(event) => setNovoCampoEscopo(event.target.value)}
              >
                <option value="CARD">Card</option>
                <option value="GLOBAL">Global</option>
              </select>
              <input
                className={inputCls}
                placeholder="Valor padrão"
                value={novoCampoValorPadrao}
                onChange={(event) =>
                  setNovoCampoValorPadrao(event.target.value)
                }
              />
              {novoCampoEscopo === "GLOBAL" && (
                <>
                  <select
                    aria-label="Entidade canônica"
                    className={inputCls}
                    value={novoCampoFonteEntidade}
                    onChange={(event) => {
                      setNovoCampoFonteEntidade(event.target.value);
                      setNovoCampoFonteAtributo(
                        FONTES_ATRIBUTOS[event.target.value]?.[0] ?? "",
                      );
                    }}
                  >
                    <option value="">
                      Valor global personalizado do cliente
                    </option>
                    {Object.keys(FONTES_ATRIBUTOS).map((fonte) => (
                      <option key={fonte}>{fonte}</option>
                    ))}
                  </select>
                  {novoCampoFonteEntidade && (
                    <select
                      aria-label="Atributo canônico"
                      className={inputCls}
                      value={novoCampoFonteAtributo}
                      onChange={(event) =>
                        setNovoCampoFonteAtributo(event.target.value)
                      }
                    >
                      {(FONTES_ATRIBUTOS[novoCampoFonteEntidade] ?? []).map(
                        (atributo) => (
                          <option key={atributo}>{atributo}</option>
                        ),
                      )}
                    </select>
                  )}
                </>
              )}
              <label className="space-y-1 text-xs text-slate-400">
                <span>Pipelines</span>
                <select
                  multiple
                  className={`${inputCls} min-h-20`}
                  value={novoCampoPipelineIds}
                  onChange={(event) =>
                    setNovoCampoPipelineIds(
                      Array.from(
                        event.currentTarget.selectedOptions,
                        (option) => option.value,
                      ),
                    )
                  }
                >
                  {pipelinesDisponiveis.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                <input
                  type="checkbox"
                  disabled={!novoCampoEtapaId}
                  checked={novoCampoObrigatorio}
                  onChange={(e) => setNovoCampoObrigatorio(e.target.checked)}
                />
                Obrigatório nesta etapa
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={
                    novoCampoSomenteLeitura ||
                    (novoCampoEscopo === "GLOBAL" &&
                      Boolean(novoCampoFonteEntidade))
                  }
                  disabled={
                    novoCampoEscopo === "GLOBAL" &&
                    Boolean(novoCampoFonteEntidade)
                  }
                  onChange={(e) => setNovoCampoSomenteLeitura(e.target.checked)}
                />
                Somente leitura
              </label>
              <button
                onClick={handleCriarCampo}
                disabled={Boolean(operacao) || !novoCampoNome.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: `rgba(${accent},0.85)` }}
              >
                {operacao === "criar-campo" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}{" "}
                Adicionar
              </button>
            </div>
          </section>
          <div className="border-t border-white/10 pt-7">
            <FormularioEtapaWorkspace
              pipelineId={pipeline.id}
              etapas={etapas}
              campos={campos}
              onFormularioAtualizado={handleFormularioAtualizado}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
