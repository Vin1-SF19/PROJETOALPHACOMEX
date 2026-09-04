"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, GripVertical, Pencil, Power, Search } from "lucide-react";
import { CriarEtapaBpm, AtualizarEtapaBpm, ReordenarEtapasBpm, AtivarDesativarEtapaBpm } from "@/actions/bpm/Etapas";
import { AtivarDesativarCampoBpm, ConfigurarMapeamentoCampoBpm, CriarCampoBpm, AtualizarCampoBpm, DesativarMapeamentoCampoBpm } from "@/actions/bpm/Campos";
import type { TemaAlpha } from "@/lib/temas";
import { FINANCIAL_PIPELINE_NAME, hasConfiguredFinancialPipeline } from "@/lib/bpm/pipeline-financeiro";
import { agruparCamposPorColuna } from "@/lib/bpm/campos-admin";
import { ConfigurarEtapasFinanceiroButton } from "./ConfigurarEtapasFinanceiroButton";
import { VisibilidadeEtapasSection } from "./VisibilidadeEtapasSection";
import { EtapaAvancadaSection, type SubStatusBpm, type TransicaoBpm } from "./EtapaAvancadaSection";
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

interface EtapaBpm {
  id: string;
  nome: string;
  ordem: number;
  slaDias: number | null;
  cor: string | null;
  ativo: boolean;
  ehInicial: boolean;
  ehFinal: boolean;
  subStatus: SubStatusBpm[];
}

interface CampoBpm {
  id: string;
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
  pipelinesAssociados?: { pipelineId: string }[];
  etapaConfiguracoes?: ConfigEtapaCampo[];
  acessos?: { perfil: string; visivel: boolean; editavel: boolean; somenteLeitura: boolean; obrigatorio: boolean }[];
  opcoes?: { id: string; chave: string; rotulo: string; ordem: number; ativo: boolean }[];
  mapeamentoDestino?: { campoOrigemId: string; modo: string; ativo: boolean } | null;
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
type OpcaoCampoAdmin = { id?: string; chave?: string; rotulo: string; ordem: number; ativo: boolean };

const PERFIS_CAMPO: { value: PerfilCampo; label: string }[] = [
  { value: "ADMIN", label: "Administrador" },
  { value: "RESPONSAVEL", label: "Responsável" },
  { value: "MEMBRO", label: "Membro" },
];

interface PipelineBpm {
  id: string;
  nome: string;
  etapas: EtapaBpm[];
  campos: CampoBpm[];
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
  CLIENTE: ["cnpj", "razaoSocial", "nomeFantasia", "uf", "municipio", "regimeTributario", "status"],
  CONTATO: ["nome", "cpf", "celular", "email", "telefoneExtra", "vinculo", "cargo"],
  PARCEIRO: ["documento", "nome", "nomeFantasia", "email", "telefone", "segmento", "ativo"],
  CONTRATO: ["valorContrato", "formaPagamento", "servico", "status", "contratoUrl"],
  SERVICO: ["id", "nome"],
  PROCESSO: ["id", "status", "dataInicio", "dataProtocolo", "dataExito", "tentativas"],
  CARD: ["id", "servico", "tipoProcesso", "status", "responsavelId", "createdAt"],
};

const inputCls = "bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20";

export default function AdminPipelineClient({
  pipeline,
  transicoesIniciais,
  configuracoesSlaIniciais,
  servicosComerciais,
  pipelinesDisponiveis,
  visual,
}: {
  pipeline: PipelineBpm;
  transicoesIniciais: TransicaoBpm[];
  configuracoesSlaIniciais: SlaConfiguracaoAdmin[];
  servicosComerciais: { id: number; nome: string }[];
  pipelinesDisponiveis: { id: string; nome: string }[];
  visual: TemaAlpha;
}) {
  const accent = visual.accent;
  const router = useRouter();
  const [etapas, setEtapas] = useState(pipeline.etapas.slice().sort((a, b) => a.ordem - b.ordem));
  const [campos, setCampos] = useState(pipeline.campos);
  const [transicoes, setTransicoes] = useState(transicoesIniciais);
  const [novaEtapaNome, setNovaEtapaNome] = useState("");
  const [novoCampoNome, setNovoCampoNome] = useState("");
  const [novoCampoTipo, setNovoCampoTipo] = useState("texto");
  const [novoCampoEtapaId, setNovoCampoEtapaId] = useState<string>("");
  const [novoCampoObrigatorio, setNovoCampoObrigatorio] = useState(false);
  const [novoCampoOpcoes, setNovoCampoOpcoes] = useState("");
  const [novoCampoEscopo, setNovoCampoEscopo] = useState("CARD");
  const [novoCampoFonteEntidade, setNovoCampoFonteEntidade] = useState("CLIENTE");
  const [novoCampoFonteAtributo, setNovoCampoFonteAtributo] = useState("cnpj");
  const [novoCampoValorPadrao, setNovoCampoValorPadrao] = useState("");
  const [novoCampoSomenteLeitura, setNovoCampoSomenteLeitura] = useState(false);
  const [novoCampoPipelineIds, setNovoCampoPipelineIds] = useState<string[]>([pipeline.id]);
  const [editandoCampoId, setEditandoCampoId] = useState<string | null>(null);
  const [editCampoNome, setEditCampoNome] = useState("");
  const [editCampoTipo, setEditCampoTipo] = useState("texto");
  const [editCampoEtapaId, setEditCampoEtapaId] = useState<string>("");
  const [editCampoObrigatorio, setEditCampoObrigatorio] = useState(false);
  const [editCampoOpcoes, setEditCampoOpcoes] = useState<OpcaoCampoAdmin[]>([]);
  const [editCampoEscopo, setEditCampoEscopo] = useState("CARD");
  const [editCampoFonteEntidade, setEditCampoFonteEntidade] = useState("CLIENTE");
  const [editCampoFonteAtributo, setEditCampoFonteAtributo] = useState("cnpj");
  const [editCampoValorPadrao, setEditCampoValorPadrao] = useState("");
  const [editCampoVisivel, setEditCampoVisivel] = useState(true);
  const [editCampoEditavel, setEditCampoEditavel] = useState(true);
  const [editCampoSomenteLeitura, setEditCampoSomenteLeitura] = useState(false);
  const [editCampoPipelineIds, setEditCampoPipelineIds] = useState<string[]>([pipeline.id]);
  const [editCampoEtapaConfigs, setEditCampoEtapaConfigs] = useState<ConfigEtapaCampo[]>([]);
  const [editCampoAcessos, setEditCampoAcessos] = useState<AcessoCampo[]>([]);
  const [editMapOrigemId, setEditMapOrigemId] = useState("");
  const [editMapModo, setEditMapModo] = useState("COPIAR");
  const [buscaCampo, setBuscaCampo] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<"TODOS" | "ATIVOS" | "INATIVOS">("TODOS");
  const [erro, setErro] = useState<string | null>(null);
  const gruposCampos = useMemo(() => {
    const termo = buscaCampo.trim().toLocaleLowerCase("pt-BR");
    const filtrados = campos.filter((campo) =>
      (!termo || `${campo.nome} ${campo.tipo}`.toLocaleLowerCase("pt-BR").includes(termo))
      && (filtroAtivo === "TODOS" || (filtroAtivo === "ATIVOS" ? campo.ativo !== false : campo.ativo === false)),
    );
    return agruparCamposPorColuna(filtrados, etapas);
  }, [buscaCampo, campos, etapas, filtroAtivo]);

  async function handleCriarEtapa() {
    if (!novaEtapaNome.trim()) return;
    const res = await CriarEtapaBpm({ pipelineId: pipeline.id, nome: novaEtapaNome, ordem: etapas.length });
    if (res.success && res.data) {
      setEtapas((prev) => [...prev, { ...res.data, subStatus: [] }]);
      setNovaEtapaNome("");
    } else {
      setErro(typeof res.error === "string" ? res.error : "Erro ao criar etapa");
    }
  }

  async function handleAtualizarSla(etapaId: string, slaDias: number | null) {
    setEtapas((prev) => prev.map((e) => (e.id === etapaId ? { ...e, slaDias } : e)));
    await AtualizarEtapaBpm({ etapaId, slaDias });
  }

  async function handleRenomearEtapa(etapaId: string, nome: string) {
    setEtapas((prev) => prev.map((e) => (e.id === etapaId ? { ...e, nome } : e)));
    if (!nome.trim()) return;
    const res = await AtualizarEtapaBpm({ etapaId, nome: nome.trim() });
    if (!res.success) {
      setErro(typeof res.error === "string" ? res.error : "Erro ao renomear etapa");
    }
  }

  async function handleMoverEtapa(index: number, direcao: -1 | 1) {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= etapas.length) return;

    const reordenadas = etapas.slice();
    [reordenadas[index], reordenadas[novoIndex]] = [reordenadas[novoIndex], reordenadas[index]];
    const comOrdemAtualizada = reordenadas.map((e, i) => ({ ...e, ordem: i }));
    setEtapas(comOrdemAtualizada);

    await ReordenarEtapasBpm({
      pipelineId: pipeline.id,
      ordem: comOrdemAtualizada.map((e) => ({ etapaId: e.id, ordem: e.ordem })),
    });
    router.refresh();
  }

  async function handleAlterarCorEtapa(etapaId: string, cor: string) {
    setEtapas((prev) => prev.map((e) => (e.id === etapaId ? { ...e, cor } : e)));
    const res = await AtualizarEtapaBpm({ etapaId, cor });
    if (!res.success) {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao atualizar cor da etapa");
    }
  }

  async function handleToggleAtivoEtapa(etapaId: string, ativo: boolean) {
    const res = await AtivarDesativarEtapaBpm({ etapaId, ativo });
    if (res.success) {
      setEtapas((prev) => prev.map((e) => (e.id === etapaId ? { ...e, ativo } : e)));
      toast.success(ativo ? "Etapa ativada" : "Etapa desativada");
      router.refresh();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao atualizar status da etapa");
    }
  }

  function handleEtapasAtualizadas(patch: Record<string, Partial<EtapaBpm>>) {
    setEtapas((prev) => prev.map((e) => (patch[e.id] ? { ...e, ...patch[e.id] } : e)));
  }

  function handleSubStatusAtualizado(sub: SubStatusBpm) {
    setEtapas((prev) =>
      prev.map((e) => {
        if (e.id !== sub.etapaId) return e;
        const existe = e.subStatus.some((s) => s.id === sub.id);
        return {
          ...e,
          subStatus: existe ? e.subStatus.map((s) => (s.id === sub.id ? sub : s)) : [...e.subStatus, sub],
        };
      }),
    );
  }

  function handleTransicaoAtualizada(transicao: TransicaoBpm) {
    setTransicoes((prev) => {
      const existe = prev.some((t) => t.id === transicao.id);
      return existe ? prev.map((t) => (t.id === transicao.id ? transicao : t)) : [...prev, transicao];
    });
  }

  async function handleCriarCampo() {
    if (!novoCampoNome.trim()) return;
    const opcoes =
      TIPOS_COM_OPICOES.has(novoCampoTipo)
        ? novoCampoOpcoes
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    if (TIPOS_COM_OPICOES.has(novoCampoTipo) && opcoes.length === 0) {
      setErro("Campo do tipo Seleção requer ao menos uma opção (uma por linha)");
      return;
    }
    const res = await CriarCampoBpm({
      pipelineId: pipeline.id,
      etapaId: novoCampoEtapaId || undefined,
      nome: novoCampoNome,
      tipo: novoCampoTipo,
      obrigatorio: novoCampoObrigatorio,
      opcoes,
      ordem: campos.length,
      escopo: novoCampoEscopo,
      valorPadrao: novoCampoValorPadrao || null,
      fonteEntidade: novoCampoEscopo === "GLOBAL" && novoCampoFonteEntidade ? novoCampoFonteEntidade : null,
      fonteAtributo: novoCampoEscopo === "GLOBAL" && novoCampoFonteEntidade ? novoCampoFonteAtributo : null,
      entidadeGlobal: novoCampoEscopo === "GLOBAL" && !novoCampoFonteEntidade ? "CLIENTE" : null,
      somenteLeitura: (novoCampoEscopo === "GLOBAL" && Boolean(novoCampoFonteEntidade)) || novoCampoSomenteLeitura,
      editavel: !(novoCampoEscopo === "GLOBAL" && Boolean(novoCampoFonteEntidade)) && !novoCampoSomenteLeitura,
      pipelineIds: novoCampoPipelineIds,
      etapaConfiguracoes: novoCampoEtapaId ? [{
        etapaId: novoCampoEtapaId,
        visivel: true,
        editavel: !(novoCampoEscopo === "GLOBAL" && Boolean(novoCampoFonteEntidade)) && !novoCampoSomenteLeitura,
        somenteLeitura: (novoCampoEscopo === "GLOBAL" && Boolean(novoCampoFonteEntidade)) || novoCampoSomenteLeitura,
        obrigatorio: novoCampoObrigatorio,
        ordem: campos.length,
      }] : [],
    });
    if (res.success && res.data) {
      setCampos((prev) => [...prev, res.data]);
      setNovoCampoNome("");
      setNovoCampoObrigatorio(false);
      setNovoCampoOpcoes("");
      setNovoCampoValorPadrao("");
    } else {
      setErro(typeof res.error === "string" ? res.error : "Erro ao criar campo");
    }
  }

  async function handleToggleObrigatorio(campoId: string, obrigatorio: boolean) {
    setCampos((prev) => prev.map((c) => (c.id === campoId ? { ...c, obrigatorio } : c)));
    await AtualizarCampoBpm({ campoId, obrigatorio });
  }

  /* ===== Editor / Exclusão de campos (D-24) =========================== */
  function abrirEditor(c: CampoBpm) {
    let opcoes: OpcaoCampoAdmin[] = (c.opcoes ?? []).map((opcao) => ({ ...opcao }));
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
    setEditCampoEtapaId(c.etapaId ?? "");
    setEditCampoObrigatorio(c.obrigatorio);
    setEditCampoOpcoes(opcoes.sort((a, b) => a.ordem - b.ordem));
    setEditCampoEscopo(c.escopo ?? "CARD");
    setEditCampoFonteEntidade(c.escopo === "GLOBAL" && !c.fonteEntidade ? "" : (c.fonteEntidade ?? "CLIENTE"));
    setEditCampoFonteAtributo(c.fonteAtributo ?? "cnpj");
    setEditCampoValorPadrao(c.valorPadrao ?? "");
    setEditCampoVisivel(c.visivel ?? true);
    setEditCampoEditavel(c.editavel ?? true);
    setEditCampoSomenteLeitura(c.somenteLeitura ?? false);
    setEditCampoPipelineIds(c.pipelinesAssociados?.map((item) => item.pipelineId) ?? [pipeline.id]);
    setEditCampoEtapaConfigs(c.etapaConfiguracoes?.map((item) => ({
      ...item,
      obrigatorioEntrada: item.obrigatorioEntrada ?? false,
      obrigatorioSaida: item.obrigatorioSaida ?? false,
    })) ?? (c.etapaId ? [{
      etapaId: c.etapaId,
      visivel: c.visivel ?? true,
      editavel: c.editavel ?? true,
      somenteLeitura: c.somenteLeitura ?? false,
      obrigatorio: c.obrigatorio,
      obrigatorioEntrada: false,
      obrigatorioSaida: false,
      ordem: c.ordem,
      grupo: null,
      valorPadrao: null,
      condicaoVisibilidadeJson: null,
      condicaoObrigatoriedadeJson: null,
    }] : []));
    setEditCampoAcessos(PERFIS_CAMPO.map(({ value: perfil }) => c.acessos?.find((item) => item.perfil === perfil) ?? {
      perfil,
      visivel: c.visivel ?? true,
      editavel: c.editavel ?? true,
      somenteLeitura: c.somenteLeitura ?? false,
      obrigatorio: c.obrigatorio,
    }));
    setEditMapOrigemId(c.mapeamentoDestino?.campoOrigemId ?? "");
    setEditMapModo(c.mapeamentoDestino?.modo ?? "COPIAR");
    setEditandoCampoId(c.id);
  }

  function cancelarEdicao() {
    setEditandoCampoId(null);
  }

  async function salvarEdicao(campoId: string) {
    if (!editCampoNome.trim()) {
      setErro("Nome do campo é obrigatório");
      return;
    }
    const opcoes =
      TIPOS_COM_OPICOES.has(editCampoTipo)
        ? editCampoOpcoes
            .filter((opcao) => opcao.rotulo.trim())
            .map((opcao, ordem) => opcao.chave
              ? { ...opcao, rotulo: opcao.rotulo.trim(), ordem }
              : opcao.rotulo.trim())
        : [];
    const res = await AtualizarCampoBpm({
      campoId,
      nome: editCampoNome.trim(),
      tipo: editCampoTipo,
      etapaId: editCampoEtapaId || null,
      obrigatorio: editCampoObrigatorio,
      opcoes,
      escopo: editCampoEscopo,
      valorPadrao: editCampoValorPadrao || null,
      fonteEntidade: editCampoEscopo === "GLOBAL" && editCampoFonteEntidade ? editCampoFonteEntidade : null,
      fonteAtributo: editCampoEscopo === "GLOBAL" && editCampoFonteEntidade ? editCampoFonteAtributo : null,
      entidadeGlobal: editCampoEscopo === "GLOBAL" && !editCampoFonteEntidade ? "CLIENTE" : null,
      visivel: editCampoVisivel,
      editavel: !(editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade)) && !editCampoSomenteLeitura && editCampoEditavel,
      somenteLeitura: (editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade)) || editCampoSomenteLeitura,
      pipelineIds: editCampoPipelineIds,
      etapaConfiguracoes: editCampoEtapaConfigs,
      acessos: editCampoAcessos.map((acesso) => ({
        ...acesso,
        editavel: (editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade)) || acesso.somenteLeitura ? false : acesso.editavel,
        somenteLeitura: (editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade)) || acesso.somenteLeitura,
      })),
    });
    if (res.success) {
      const mapa = editMapOrigemId
        ? await ConfigurarMapeamentoCampoBpm({ campoDestinoId: campoId, campoOrigemId: editMapOrigemId, modo: editMapModo, ativo: true })
        : await DesativarMapeamentoCampoBpm({ campoDestinoId: campoId });
      if (!mapa.success) {
        setErro(typeof mapa.error === "string" ? mapa.error : "Campo salvo, mas o mapeamento foi rejeitado");
        return;
      }
      setCampos((prev) => prev.map((c) => (c.id === campoId ? {
        ...(res.data ?? c),
        nome: editCampoNome.trim(),
        tipo: editCampoTipo,
        etapaId: editCampoEtapaId || null,
        obrigatorio: editCampoObrigatorio,
        pipelinesAssociados: editCampoPipelineIds.map((pipelineId) => ({ pipelineId })),
        etapaConfiguracoes: editCampoEtapaConfigs,
      } : c)));
      router.refresh();
    } else {
      setErro(typeof res.error === "string" ? res.error : "Erro ao salvar campo");
    }
    cancelarEdicao();
  }

  async function alterarAtivacaoCampo(campoId: string, nome: string, ativo: boolean) {
    if (!confirm(`${ativo ? "Ativar" : "Desativar"} o campo "${nome}"? Os valores históricos serão preservados.`)) return;
    const res = await AtivarDesativarCampoBpm({ campoId, ativo });
    if (res.success) {
      setCampos((prev) => prev.map((campo) => campo.id === campoId ? { ...campo, ativo } : campo));
      if (editandoCampoId === campoId) cancelarEdicao();
      router.refresh();
    } else {
      setErro(typeof res.error === "string" ? res.error : "Erro ao alterar ativação do campo");
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-black text-white">Configurar Pipeline — {pipeline.nome}</h1>
        <p className="text-sm text-slate-400 mt-1">Etapas, campos e SLA são exclusivos de administradores.</p>
      </div>

      {erro && (
        <div className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{erro}</div>
      )}

      {pipeline.nome === FINANCIAL_PIPELINE_NAME && (
        hasConfiguredFinancialPipeline(etapas, campos) ? (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200" role="status">
            Pipeline Financeiro configurado com as cinco etapas e campos oficiais.
          </div>
        ) : (
          <ConfigurarEtapasFinanceiroButton
            pipelineId={pipeline.id}
            accent={accent}
            onConfigured={(data) => {
              setEtapas(
                data.etapas.map((e) => ({
                  cor: null,
                  ehInicial: false,
                  ehFinal: false,
                  subStatus: [],
                  ...e,
                })),
              );
              setCampos(
                data.campos.map((c) => ({
                  ...c,
                  opcoesJson: null,
                }))
              );
              router.refresh();
            }}
          />
        )
      )}

      {/* Etapas */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">Etapas</h2>
        <div className="space-y-2">
          {etapas.map((etapa, i) => (
            <div key={etapa.id} className="space-y-1.5">
              <div className="flex items-center gap-3 bg-slate-800/60 border border-white/5 rounded-xl px-3 py-2">
                <GripVertical size={14} className="text-slate-600" />
                <input
                  type="color"
                  value={etapa.cor ?? "#64748b"}
                  onChange={(e) => void handleAlterarCorEtapa(etapa.id, e.target.value)}
                  aria-label={`Cor da etapa ${etapa.nome}`}
                  className="w-7 h-7 rounded border border-white/10 bg-transparent p-0 shrink-0"
                />
                <input
                  aria-label={`Nome da etapa ${etapa.nome}`}
                  className={`${inputCls} flex-1`}
                  value={etapa.nome}
                  onChange={(e) => setEtapas((prev) => prev.map((it) => (it.id === etapa.id ? { ...it, nome: e.target.value } : it)))}
                  onBlur={(e) => handleRenomearEtapa(etapa.id, e.target.value)}
                />
                <label className="flex items-center gap-1.5 text-xs text-slate-400">
                  SLA (dias)
                  <input
                    type="number"
                    min={1}
                    className={`${inputCls} w-16`}
                    value={etapa.slaDias ?? ""}
                    onChange={(e) => handleAtualizarSla(etapa.id, e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleMoverEtapa(i, -1)}
                    disabled={i === 0}
                    className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoverEtapa(i, 1)}
                    disabled={i === etapas.length - 1}
                    className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
                {etapa.ativo ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button aria-label={`Desativar etapa ${etapa.nome}`} title="Desativar etapa" className="inline-flex">
                        <Switch checked size="sm" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Desativar etapa</AlertDialogTitle>
                        <AlertDialogDescription>
                          Desativar &quot;{etapa.nome}&quot; a oculta do board e da seleção de nova etapa. Cards existentes
                          nesta etapa não são movidos automaticamente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleToggleAtivoEtapa(etapa.id, false)}>
                          Desativar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <button
                    aria-label={`Ativar etapa ${etapa.nome}`}
                    title="Ativar etapa"
                    className="inline-flex"
                    onClick={() => void handleToggleAtivoEtapa(etapa.id, true)}
                  >
                    <Switch checked={false} size="sm" />
                  </button>
                )}
              </div>
              <EtapaAvancadaSection
                pipelineId={pipeline.id}
                etapa={etapa}
                todasEtapas={etapas}
                subStatus={etapa.subStatus}
                transicoes={transicoes}
                accent={accent}
                onEtapasAtualizadas={handleEtapasAtualizadas}
                onSubStatusAtualizado={handleSubStatusAtualizado}
                onTransicaoAtualizada={handleTransicaoAtualizada}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={`${inputCls} flex-1`}
            placeholder="Nome da nova etapa"
            value={novaEtapaNome}
            onChange={(e) => setNovaEtapaNome(e.target.value)}
          />
          <button
            onClick={handleCriarEtapa}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: `rgba(${accent},0.85)` }}
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </section>

      <VisibilidadeEtapasSection
        pipelineId={pipeline.id}
        etapas={etapas}
        accent={accent}
      />

      <SlaConfigSection
        pipelineId={pipeline.id}
        pipelineNome={pipeline.nome}
        etapas={etapas}
        servicos={servicosComerciais}
        configuracoesIniciais={configuracoesSlaIniciais}
      />

      {/* Campos personalizados */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wide">Campos Personalizados</h2>
            <p className="text-xs text-slate-500">Tipos, escopo, acesso por etapa, fontes canônicas e mapeamentos.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" aria-hidden="true" />
              <input aria-label="Buscar campos" className={`${inputCls} pl-8`} value={buscaCampo} onChange={(event) => setBuscaCampo(event.target.value)} placeholder="Buscar campo" />
            </label>
            <select aria-label="Filtrar campos por status" className={inputCls} value={filtroAtivo} onChange={(event) => setFiltroAtivo(event.target.value as typeof filtroAtivo)}>
              <option value="TODOS">Todos</option><option value="ATIVOS">Ativos</option><option value="INATIVOS">Inativos</option>
            </select>
          </div>
        </div>
        <div className="space-y-4">
          {gruposCampos.map((grupo) => (
            <div key={grupo.id} className="overflow-hidden rounded-2xl border border-white/5 bg-slate-900/35">
              <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
                <div>
                  <h3 className="text-sm font-bold text-white">{grupo.nome}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Campos configurados nesta coluna</p>
                </div>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                  {grupo.campos.length} {grupo.campos.length === 1 ? "campo" : "campos"}
                </span>
              </div>

              {grupo.campos.length === 0 ? (
                <p className="px-4 py-5 text-sm text-slate-500">Nenhum campo configurado nesta coluna</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {grupo.campos.map((campo) => {
                    const editando = editandoCampoId === campo.id;
                    return (
                      <div key={campo.id} className={`bg-slate-800/40 ${campo.ativo === false ? "opacity-55" : ""}`}>
                        <div className="flex items-center gap-3 px-3 py-2">
                          <span className="flex-1 text-sm text-white">{campo.nome}</span>
                          <span className="text-xs text-slate-500">{campo.tipo}</span>
                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{campo.escopo === "GLOBAL" ? "Global" : "Card"}</span>
                          <label className="flex items-center gap-1.5 text-xs text-slate-400">
                            <input
                              type="checkbox"
                              disabled={editando}
                              checked={campo.obrigatorio}
                              onChange={(e) => handleToggleObrigatorio(campo.id, e.target.checked)}
                            />
                            Obrigatório
                          </label>
                          <button
                            onClick={() => (editando ? cancelarEdicao() : abrirEditor(campo))}
                            className="p-1.5 rounded text-slate-400 hover:text-white"
                            aria-label={editando ? "Cancelar edição do campo" : `Editar campo ${campo.nome}`}
                            title={editando ? "Cancelar edição" : "Editar campo"}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => void alterarAtivacaoCampo(campo.id, campo.nome, campo.ativo === false)}
                            disabled={editando}
                            className="p-1.5 rounded text-slate-400 hover:text-amber-300 disabled:opacity-30"
                            aria-label={`${campo.ativo === false ? "Ativar" : "Desativar"} campo ${campo.nome}`}
                            title={campo.ativo === false ? "Ativar campo" : "Desativar campo"}
                          >
                            <Power size={14} />
                          </button>
                        </div>

                        {editando && (
                          <div className="border-t border-white/10 px-3 py-3 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <label className="space-y-1 text-xs text-slate-400">
                                <span>Nome</span>
                                <input className={inputCls + " w-full"} value={editCampoNome} onChange={(e) => setEditCampoNome(e.target.value)} />
                              </label>
                              <label className="space-y-1 text-xs text-slate-400">
                                <span>Tipo</span>
                                <select className={inputCls + " w-full"} value={editCampoTipo} onChange={(e) => setEditCampoTipo(e.target.value)}>
                                  {TIPOS_CAMPO.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="space-y-1 text-xs text-slate-400">
                                <span>Etapa</span>
                                <select className={inputCls + " w-full"} value={editCampoEtapaId} onChange={(e) => setEditCampoEtapaId(e.target.value)}>
                                  <option value="">Todas as etapas</option>
                                  {etapas.map((e) => (
                                    <option key={e.id} value={e.id}>{e.nome}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="space-y-1 text-xs text-slate-400 flex items-end">
                                <span />
                                <span className="flex items-center gap-1.5 text-slate-400 pb-2">
                                  <input type="checkbox" checked={editCampoObrigatorio} onChange={(e) => setEditCampoObrigatorio(e.target.checked)} />
                                  Obrigatório
                                </span>
                              </label>
                              {TIPOS_COM_OPICOES.has(editCampoTipo) && (
                                <fieldset className="sm:col-span-2 space-y-2 rounded-lg border border-white/10 p-2 text-xs text-slate-400">
                                  <legend className="px-1">Opções estruturadas</legend>
                                  {editCampoOpcoes.map((opcao, indice) => (
                                    <div key={opcao.id ?? opcao.chave ?? `nova-${indice}`} className="flex items-center gap-2">
                                      <input
                                        className={inputCls + " flex-1"}
                                        value={opcao.rotulo}
                                        onChange={(event) => setEditCampoOpcoes((atuais) => atuais.map((item, atual) => atual === indice ? { ...item, rotulo: event.target.value } : item))}
                                      />
                                      <label className="whitespace-nowrap"><input type="checkbox" checked={opcao.ativo} onChange={(event) => setEditCampoOpcoes((atuais) => atuais.map((item, atual) => atual === indice ? { ...item, ativo: event.target.checked } : item))} /> Ativa</label>
                                      <button type="button" disabled={indice === 0} className="rounded border border-white/10 px-2 py-1 disabled:opacity-30" onClick={() => setEditCampoOpcoes((atuais) => {
                                        const novas = [...atuais];
                                        [novas[indice - 1], novas[indice]] = [novas[indice], novas[indice - 1]];
                                        return novas.map((item, ordem) => ({ ...item, ordem }));
                                      })}>↑</button>
                                      <button type="button" disabled={indice === editCampoOpcoes.length - 1} className="rounded border border-white/10 px-2 py-1 disabled:opacity-30" onClick={() => setEditCampoOpcoes((atuais) => {
                                        const novas = [...atuais];
                                        [novas[indice], novas[indice + 1]] = [novas[indice + 1], novas[indice]];
                                        return novas.map((item, ordem) => ({ ...item, ordem }));
                                      })}>↓</button>
                                    </div>
                                  ))}
                                  <button type="button" className="rounded border border-white/10 px-2 py-1 text-slate-300 hover:text-white" onClick={() => setEditCampoOpcoes((atuais) => [...atuais, { rotulo: "", ordem: atuais.length, ativo: true }])}>
                                    Adicionar opção
                                  </button>
                                  <p className="text-[10px] text-slate-500">Desative em vez de excluir para preservar valores e histórico.</p>
                                </fieldset>
                              )}
                              <label className="space-y-1 text-xs text-slate-400">
                                <span>Escopo</span>
                                <select className={inputCls + " w-full"} value={editCampoEscopo} onChange={(event) => setEditCampoEscopo(event.target.value)}>
                                  <option value="CARD">Específico do card</option><option value="GLOBAL">Dado global canônico</option>
                                </select>
                              </label>
                              <label className="space-y-1 text-xs text-slate-400">
                                <span>Valor padrão</span>
                                <input className={inputCls + " w-full"} value={editCampoValorPadrao} onChange={(event) => setEditCampoValorPadrao(event.target.value)} />
                              </label>
                              {editCampoEscopo === "GLOBAL" && (
                                <>
                                  <label className="space-y-1 text-xs text-slate-400">
                                    <span>Entidade canônica</span>
                                    <select className={inputCls + " w-full"} value={editCampoFonteEntidade} onChange={(event) => { setEditCampoFonteEntidade(event.target.value); setEditCampoFonteAtributo(FONTES_ATRIBUTOS[event.target.value]?.[0] ?? ""); }}>
                                      <option value="">Valor global personalizado do cliente</option>
                                      {Object.keys(FONTES_ATRIBUTOS).map((fonte) => <option key={fonte}>{fonte}</option>)}
                                    </select>
                                  </label>
                                  {editCampoFonteEntidade && <label className="space-y-1 text-xs text-slate-400">
                                    <span>Atributo canônico</span>
                                    <select className={inputCls + " w-full"} value={editCampoFonteAtributo} onChange={(event) => setEditCampoFonteAtributo(event.target.value)}>
                                      {(FONTES_ATRIBUTOS[editCampoFonteEntidade] ?? []).map((atributo) => <option key={atributo}>{atributo}</option>)}
                                    </select>
                                  </label>}
                                </>
                              )}
                              <label className="space-y-1 text-xs text-slate-400">
                                <span>Pipelines (Ctrl/Cmd para múltiplos)</span>
                                <select multiple className={inputCls + " min-h-24 w-full"} value={editCampoPipelineIds} onChange={(event) => setEditCampoPipelineIds(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>
                                  {pipelinesDisponiveis.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                                </select>
                              </label>
                              <label className="space-y-1 text-xs text-slate-400">
                                <span>Etapas (vazio = todas)</span>
                                <select multiple className={inputCls + " min-h-24 w-full"} value={editCampoEtapaConfigs.map((item) => item.etapaId)} onChange={(event) => {
                                  const selecionadas = Array.from(event.currentTarget.selectedOptions, (option) => option.value);
                                  setEditCampoEtapaConfigs((atuais) => selecionadas.map((etapaId, ordem) => atuais.find((item) => item.etapaId === etapaId) ?? {
                                    etapaId,
                                    visivel: true,
                                    editavel: !(editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade)) && !editCampoSomenteLeitura,
                                    somenteLeitura: (editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade)) || editCampoSomenteLeitura,
                                    obrigatorio: false,
                                    obrigatorioEntrada: false,
                                    obrigatorioSaida: false,
                                    ordem,
                                    grupo: null,
                                    valorPadrao: null,
                                    condicaoVisibilidadeJson: null,
                                    condicaoObrigatoriedadeJson: null,
                                  }));
                                }}>
                                  {etapas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                                </select>
                              </label>
                              {editCampoEtapaConfigs.length > 0 && (
                                <fieldset className="sm:col-span-2 space-y-3 rounded-lg border border-sky-400/20 bg-sky-400/[0.03] p-3 text-xs text-slate-400">
                                  <legend className="px-1 font-semibold text-sky-200">Configuração por etapa</legend>
                                  {editCampoEtapaConfigs.map((config, indice) => {
                                    const etapa = etapas.find((item) => item.id === config.etapaId);
                                    const atualizar = (patch: Partial<ConfigEtapaCampo>) => setEditCampoEtapaConfigs((atuais) => atuais.map((item) => item.etapaId === config.etapaId ? {
                                      ...item,
                                      ...patch,
                                      editavel: patch.somenteLeitura ? false : (patch.editavel ?? item.editavel),
                                    } : item));
                                    return (
                                      <div key={config.etapaId} className="space-y-2 rounded-lg border border-white/10 bg-slate-950/30 p-3">
                                        <div className="flex items-center justify-between gap-2">
                                          <strong className="text-slate-200">{etapa?.nome ?? config.etapaId}</strong>
                                          <label className="flex items-center gap-1">Ordem <input type="number" min={0} className={inputCls + " w-20"} value={config.ordem} onChange={(event) => atualizar({ ordem: Number(event.target.value) || 0 })} /></label>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                          <label><input type="checkbox" checked={config.visivel} onChange={(event) => atualizar({ visivel: event.target.checked })} /> Visível</label>
                                          <label><input type="checkbox" checked={config.editavel} disabled={config.somenteLeitura || (editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade))} onChange={(event) => atualizar({ editavel: event.target.checked })} /> Editável</label>
                                          <label><input type="checkbox" checked={config.somenteLeitura || (editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade))} disabled={editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade)} onChange={(event) => atualizar({ somenteLeitura: event.target.checked })} /> Somente leitura</label>
                                          <label><input type="checkbox" checked={config.obrigatorio} onChange={(event) => atualizar({ obrigatorio: event.target.checked })} /> Obrigatório na etapa</label>
                                          <label><input type="checkbox" checked={config.obrigatorioEntrada} onChange={(event) => atualizar({ obrigatorioEntrada: event.target.checked })} /> Obrigatório para entrar</label>
                                          <label><input type="checkbox" checked={config.obrigatorioSaida} onChange={(event) => atualizar({ obrigatorioSaida: event.target.checked })} /> Obrigatório para sair</label>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                          <label className="space-y-1"><span>Grupo/seção</span><input className={inputCls + " w-full"} value={config.grupo ?? ""} onChange={(event) => atualizar({ grupo: event.target.value || null })} /></label>
                                          <label className="space-y-1"><span>Valor padrão nesta etapa</span><input className={inputCls + " w-full"} value={config.valorPadrao ?? ""} onChange={(event) => atualizar({ valorPadrao: event.target.value || null })} /></label>
                                          <label className="space-y-1 sm:col-span-2"><span>Condição de visibilidade (JSON do Motor de Regras)</span><textarea rows={3} className={inputCls + " w-full font-mono text-[11px]"} value={config.condicaoVisibilidadeJson ?? ""} onChange={(event) => atualizar({ condicaoVisibilidadeJson: event.target.value || null })} /></label>
                                          <label className="space-y-1 sm:col-span-2"><span>Condição de obrigatoriedade (JSON do Motor de Regras)</span><textarea rows={3} className={inputCls + " w-full font-mono text-[11px]"} value={config.condicaoObrigatoriedadeJson ?? ""} onChange={(event) => atualizar({ condicaoObrigatoriedadeJson: event.target.value || null })} /></label>
                                        </div>
                                        <span className="sr-only">Configuração {indice + 1}</span>
                                      </div>
                                    );
                                  })}
                                </fieldset>
                              )}
                              <fieldset className="sm:col-span-2 flex flex-wrap gap-4 rounded-lg border border-white/10 p-2 text-xs text-slate-400">
                                <legend className="px-1">Acesso padrão</legend>
                                <label><input type="checkbox" checked={editCampoVisivel} onChange={(event) => setEditCampoVisivel(event.target.checked)} /> Visível</label>
                                <label><input type="checkbox" checked={editCampoEditavel} disabled={editCampoSomenteLeitura || (editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade))} onChange={(event) => setEditCampoEditavel(event.target.checked)} /> Editável</label>
                                <label><input type="checkbox" checked={editCampoSomenteLeitura || (editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade))} disabled={editCampoEscopo === "GLOBAL" && Boolean(editCampoFonteEntidade)} onChange={(event) => setEditCampoSomenteLeitura(event.target.checked)} /> Somente leitura</label>
                              </fieldset>
                              <fieldset className="sm:col-span-2 space-y-2 rounded-lg border border-white/10 p-2 text-xs text-slate-400">
                                <legend className="px-1">Acesso por perfil</legend>
                                {PERFIS_CAMPO.map(({ value: perfil, label }) => {
                                  const acesso = editCampoAcessos.find((item) => item.perfil === perfil);
                                  if (!acesso) return null;
                                  const atualizar = (patch: Partial<AcessoCampo>) => setEditCampoAcessos((atuais) => atuais.map((item) => item.perfil === perfil ? {
                                    ...item,
                                    ...patch,
                                    editavel: patch.somenteLeitura ? false : (patch.editavel ?? item.editavel),
                                  } : item));
                                  return (
                                    <div key={perfil} className="flex flex-wrap items-center gap-3">
                                      <span className="w-28 font-semibold text-slate-300">{label}</span>
                                      <label><input type="checkbox" checked={acesso.visivel} onChange={(event) => atualizar({ visivel: event.target.checked })} /> Visível</label>
                                      <label><input type="checkbox" checked={acesso.editavel} disabled={acesso.somenteLeitura} onChange={(event) => atualizar({ editavel: event.target.checked })} /> Editável</label>
                                      <label><input type="checkbox" checked={acesso.somenteLeitura} onChange={(event) => atualizar({ somenteLeitura: event.target.checked })} /> Somente leitura</label>
                                      <label><input type="checkbox" checked={acesso.obrigatorio} onChange={(event) => atualizar({ obrigatorio: event.target.checked })} /> Obrigatório</label>
                                    </div>
                                  );
                                })}
                              </fieldset>
                              <label className="space-y-1 text-xs text-slate-400">
                                <span>Mapear a partir de</span>
                                <select className={inputCls + " w-full"} value={editMapOrigemId} onChange={(event) => setEditMapOrigemId(event.target.value)}>
                                  <option value="">Sem mapeamento</option>
                                  {campos.filter((item) => item.id !== campo.id && item.tipo === editCampoTipo).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                                </select>
                              </label>
                              <label className="space-y-1 text-xs text-slate-400">
                                <span>Modo do mapeamento</span>
                                <select className={inputCls + " w-full"} value={editMapModo} disabled={!editMapOrigemId} onChange={(event) => setEditMapModo(event.target.value)}>
                                  <option value="COPIAR">Copiar snapshot</option><option value="SINCRONIZAR">Sincronizar origem → destino</option><option value="REFERENCIAR">Referenciar origem</option>
                                </select>
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => void salvarEdicao(campo.id)} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ background: `rgba(${accent},0.85)` }}>
                                Salvar
                              </button>
                              <button onClick={cancelarEdicao} className="px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white">
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
          <select className={inputCls} value={novoCampoTipo} onChange={(e) => setNovoCampoTipo(e.target.value)}>
            {TIPOS_CAMPO.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
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
          <select className={inputCls} value={novoCampoEtapaId} onChange={(e) => setNovoCampoEtapaId(e.target.value)}>
            <option value="">Todas as etapas</option>
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
          <select aria-label="Escopo do novo campo" className={inputCls} value={novoCampoEscopo} onChange={(event) => setNovoCampoEscopo(event.target.value)}>
            <option value="CARD">Card</option><option value="GLOBAL">Global</option>
          </select>
          <input className={inputCls} placeholder="Valor padrão" value={novoCampoValorPadrao} onChange={(event) => setNovoCampoValorPadrao(event.target.value)} />
          {novoCampoEscopo === "GLOBAL" && (
            <>
              <select aria-label="Entidade canônica" className={inputCls} value={novoCampoFonteEntidade} onChange={(event) => { setNovoCampoFonteEntidade(event.target.value); setNovoCampoFonteAtributo(FONTES_ATRIBUTOS[event.target.value]?.[0] ?? ""); }}>
                <option value="">Valor global personalizado do cliente</option>
                {Object.keys(FONTES_ATRIBUTOS).map((fonte) => <option key={fonte}>{fonte}</option>)}
              </select>
              {novoCampoFonteEntidade && <select aria-label="Atributo canônico" className={inputCls} value={novoCampoFonteAtributo} onChange={(event) => setNovoCampoFonteAtributo(event.target.value)}>
                {(FONTES_ATRIBUTOS[novoCampoFonteEntidade] ?? []).map((atributo) => <option key={atributo}>{atributo}</option>)}
              </select>}
            </>
          )}
          <label className="space-y-1 text-xs text-slate-400">
            <span>Pipelines</span>
            <select multiple className={`${inputCls} min-h-20`} value={novoCampoPipelineIds} onChange={(event) => setNovoCampoPipelineIds(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>
              {pipelinesDisponiveis.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input type="checkbox" checked={novoCampoObrigatorio} onChange={(e) => setNovoCampoObrigatorio(e.target.checked)} />
            Obrigatório
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input type="checkbox" checked={novoCampoSomenteLeitura || (novoCampoEscopo === "GLOBAL" && Boolean(novoCampoFonteEntidade))} disabled={novoCampoEscopo === "GLOBAL" && Boolean(novoCampoFonteEntidade)} onChange={(e) => setNovoCampoSomenteLeitura(e.target.checked)} />
            Somente leitura
          </label>
          <button
            onClick={handleCriarCampo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: `rgba(${accent},0.85)` }}
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </section>
    </div>
  );
}
