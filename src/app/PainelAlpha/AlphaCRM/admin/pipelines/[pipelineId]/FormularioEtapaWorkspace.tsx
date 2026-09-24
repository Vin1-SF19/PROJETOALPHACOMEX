"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  CalendarClock,
  Check,
  FileText,
  Eye,
  Layers3,
  Pencil,
  Search,
  Settings2,
  ShieldCheck,
  Loader2,
  Plus,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { ListaCamposFormulario } from "./ListaCamposFormulario";
import { moverItemFormulario } from "@/lib/bpm/ordem-formulario";

import { PipelineEditorStateBoundary, usePipelineEditorState } from "./PipelineEditorStateProvider";
import { AtualizarCampoBpm, CriarCampoBpm, ExcluirCampoBpm, ObterUsoCamposBpm } from "@/actions/bpm/Campos";
import { SalvarFormularioEtapaBpm } from "@/actions/bpm/FormulariosEtapa";
import { FormularioEtapaRenderer } from "@/app/PainelAlpha/AlphaCRM/CardModal/FormularioEtapaRenderer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resolverFormularioEtapa } from "@/lib/bpm/formulario-renderer";
import {
  obterDefinicaoComponenteFormulario,
  listarInventarioComponentesFormulario,
} from "@/lib/bpm/formularios-etapa";

type CampoFormulario = { id: string; nome: string; tipo: string };
export type ComponenteFormulario = {
  clientId?: string;
  id?: string;
  chave: string;
  tipo: string;
  campoId: string | null;
  capability: string | null;
  configJson: string | null;
  ordem?: number;
  campo?: CampoFormulario | null;
};
export type SecaoFormulario = {
  id?: string;
  chave: string;
  titulo: string;
  ordem?: number;
  componentes: ComponenteFormulario[];
};
export type FormularioEtapaAdmin = {
  id: string;
  ativo: boolean;
  versao: number;
  secoes: SecaoFormulario[];
};

type EtapaFormulario = {
  id: string;
  nome: string;
  ativo: boolean;
  cor?: string | null;
  chave?: string | null;
  capabilitiesJson?: string | null;
  formulario?: FormularioEtapaAdmin | null;
};

type CampoAplicavel = CampoFormulario & {
  ativo?: boolean;
  editavel?: boolean;
  somenteLeitura?: boolean;
  pipelineId?: string;
  pipelinesAssociados?: Array<{ pipelineId: string; pipeline?: { nome: string } }>;
  etapaConfiguracoes?: Array<{
    etapaId: string;
    visivel: boolean;
    editavel?: boolean;
    somenteLeitura?: boolean;
    obrigatorio?: boolean;
    obrigatorioEntrada?: boolean;
    obrigatorioSaida?: boolean;
    ordem?: number;
    grupo?: string | null;
    valorPadrao?: string | null;
    condicaoVisibilidadeJson?: string | null;
    condicaoObrigatoriedadeJson?: string | null;
  }>;
};

type UsoCampo = { valoresCard: number; valoresGlobais: number; anexos: number; formularios: number; etapas: number };

const TIPOS_CAMPO = [
  ["texto", "Texto curto"],
  ["texto_longo", "Texto longo"],
  ["numero", "Número"],
  ["moeda", "Moeda"],
  ["percentual", "Percentual"],
  ["data", "Data"],
  ["data_hora", "Data e hora"],
  ["booleano", "Sim ou não"],
  ["selecao", "Seleção única"],
  ["multiselecao", "Seleção múltipla"],
  ["cnpj", "CNPJ"],
  ["cpf", "CPF"],
  ["email", "E-mail"],
  ["telefone", "Telefone"],
  ["url", "Link/URL"],
  ["arquivo", "Arquivo"],
] as const;

function mensagemErroCampo(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object")
    return "Não foi possível salvar o campo";
  const fieldErrors = (error as { fieldErrors?: Record<string, string[]> })
    .fieldErrors;
  const primeira =
    fieldErrors && Object.values(fieldErrors).flat().find(Boolean);
  return primeira ?? "Não foi possível salvar o campo";
}

function secoesDaEtapa(etapa: EtapaFormulario | undefined): SecaoFormulario[] {
  return (etapa?.formulario?.secoes ?? []).map((secao) => ({
    ...secao,
    componentes: secao.componentes.map((componente) => ({ ...componente, clientId: componente.clientId ?? `${secao.chave}:${componente.chave}` })),
  }));
}

function mover<T>(itens: T[], indice: number, direcao: -1 | 1): T[] {
  const destino = indice + direcao;
  if (destino < 0 || destino >= itens.length) return itens;
  const copia = [...itens];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

function configComponente(
  componente: ComponenteFormulario,
): Record<string, unknown> {
  if (!componente.configJson) return {};
  try {
    const config: unknown = JSON.parse(componente.configJson);
    return config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function rotuloPersonalizado(componente: ComponenteFormulario): string {
  const label = configComponente(componente).label;
  return typeof label === "string" ? label : "";
}

function aplicarRotulo(
  componente: ComponenteFormulario,
  label: string,
): ComponenteFormulario {
  const config = configComponente(componente);
  const normalizado = label.slice(0, 120);
  if (normalizado.trim()) config.label = normalizado;
  else delete config.label;
  return {
    ...componente,
    configJson: Object.keys(config).length ? JSON.stringify(config) : null,
  };
}

function FormularioEtapaWorkspaceContent({
  pipelineId,
  pipelineNome,
  etapas,
  campos,
  onFormularioAtualizado,
  modo = "formulario",
  publicationBlocked = false,
  onPublished,
}: {
  pipelineId: string;
  pipelineNome?: string;
  etapas: EtapaFormulario[];
  campos: CampoAplicavel[];
  onFormularioAtualizado: (
    etapaId: string,
    formulario: FormularioEtapaAdmin,
  ) => void;
  modo?: "formulario" | "card";
  publicationBlocked?: boolean;
  onPublished?: () => void;
}) {
  const scope = `${pipelineId}:${modo}`;
  const [etapaEscolhida, setEtapaId] = usePipelineEditorState(`${scope}:etapa`, etapas[0]?.id ?? "");
  const etapa = etapas.find((item) => item.id === etapaEscolhida) ?? etapas[0];
  const etapaId = etapa?.id ?? "";
  const draftKey = `${scope}:${etapaId}`;
  const [secoes, setSecoes] = usePipelineEditorState<SecaoFormulario[]>(`${draftKey}:secoes`, () => secoesDaEtapa(etapa));
  const [ativo, setAtivo] = usePipelineEditorState(`${draftKey}:ativo`, etapa?.formulario?.ativo ?? true);
  const [salvando, setSalvando] = usePipelineEditorState(`${draftKey}:salvando`, false);
  const [sujo, setSujo] = usePipelineEditorState(`${draftKey}:sujo`, false);
  const [versaoBase, setVersaoBase] = usePipelineEditorState<number | null>(`${draftKey}:versao`, etapa?.formulario?.versao ?? null);
  const [obrigacoesDraft, setObrigacoesDraft] = usePipelineEditorState<Record<string, { obrigatorio: boolean; obrigatorioEntrada: boolean; obrigatorioSaida: boolean }>>(`${draftKey}:obrigacoes`, () => Object.fromEntries(campos.map((campo) => {
    const config = campo.etapaConfiguracoes?.find((item) => item.etapaId === etapaId);
    return [campo.id, { obrigatorio: config?.obrigatorio ?? false, obrigatorioEntrada: config?.obrigatorioEntrada ?? false, obrigatorioSaida: config?.obrigatorioSaida ?? false }];
  })));
  const [camposCriados, setCamposLocais] = usePipelineEditorState<CampoAplicavel[]>(`${scope}:campos`, []);
  const camposLocais = useMemo(() => [...new Map([...campos, ...camposCriados].map((campo) => [campo.id, campo])).values()], [campos, camposCriados]);
  const [secaoNovoCampo, setSecaoNovoCampo] = usePipelineEditorState<number | null>(`${draftKey}:nova-secao`, null);
  const [nomeNovoCampo, setNomeNovoCampo] = usePipelineEditorState(`${draftKey}:nome`, "");
  const [tipoNovoCampo, setTipoNovoCampo] = usePipelineEditorState<(typeof TIPOS_CAMPO)[number][0]>(`${draftKey}:tipo`, "texto");
  const [opcoesNovoCampo, setOpcoesNovoCampo] = usePipelineEditorState(`${draftKey}:opcoes`, "");
  const [criandoCampo, setCriandoCampo] = usePipelineEditorState(`${draftKey}:criando`, false);
  const [campoParaExcluir, setCampoParaExcluir] = useState<string | null>(null);
  const [blocoParaRemover, setBlocoParaRemover] = useState<{ secaoChave: string; capability: string; label: string } | null>(null);
  const [camposExcluidos, setCamposExcluidos] = useState<string[]>([]);
  const [excluindoCampo, setExcluindoCampo] = useState(false);
  const [campoSelecionadoId, setCampoSelecionadoId] = useState<string | null>(null);
  const [blocoSelecionado, setBlocoSelecionado] = useState<{ secaoChave: string; chave: string } | null>(null);
  const deepLinkAplicado = useRef(false);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [salvandoCampo, setSalvandoCampo] = useState(false);
  const [habilitandoCampo, setHabilitandoCampo] = useState(false);
  const [usoCampos, setUsoCampos] = useState<Record<string, UsoCampo> | null>(null);
  const [erroUso, setErroUso] = useState(false);
  const [buscaCampo, setBuscaCampo] = useState("");
  const [secaoSelecionadaChave, setSecaoSelecionadaChave] = usePipelineEditorState(`${draftKey}:secao-selecionada`, secoes[0]?.chave ?? "");
  const indiceSecaoSelecionada = Math.max(0, secoes.findIndex((secao) => secao.chave === secaoSelecionadaChave));
  const secaoSelecionada = secoes[indiceSecaoSelecionada];
  const [mostrarPreview, setMostrarPreview] = useState(true);
  const publicandoRef = useRef(false);
  const bloqueado = publicationBlocked || salvando || criandoCampo || excluindoCampo || salvandoCampo || habilitandoCampo;

  useEffect(() => {
    if (deepLinkAplicado.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") !== "fields") return;
    const etapaDaUrl = params.get("etapaId");
    if (!etapaDaUrl || !etapas.some((item) => item.id === etapaDaUrl)) return;
    const campoDaUrl = campos.find((item) => item.id === params.get("campoId"));
    const timer = window.setTimeout(() => {
      if (deepLinkAplicado.current) return;
      deepLinkAplicado.current = true;
      setEtapaId(etapaDaUrl);
      if (campoDaUrl) {
        setCampoSelecionadoId(campoDaUrl.id);
        setNomeEdicao(campoDaUrl.nome);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [etapas, campos, setEtapaId]);

  useEffect(() => {
    let vigente = true;
    ObterUsoCamposBpm(pipelineId).then((resposta) => {
      if (!vigente) return;
      if (resposta.success && resposta.data) setUsoCampos(resposta.data);
      else setErroUso(true);
    }).catch(() => { if (vigente) setErroUso(true); });
    return () => { vigente = false; };
  }, [pipelineId]);

  useEffect(() => {
    if (etapaEscolhida !== etapaId) setEtapaId(etapaId);
    if (!sujo && !salvando && !criandoCampo && (etapa?.formulario?.versao ?? 0) > (versaoBase ?? 0)) {
      setSecoes(secoesDaEtapa(etapa));
      setAtivo(etapa?.formulario?.ativo ?? true);
      setVersaoBase(etapa?.formulario?.versao ?? null);
      setObrigacoesDraft(Object.fromEntries(campos.map((campo) => {
        const config = campo.etapaConfiguracoes?.find((item) => item.etapaId === etapaId);
        return [campo.id, { obrigatorio: config?.obrigatorio ?? false, obrigatorioEntrada: config?.obrigatorioEntrada ?? false, obrigatorioSaida: config?.obrigatorioSaida ?? false }];
      })));
    }
  }, [etapa, etapaId, etapaEscolhida, sujo, salvando, criandoCampo, versaoBase, setEtapaId, setSecoes, setAtivo, setVersaoBase, setObrigacoesDraft, campos]);
  const camposAplicaveis = useMemo(
    () =>
      camposLocais.filter(
        (campo) =>
          !camposExcluidos.includes(campo.id) &&
          campo.ativo !== false &&
          campo.etapaConfiguracoes?.some(
            (config) => config.etapaId === etapaId && config.visivel,
          ),
      ),
    [camposExcluidos, camposLocais, etapaId],
  );
  const editandoCard = modo === "card";
  const formularioPreview = useMemo(
    () =>
      resolverFormularioEtapa({
        formulario: etapa
          ? {
              id: etapa.formulario?.id ?? `preview-form-${etapa.id}`,
              ativo,
              versao: etapa.formulario?.versao ?? 1,
              secoes: (secaoSelecionada ? [secaoSelecionada] : []).map((secao, ordem) => ({
                id: secao.id ?? `preview-section-${secao.chave}-${ordem}`,
                chave: secao.chave,
                titulo: secao.titulo,
                ordem,
                componentes: secao.componentes.map(
                  (componente, ordemComponente) => ({
                    id:
                      componente.id ??
                      `preview-component-${secao.chave}-${componente.chave}-${ordemComponente}`,
                    chave: componente.chave,
                    tipo: componente.tipo,
                    campoId: componente.campoId,
                    capability: componente.capability,
                    configJson: componente.configJson,
                    ordem: ordemComponente,
                  }),
                ),
              })),
            }
          : null,
        camposCanonicos: camposAplicaveis,
      }),
    [ativo, camposAplicaveis, etapa, secaoSelecionada],
  );
  const campoPorId = useMemo(
    () => new Map(camposAplicaveis.map((campo) => [campo.id, campo])),
    [camposAplicaveis],
  );
  const campoSelecionado = camposLocais.find((campo) => campo.id === campoSelecionadoId) ?? null;
  const componenteSelecionado = blocoSelecionado
    ? secoes.find((secao) => secao.chave === blocoSelecionado.secaoChave)?.componentes.find((item) => item.chave === blocoSelecionado.chave) ?? null
    : null;
  const indiceSecaoCampoSelecionado = campoSelecionadoId ? secoes.findIndex((secao) => secao.componentes.some((item) => item.campoId === campoSelecionadoId)) : -1;
  const configSelecionada = campoSelecionado?.etapaConfiguracoes?.find((config) => config.etapaId === etapaId);
  const obrigacoesSelecionadas = campoSelecionado ? obrigacoesDraft[campoSelecionado.id] ?? { obrigatorio: configSelecionada?.obrigatorio ?? false, obrigatorioEntrada: configSelecionada?.obrigatorioEntrada ?? false, obrigatorioSaida: configSelecionada?.obrigatorioSaida ?? false } : null;
  const usoSelecionado = campoSelecionadoId ? usoCampos?.[campoSelecionadoId] : null;
  const publicadoNaEtapa = Boolean(campoSelecionadoId && etapa?.formulario?.secoes.some((secao) => secao.componentes.some((item) => item.campoId === campoSelecionadoId)));
  const estaNoRascunho = Boolean(campoSelecionadoId && secoes.some((secao) => secao.componentes.some((item) => item.campoId === campoSelecionadoId)));
  const camposFiltrados = camposLocais.filter((campo) => campo.ativo !== false && !camposExcluidos.includes(campo.id) && !secoes.some((secao) => secao.componentes.some((item) => item.campoId === campo.id)) && `${campo.nome} ${campo.tipo}`.toLocaleLowerCase().includes(buscaCampo.toLocaleLowerCase()));
  const blocosOperacionais = listarInventarioComponentesFormulario(etapa?.capabilitiesJson);
  const componentesEmUso = new Set(secoes.flatMap((secao) => secao.componentes.map((item) => item.capability).filter(Boolean)));

  function selecionarCampo(campo: CampoAplicavel) {
    setBlocoSelecionado(null);
    setCampoSelecionadoId(campo.id);
    setNomeEdicao(campo.nome);
  }

  function atualizarObrigatoriedadeBloco(obrigatorioSaida: boolean) {
    if (!blocoSelecionado || !componenteSelecionado) return;
    setSecoes((atuais) => atuais.map((secao) => secao.chave !== blocoSelecionado.secaoChave ? secao : {
      ...secao,
      componentes: secao.componentes.map((item) => {
        if (item.chave !== blocoSelecionado.chave) return item;
        const config = configComponente(item);
        config.obrigatorioSaida = obrigatorioSaida;
        return { ...item, configJson: JSON.stringify(config) };
      }),
    }));
    setSujo(true);
  }

  async function atualizarCampo(patch: { nome?: string; etapaConfiguracoes?: NonNullable<CampoAplicavel["etapaConfiguracoes"]> }) {
    if (!campoSelecionado || bloqueado) return;
    setSalvandoCampo(true);
    try {
      const resposta = await AtualizarCampoBpm({ campoId: campoSelecionado.id, ...patch, etapaConfiguracoes: patch.etapaConfiguracoes?.map((config) => ({
        etapaId: config.etapaId, visivel: config.visivel, editavel: config.editavel ?? true,
        somenteLeitura: config.somenteLeitura ?? false, obrigatorio: config.obrigatorio ?? false,
        obrigatorioEntrada: config.obrigatorioEntrada ?? false, obrigatorioSaida: config.obrigatorioSaida ?? false,
        ordem: config.ordem ?? 0, grupo: config.grupo, valorPadrao: config.valorPadrao,
        condicaoVisibilidadeJson: config.condicaoVisibilidadeJson,
        condicaoObrigatoriedadeJson: config.condicaoObrigatoriedadeJson,
      })) });
      if (!resposta.success || !resposta.data) { toast.error(mensagemErroCampo(resposta.error)); return; }
      const atualizado = resposta.data as CampoAplicavel;
      setCamposLocais((atuais) => [...atuais.filter((item) => item.id !== atualizado.id), atualizado]);
      setSecoes((atuais) => atuais.map((secao) => ({ ...secao, componentes: secao.componentes.map((item) => item.campoId === atualizado.id ? { ...item, campo: atualizado } : item) })));
      setNomeEdicao(atualizado.nome);
      if (patch.etapaConfiguracoes && !patch.etapaConfiguracoes.find((item) => item.etapaId === etapaId)?.visivel) {
        setObrigacoesDraft((atuais) => ({ ...atuais, [atualizado.id]: { obrigatorio: false, obrigatorioEntrada: false, obrigatorioSaida: false } }));
      }
      toast.success(`Campo “${atualizado.nome}” atualizado sem alterar seus valores ou anexos`);
      onPublished?.();
    } catch { toast.error("Não foi possível atualizar o campo. Tente novamente."); }
    finally { setSalvandoCampo(false); }
  }

  function atualizarRegra(chave: "visivel" | "editavel" | "obrigatorio" | "obrigatorioEntrada" | "obrigatorioSaida", valor: boolean) {
    if (!campoSelecionado) return;
    if (chave === "obrigatorio" || chave === "obrigatorioEntrada" || chave === "obrigatorioSaida") {
      setObrigacoesDraft((atuais) => ({ ...atuais, [campoSelecionado.id]: { obrigatorio: obrigacoesSelecionadas?.obrigatorio ?? false, obrigatorioEntrada: obrigacoesSelecionadas?.obrigatorioEntrada ?? false, obrigatorioSaida: obrigacoesSelecionadas?.obrigatorioSaida ?? false, [chave]: valor } }));
      setSujo(true);
      return;
    }
    const anteriores = campoSelecionado.etapaConfiguracoes ?? [];
    const atual = anteriores.find((item) => item.etapaId === etapaId);
    const nova = {
      etapaId, visivel: true, editavel: true, somenteLeitura: false,
      obrigatorio: false, obrigatorioEntrada: false, obrigatorioSaida: false,
      ordem: camposAplicaveis.length, ...atual, [chave]: valor,
    };
    if (chave === "editavel") nova.somenteLeitura = !valor;
    if (chave === "visivel" && !valor) {
      nova.obrigatorio = false; nova.obrigatorioEntrada = false; nova.obrigatorioSaida = false;
    }
    if (chave === "editavel" && !valor) {
      nova.obrigatorio = false; nova.obrigatorioEntrada = false; nova.obrigatorioSaida = false;
    }
    void atualizarCampo({ etapaConfiguracoes: [...anteriores.filter((item) => item.etapaId !== etapaId), nova] });
  }

  function selecionar(id: string) {
    if (id !== etapaId && (sujo || criandoCampo || salvando)) {
      toast.error("Salve ou descarte as alterações antes de trocar de etapa");
      return;
    }
    if (etapas.some((item) => item.id === id)) setEtapaId(id);
  }

  function alterarSecao(indice: number, patch: Partial<SecaoFormulario>) {
    if (bloqueado) return;
    setSecoes((atuais) =>
      atuais.map((secao, atual) =>
        atual === indice ? { ...secao, ...patch } : secao,
      ),
    );
    setSujo(true);
  }

  function descartarAlteracoesFormulario() {
    if (criandoCampo || salvando) return;
    setVersaoBase(etapa?.formulario?.versao ?? null);
    setSecoes(secoesDaEtapa(etapa));
    setAtivo(etapa?.formulario?.ativo ?? true);
    setSujo(false);
    setObrigacoesDraft(Object.fromEntries(camposLocais.map((campo) => {
      const config = campo.etapaConfiguracoes?.find((item) => item.etapaId === etapaId);
      return [campo.id, { obrigatorio: config?.obrigatorio ?? false, obrigatorioEntrada: config?.obrigatorioEntrada ?? false, obrigatorioSaida: config?.obrigatorioSaida ?? false }];
    })));
  }

  function adicionarSecao() {
    const sufixo = `${Date.now()}-${secoes.length}`;
    const chave = `secao-${sufixo}`;
    setSecoes((atuais) => [
      ...atuais,
      { chave, titulo: "Nova seção", componentes: [] },
    ]);
    setSecaoSelecionadaChave(chave);
    setSujo(true);
  }

  function adicionarCampo(indiceSecao: number, campoId: string, campoRecebido?: CampoAplicavel) {
    const campo = campoRecebido ?? camposAplicaveis.find((item) => item.id === campoId);
    if (!campo) return;
    alterarSecao(indiceSecao, {
      componentes: [
        ...secoes[indiceSecao].componentes,
        {
          chave: `campo-${campo.id}`,
          tipo: "CAMPO",
          campoId: campo.id,
          capability: null,
          configJson: null,
          campo,
        },
      ],
    });
  }

  function adicionarBloco(target: string) {
    const bloco = blocosOperacionais.find((item) => item.target === target);
    const secao = secoes[indiceSecaoSelecionada];
    if (!bloco?.disponivel || !secao || componentesEmUso.has(target) || bloqueado) return;
    alterarSecao(indiceSecaoSelecionada, {
      componentes: [...secao.componentes, {
        chave: `capability:${target}`,
        tipo: bloco.tipo,
        campoId: null,
        capability: target,
        configJson: null,
      }],
    });
    toast.success(`“${bloco.label}” adicionado ao rascunho. Publique a composição.`);
  }

  async function adicionarCampoDaBiblioteca(indiceSecao: number, campo: CampoAplicavel) {
    if (bloqueado) return;
    const config = campo.etapaConfiguracoes?.find((item) => item.etapaId === etapaId);
    if (config?.visivel) { adicionarCampo(indiceSecao, campo.id); selecionarCampo(campo); return; }
    setHabilitandoCampo(true);
    try {
      const configuracoes = [...(campo.etapaConfiguracoes ?? []).filter((item) => item.etapaId !== etapaId), {
        etapaId, visivel: true, editavel: true, somenteLeitura: false,
        obrigatorio: false, obrigatorioEntrada: false, obrigatorioSaida: false,
        ordem: camposAplicaveis.length,
      }].map((item) => ({
        etapaId: item.etapaId, visivel: item.visivel, editavel: item.editavel ?? true,
        somenteLeitura: item.somenteLeitura ?? false, obrigatorio: item.obrigatorio ?? false,
        obrigatorioEntrada: item.obrigatorioEntrada ?? false, obrigatorioSaida: item.obrigatorioSaida ?? false,
        ordem: item.ordem ?? 0, grupo: item.grupo, valorPadrao: item.valorPadrao,
        condicaoVisibilidadeJson: item.condicaoVisibilidadeJson,
        condicaoObrigatoriedadeJson: item.condicaoObrigatoriedadeJson,
      }));
      const resposta = await AtualizarCampoBpm({ campoId: campo.id, etapaConfiguracoes: configuracoes });
      if (!resposta.success || !resposta.data) { toast.error(mensagemErroCampo(resposta.error)); return; }
      const atualizado = resposta.data as CampoAplicavel;
      setCamposLocais((atuais) => [...atuais.filter((item) => item.id !== atualizado.id), atualizado]);
      adicionarCampo(indiceSecao, atualizado.id, atualizado);
      selecionarCampo(atualizado);
      toast.success(`Campo “${atualizado.nome}” disponível nesta etapa. Publique a composição.`);
    } catch { toast.error("Não foi possível adicionar o campo nesta etapa."); }
    finally { setHabilitandoCampo(false); }
  }

  function abrirNovoCampo(indiceSecao: number) {
    setSecaoNovoCampo(indiceSecao);
    setNomeNovoCampo("");
    setTipoNovoCampo("texto");
    setOpcoesNovoCampo("");
  }

  async function criarNovoCampo() {
    if (!etapa || secaoNovoCampo === null || criandoCampo || publicationBlocked)
      return;
    const nome = nomeNovoCampo.trim();
    if (!nome) {
      toast.error("Informe o nome do novo campo");
      return;
    }
    const exigeOpcoes = ["selecao", "multiselecao"].includes(tipoNovoCampo);
    const opcoes = opcoesNovoCampo
      .split(/[,\n]/)
      .map((opcao) => opcao.trim())
      .filter(
        (opcao, indice, todas) => opcao && todas.indexOf(opcao) === indice,
      );
    if (exigeOpcoes && opcoes.length === 0) {
      toast.error("Informe ao menos uma opção para o campo de seleção");
      return;
    }

    const secaoChave = secoes[secaoNovoCampo]?.chave;
    if (!secaoChave || salvando) return;
    // Pin the base snapshot before the action can revalidate/remount this editor.
    setSecoes(secoes);
    setAtivo(ativo);
    setVersaoBase(versaoBase);
    setCriandoCampo(true);
    try {
      const resposta = await CriarCampoBpm({
        pipelineId,
        nome,
        tipo: tipoNovoCampo,
        opcoes: exigeOpcoes ? opcoes : [],
        etapaConfiguracoes: [
          {
            etapaId: etapa.id,
            visivel: true,
            editavel: true,
            somenteLeitura: false,
            obrigatorio: false,
            obrigatorioEntrada: false,
            obrigatorioSaida: false,
            ordem: camposAplicaveis.length,
          },
        ],
      });
      if (!resposta.success || !resposta.data) {
        toast.error(mensagemErroCampo(resposta.error));
        return;
      }

      const campoCriado = resposta.data as CampoAplicavel;
      setCamposLocais((atuais) => [...atuais.filter((campo) => campo.id !== campoCriado.id), campoCriado]);
      setSecoes((atuais) =>
        atuais.map((secao) =>
          secao.chave === secaoChave && !secao.componentes.some((item) => item.campoId === campoCriado.id)
            ? {
                ...secao,
                componentes: [
                  ...secao.componentes,
                  {
                    chave: `campo-${campoCriado.id}`,
                    tipo: "CAMPO",
                    campoId: campoCriado.id,
                    capability: null,
                    configJson: null,
                    campo: campoCriado,
                  },
                ],
              }
            : secao,
        ),
      );
      setSujo(true);
      setSecaoNovoCampo(null);
      toast.success(
        `Campo “${campoCriado.nome}” criado e adicionado. Salve a composição.`,
      );
    } catch {
      toast.error("Não foi possível criar o campo. Tente novamente.");
    } finally {
      setCriandoCampo(false);
    }
  }

  async function excluirCampoAplicavel() {
    if (!campoParaExcluir || excluindoCampo || publicationBlocked) return;
    const campo = camposLocais.find((item) => item.id === campoParaExcluir);
    if (!campo) return;
    setExcluindoCampo(true);
    try {
      const resposta = await ExcluirCampoBpm({ campoId: campo.id });
      if (!resposta.success) {
        toast.error(mensagemErroCampo(resposta.error));
        return;
      }
      setCamposExcluidos((atuais) => [...new Set([...atuais, campo.id])]);
      setCampoSelecionadoId(null);
      setCampoParaExcluir(null);
      toast.success(`Campo “${campo.nome}” excluído`);
    } catch {
      toast.error("Não foi possível excluir o campo. Tente novamente.");
    } finally {
      setExcluindoCampo(false);
    }
  }

  async function salvar() {
    if (!etapa || publicationBlocked || salvando || criandoCampo || publicandoRef.current) return;
    publicandoRef.current = true;
    setSalvando(true);
    try {
      const resposta = await SalvarFormularioEtapaBpm({
        pipelineId,
        etapaId: etapa.id,
        versaoEsperada: versaoBase,
        ativo,
        obrigacoes: Object.entries(obrigacoesDraft)
          .filter(([campoId]) => secoes.some((secao) => secao.componentes.some((item) => item.campoId === campoId)))
          .map(([campoId, obrigacao]) => ({ campoId, ...(ativo ? obrigacao : { obrigatorio: false, obrigatorioEntrada: false, obrigatorioSaida: false }) })),
        secoes: secoes.map((secao) => ({
          id: secao.id,
          chave: secao.chave,
          titulo: secao.titulo,
          componentes: secao.componentes.map((componente) => ({
            id: componente.id,
            chave: componente.chave,
            tipo: componente.tipo,
            campoId: componente.campoId,
            capability: componente.capability,
            configJson: componente.configJson,
          })),
        })),
      });
      if (!resposta.success || !resposta.data) {
        toast.error(
          typeof resposta.error === "string"
            ? resposta.error
            : "Não foi possível salvar o formulário",
        );
        return;
      }
      const confirmado = resposta.data as FormularioEtapaAdmin;
      onFormularioAtualizado(etapa.id, confirmado);
      setSecoes(
        confirmado.secoes.map((secao) => ({
          ...secao,
          componentes: secao.componentes.map((item) => ({ ...item })),
        })),
      );
      setVersaoBase(confirmado.versao);
      setAtivo(confirmado.ativo);
      setSujo(false);
      toast.success(
        editandoCard
          ? "Card do Kanban atualizado"
          : "Composição do formulário publicada",
      );
      onPublished?.();
    } catch {
      toast.error("Não foi possível salvar o formulário. Tente novamente.");
    } finally {
      publicandoRef.current = false;
      setSalvando(false);
    }
  }

  if (!etapa)
    return (
      <p className="text-sm text-slate-500">
        Nenhuma etapa disponível para configurar.
      </p>
    );

  return (
    <section
      className="grid gap-4 xl:grid-cols-[248px_minmax(0,1fr)]"
      aria-labelledby="formulario-etapa-title"
    >
      <header className="relative flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-[28px] border border-cyan-300/20 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,.18),transparent_36%),linear-gradient(120deg,#102238,#0b1324_65%,#1a2135)] px-6 py-6 shadow-[0_24px_70px_rgba(0,0,0,.2)] xl:col-span-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">Configurações · Campos e formulários</p>
          <h2 id="formulario-etapa-title" className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Construa cada etapa do seu card</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Escolha uma etapa, combine campos e blocos operacionais e confira a prévia antes de publicar.</p>
        </div>
        <label className="min-w-56 text-xs font-semibold text-slate-300">Fase atual
          <select aria-label="Selecionar etapa do formulário" value={etapaId} onChange={(event) => selecionar(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-cyan-400/20 bg-slate-900 px-3 text-sm font-semibold text-cyan-100 focus-visible:outline-2 focus-visible:outline-cyan-400">
            {etapas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
        </label>
      </header>
      <div className="space-y-4 rounded-[24px] border border-white/10 bg-slate-950/85 p-3 shadow-[0_16px_45px_rgba(0,0,0,.12)] xl:self-start">
        {pipelineNome && <div className="px-2"><p className="text-xs font-semibold text-cyan-200">Pipeline: {pipelineNome}</p><Link href="/PainelAlpha/AlphaCRM/admin" onClick={(event) => { if (sujo) { event.preventDefault(); toast.error("Publique ou descarte as alterações antes de trocar de pipeline."); } }} className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-slate-300 underline underline-offset-4 hover:text-white">Trocar pipeline</Link></div>}
        <h3
          className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500"
        >
          Etapa do pipeline
        </h3>
        <div className="space-y-1">
          {etapas.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selecionar(item.id)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${item.id === etapaId ? "border-cyan-300/35 bg-cyan-400/15 text-cyan-50 shadow-[inset_3px_0_0_#67e8f9]" : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                  {(
                  <i
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: item.cor ?? "#64748b" }}
                  />
                )}
                <span className="truncate">{item.nome}</span>
              </span>
              <span className="text-[10px]">
                {item.formulario?.secoes.length ?? 0} seções
              </span>
            </button>
          ))}
        </div>
        <div className="border-t border-white/10 pt-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200"><CalendarClock size={15} className="text-amber-300" /> Blocos operacionais</h4>
            <span className="rounded-full bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">{blocosOperacionais.filter((item) => item.disponivel).length} disponíveis</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-400">Agendamento, acompanhamento e ações prontas do sistema. Selecione uma seção e adicione o bloco desejado.</p>
          <div className="mt-3 space-y-2" aria-label="Biblioteca de blocos operacionais">
            {blocosOperacionais.map((bloco) => {
              const emUso = componentesEmUso.has(bloco.target);
              return <div key={bloco.target} className={`rounded-xl border p-3 transition-colors ${emUso ? "border-emerald-300/25 bg-emerald-300/[.06]" : bloco.disponivel ? "border-amber-300/15 bg-amber-300/[.035] hover:border-amber-300/35" : "border-white/[.07] bg-white/[.025]"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">{bloco.label}</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-400">{bloco.description}</p>
                  </div>
                  <button type="button" disabled={bloqueado || !secoes.length || !bloco.disponivel || emUso} onClick={() => adicionarBloco(bloco.target)} aria-label={`Adicionar ${bloco.label} à seção`} className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed ${emUso ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-amber-300/20 bg-amber-300/10 text-amber-200 hover:bg-amber-300/20 disabled:opacity-40"}`}>{emUso ? <Check size={16} /> : <Plus size={16} />}</button>
                </div>
                <p className={`mt-2 text-[10px] font-medium ${emUso ? "text-emerald-300" : bloco.disponivel ? "text-amber-200/80" : "text-slate-500"}`}>{emUso ? "Já incluído nesta etapa" : bloco.disponivel ? "Pronto para adicionar" : "Este bloco não está habilitado nesta etapa"}</p>
              </div>;
            })}
          </div>
        </div>
        <div className="border-t border-white/10 pt-4">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300"><Layers3 size={15} /> Criar campo</h4>
          <p className="mt-1 text-xs text-slate-500">Clique em um tipo para criar um campo na seção selecionada.</p>
          <div className="mt-3 grid max-h-72 gap-1.5 overflow-y-auto pr-1">{TIPOS_CAMPO.map(([tipo, rotulo]) => <button key={tipo} type="button" disabled={bloqueado || !secoes.length} onClick={() => { abrirNovoCampo(indiceSecaoSelecionada); setTipoNovoCampo(tipo); }} className="flex min-h-10 items-center gap-2 rounded-lg border border-cyan-400/10 bg-cyan-400/5 px-3 text-left text-xs text-slate-200 hover:border-cyan-400/40 hover:bg-cyan-400/10 focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:opacity-40"><FileText size={14} className="shrink-0 text-cyan-300" />{rotulo}</button>)}</div>
          <h4 className="mt-5 border-t border-white/10 pt-4 text-xs font-bold uppercase tracking-wider text-slate-300">Campos existentes</h4>
          <p className="mt-1 text-xs text-slate-500">Reutilize sem perder valores ou anexos.</p>
          <label className="mt-3 flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-3 text-slate-400">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Buscar campo</span>
            <input value={buscaCampo} onChange={(event) => setBuscaCampo(event.target.value)} placeholder="Buscar campo" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
          </label>
          <label className="mt-3 block text-xs font-semibold text-slate-400">Seção selecionada
            <select aria-label="Selecionar seção do formulário" value={secaoSelecionada?.chave ?? ""} onChange={(event) => { setSecaoSelecionadaChave(event.target.value); setCampoSelecionadoId(null); setBlocoSelecionado(null); }} disabled={!secoes.length} className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-slate-900 px-2 text-sm text-white">
              {secoes.map((secao, index) => <option key={secao.chave} value={secao.chave}>{secao.titulo || `Seção ${index + 1}`}</option>)}
            </select>
          </label>
          <div className="mt-3 max-h-[45vh] space-y-1.5 overflow-y-auto pr-1">
            {camposFiltrados.map((campo) => <div key={campo.id} className="flex min-h-11 items-center gap-1 rounded-xl border border-white/10 bg-slate-900/70 p-1 text-xs text-slate-200"><button type="button" onClick={() => selecionarCampo(campo)} className="min-w-0 flex-1 rounded-lg px-2 py-1 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-cyan-400"><span className="block truncate">{campo.nome}</span><span className="block text-[10px] text-slate-500">{TIPOS_CAMPO.find(([tipo]) => tipo === campo.tipo)?.[1] ?? campo.tipo}{campo.etapaConfiguracoes?.some((item) => item.etapaId === etapaId && item.visivel) ? "" : " · fora desta etapa"}</span></button><button type="button" disabled={bloqueado || !secoes.length} onClick={() => void adicionarCampoDaBiblioteca(indiceSecaoSelecionada, campo)} aria-label={`Adicionar ${campo.nome} à seção`} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-40"><Plus size={15} aria-hidden="true" /></button></div>)}
            {!camposFiltrados.length && <p className="py-3 text-xs text-slate-500">Nenhum campo disponível para esta busca.</p>}
          </div>
          <button type="button" disabled={bloqueado || !secoes.length} onClick={() => abrirNovoCampo(indiceSecaoSelecionada)} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-40"><Plus size={15} /> Criar campo</button>
        </div>
        <div className="border-t border-white/10 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Card fechado do Kanban</h4>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">A composição compacta tem um editor dedicado.</p>
          <a href={`/PainelAlpha/AlphaCRM/admin/pipelines/${pipelineId}?tab=card`} onClick={(event) => { if (sujo) { event.preventDefault(); toast.error("Publique ou descarte as alterações antes de abrir o card do Kanban."); } }} className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-cyan-200 underline underline-offset-4 hover:text-white">Abrir editor do Kanban</a>
        </div>
      </div>

      <div className="min-w-0 space-y-5 rounded-[28px] border border-amber-300/10 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.09),rgba(8,18,32,0.96)_68%)] p-4 shadow-2xl lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-white">
              <FileText size={17} />{" "}
              {editandoCard
                ? `Configuração — ${etapa.nome}`
                : `Formulário — ${etapa.nome}`}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {editandoCard
                ? "Edite a estrutura e acompanhe o resultado no card ao lado."
                : "Monte as seções que aparecem no card desta etapa e defina o que precisa ser preenchido."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={ativo}
                disabled={bloqueado}
                onChange={(event) => {
                  setAtivo(event.target.checked);
                  setSujo(true);
                }}
              />{" "}
              Formulário ativo
            </label>
            <button
              type="button"
              disabled={!sujo || salvando || criandoCampo}
              onClick={descartarAlteracoesFormulario}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold text-slate-300 hover:bg-white/5 disabled:opacity-40"
            >
              <Undo2 size={14} /> Descartar
            </button>
            <button
              type="button"
              disabled={!sujo || publicationBlocked || salvando || criandoCampo}
              onClick={() => void salvar()}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-400 px-3 text-xs font-bold text-slate-950 disabled:opacity-40"
            >
              {salvando ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}{" "}
              {editandoCard ? "Salvar card" : "Publicar composição"}
            </button>
          </div>
        </div>

        {publicationBlocked && (
          <p className="text-xs text-amber-200" role="status">
            Publique ou descarte o rascunho principal antes de publicar o
            formulário.
          </p>
        )}

        <div className="mx-auto w-full max-w-3xl rounded-[24px] border border-white/10 bg-slate-950/95 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="mb-5 rounded-xl border border-amber-300/10 bg-amber-200/[0.04] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200/70">Fase atual</p>
            <p className="mt-1 text-base font-semibold text-white">{etapa.nome}</p>
          </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-400/15 bg-cyan-400/5 px-3 py-2 text-xs text-slate-300"><span><span className="font-semibold text-cyan-200">{secoes.length} seções</span> · {secoes.reduce((total, secao) => total + secao.componentes.length, 0)} componentes nesta etapa</span><button type="button" onClick={() => setMostrarPreview((atual) => !atual)} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-cyan-200 hover:bg-cyan-400/10"><Eye size={14} /> {mostrarPreview ? "Ocultar prévia" : "Ver prévia"}</button></div>
        <ListaCamposFormulario
          secoes={secaoSelecionada ? [secaoSelecionada] : []}
          bloqueado={bloqueado}
          metadados={(componente) => {
            const campo = campoPorId.get(componente.campoId ?? "") ?? componente.campo;
            return {
              nome: campo?.nome ?? obterDefinicaoComponenteFormulario(componente.capability)?.label ?? componente.chave,
              tipo: campo ? TIPOS_CAMPO.find(([tipo]) => tipo === campo.tipo)?.[1] ?? campo.tipo : componente.tipo === "CHECKLIST" ? "Checklist" : "Componente especializado",
              obrigatorio: campoPorId.get(componente.campoId ?? "")?.etapaConfiguracoes?.find((config) => config.etapaId === etapaId)?.obrigatorio ?? false,
              rotulo: rotuloPersonalizado(componente),
            };
          }}
          onMover={(origem, destino) => {
            if (bloqueado) return false;
            const resultado = moverItemFormulario(secoes, origem, destino);
            if (resultado.erro) { toast.error(resultado.erro); return false; }
            setSecoes((atuais) => moverItemFormulario(atuais, origem, destino).secoes);
            setSujo(true);
            return true;
          }}
          onRotulo={(_, indice, rotulo) => alterarSecao(indiceSecaoSelecionada, { componentes: secaoSelecionada.componentes.map((item, i) => i === indice ? aplicarRotulo(item, rotulo) : item) })}
          onRemover={(_, indice) => {
            const componente = secaoSelecionada.componentes[indice];
            if (componente?.capability) {
              setBlocoParaRemover({ secaoChave: secaoSelecionada.chave, capability: componente.capability, label: obterDefinicaoComponenteFormulario(componente.capability)?.label ?? componente.chave });
              return;
            }
            const campoId = componente?.campoId;
            const uso = campoId ? usoCampos?.[campoId] : null;
            if (campoId && uso && uso.valoresCard + uso.valoresGlobais + uso.anexos > 0) toast.success("Ao publicar, o campo sairá do formulário; valores e anexos existentes serão preservados.");
            if (campoId) setObrigacoesDraft((atuais) => ({ ...atuais, [campoId]: { obrigatorio: false, obrigatorioEntrada: false, obrigatorioSaida: false } }));
            alterarSecao(indiceSecaoSelecionada, { componentes: secaoSelecionada.componentes.filter((_, i) => i !== indice) });
          }}
          onSelecionar={(componente) => {
            const campo = camposLocais.find((item) => item.id === componente.campoId);
            if (campo) selecionarCampo(campo);
            else if (componente.capability && secaoSelecionada) {
              setCampoSelecionadoId(null);
              setBlocoSelecionado({ secaoChave: secaoSelecionada.chave, chave: componente.chave });
            }
          }}
        />
        <div className="border-t border-white/10 pt-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Settings2 size={16} className="text-cyan-300" /> Seções do card</h4>
          <fieldset disabled={bloqueado} className="mt-3 space-y-3">
        {secoes.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-400/25 bg-cyan-400/[0.025] px-6 py-10 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"><Layers3 size={28} /></div>
            <p className="max-w-sm text-base font-semibold text-white">Comece a criar o formulário desta fase</p>
            <p className="mt-2 max-w-sm text-xs leading-5 text-slate-400">Adicione uma seção e escolha os campos no catálogo ao lado. As regras passam a valer ao publicar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {secaoSelecionada && (
              <div
                key={secaoSelecionada.id ?? secaoSelecionada.chave}
                className="rounded-xl border border-white/10 bg-slate-950/35 p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    aria-label={`Título da seção ${indiceSecaoSelecionada + 1}`}
                    value={secaoSelecionada.titulo}
                    onChange={(event) =>
                      alterarSecao(indiceSecaoSelecionada, { titulo: event.target.value })
                    }
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                  />
                  <button
                    type="button"
                    aria-label="Mover seção para cima"
                    disabled={indiceSecaoSelecionada === 0}
                    onClick={() => {
                      setSecoes((atuais) => mover(atuais, indiceSecaoSelecionada, -1));
                      setSujo(true);
                    }}
                    className="rounded-lg p-2 text-slate-400 hover:bg-white/5 disabled:opacity-30"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label="Mover seção para baixo"
                    disabled={indiceSecaoSelecionada === secoes.length - 1}
                    onClick={() => {
                      setSecoes((atuais) => mover(atuais, indiceSecaoSelecionada, 1));
                      setSujo(true);
                    }}
                    className="rounded-lg p-2 text-slate-400 hover:bg-white/5 disabled:opacity-30"
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label="Remover seção"
                    onClick={() => {
                      const campoIds = secaoSelecionada.componentes.flatMap((componente) => componente.campoId ? [componente.campoId] : []);
                      if (campoIds.length) setObrigacoesDraft((atuais) => ({ ...atuais, ...Object.fromEntries(campoIds.map((campoId) => [campoId, { obrigatorio: false, obrigatorioEntrada: false, obrigatorioSaida: false }])) }));
                      setSecoes((atuais) =>
                        atuais.filter((_, atual) => atual !== indiceSecaoSelecionada),
                      );
                      setSecaoSelecionadaChave(secoes[indiceSecaoSelecionada + 1]?.chave ?? secoes[indiceSecaoSelecionada - 1]?.chave ?? "");
                      setSujo(true);
                    }}
                    className="rounded-lg p-2 text-rose-300 hover:bg-rose-400/10"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-3 space-y-2 border-l border-white/10 pl-4">
                  {secaoSelecionada.componentes.some((componente) => {
                    if (!componente.campoId) return false;
                    const uso = usoCampos?.[componente.campoId];
                    return !uso || uso.valoresCard + uso.valoresGlobais + uso.anexos > 0;
                  }) && <p className="text-[11px] text-amber-200">Esta seção contém campo com dados ou uso ainda não analisado. Atualize o campo existente para preservar seus valores e anexos.</p>}
                </div>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={adicionarSecao}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <Plus size={14} /> Adicionar seção
        </button>
          </fieldset>
        </div>
        </div>
      </div>

      <aside className="min-w-0 space-y-4 xl:col-start-2 2xl:grid 2xl:grid-cols-2 2xl:items-start 2xl:gap-4 2xl:space-y-0" aria-label="Propriedades e prévia">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Pencil size={16} className="text-cyan-300" /> Propriedades do componente</h3>
          {componenteSelecionado?.capability && <div className="mt-4 space-y-3 text-xs text-slate-300">
            <p className="font-semibold text-white">{obterDefinicaoComponenteFormulario(componenteSelecionado.capability)?.label ?? componenteSelecionado.chave}</p>
            <p>Este bloco pertence ao formulário de <strong>{etapa.nome}</strong>. A regra passa a valer após publicar a composição.</p>
            {["MEETING_SCHEDULER", "MEETING_TRANSCRIPT", "FOLLOW_UP_SCHEDULER", "FOLLOW_UP_CHECKLIST", "STAGE_CHECKLIST"].includes(componenteSelecionado.capability) && <label className="flex items-start gap-2.5 rounded-lg border border-white/10 bg-slate-900/40 p-2.5">
              <input type="checkbox" checked={configComponente(componenteSelecionado).obrigatorioSaida !== false} disabled={bloqueado} onChange={(event) => atualizarObrigatoriedadeBloco(event.target.checked)} className="mt-0.5 accent-cyan-400" />
              <span><span className="font-semibold">Exigir na transição</span><span className="mt-0.5 block text-[11px] text-slate-500">Quando ativo, este requisito bloqueia a mudança de etapa até ser atendido. Retirar o bloco do formulário também remove a obrigação.</span></span>
            </label>}
          </div>}
          {!campoSelecionado && !componenteSelecionado ? <p className="mt-3 text-xs leading-5 text-slate-400">Selecione um campo ou bloco na composição para configurar suas regras.</p> : campoSelecionado && <div className="mt-4 space-y-4">
            {indiceSecaoCampoSelecionado >= 0 && secoes.length > 1 && <label className="block text-xs font-semibold text-slate-300">Mover campo para seção
              <select value={secoes[indiceSecaoCampoSelecionado].chave} disabled={bloqueado} onChange={(event) => {
                const destino = event.target.value;
                const origem = indiceSecaoCampoSelecionado;
                setSecoes((atuais) => {
                  const componente = atuais[origem]?.componentes.find((item) => item.campoId === campoSelecionadoId);
                  if (!componente || !atuais.some((secao) => secao.chave === destino)) return atuais;
                  return atuais.map((secao, indice) => indice === origem
                    ? { ...secao, componentes: secao.componentes.filter((item) => item !== componente) }
                    : secao.chave === destino ? { ...secao, componentes: [...secao.componentes, componente] } : secao);
                });
                setSecaoSelecionadaChave(destino);
                setSujo(true);
              }} className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white">
                {secoes.map((secao) => <option key={secao.chave} value={secao.chave}>{secao.titulo}</option>)}
              </select>
            </label>}
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Campo compartilhado</p>
              <p className="mt-1 text-xs text-slate-300">Nome e tipo pertencem ao mesmo campo em todas as etapas e pipelines vinculados. Regras abaixo valem para <strong>{etapa.nome}</strong>.</p>
              <p className="mt-2 text-[11px] text-slate-500">{campoSelecionado.etapaConfiguracoes?.length ?? 0} etapas associadas · {(campoSelecionado.pipelinesAssociados?.length ?? 0) + 1} pipelines vinculados</p>
            </div>
            <label className="block text-xs font-semibold text-slate-300">Nome do campo
              <input value={nomeEdicao} onChange={(event) => setNomeEdicao(event.target.value)} maxLength={120} disabled={bloqueado} className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white disabled:opacity-50" />
            </label>
            <button type="button" disabled={bloqueado || !nomeEdicao.trim() || nomeEdicao.trim() === campoSelecionado.nome} onClick={() => void atualizarCampo({ nome: nomeEdicao.trim() })} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/30 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-40">{salvandoCampo ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Atualizar nome em todos os usos</button>
            <div className="border-t border-white/10 pt-3">
              <h4 className="flex items-center gap-2 text-xs font-semibold text-white"><ShieldCheck size={15} className="text-cyan-300" /> Regras desta etapa</h4>
              <p className="mt-1 text-[11px] text-slate-500">As obrigações entram em vigor ao publicar a composição.</p>
              {([
                ["visivel", "Visível no card", "Exibe o campo nesta etapa."],
                ["editavel", "Editável", "Permite preencher ou alterar o valor."],
                ["obrigatorio", "Obrigatório na etapa", "Bloqueia a transição quando este campo está vazio na etapa de origem ou de destino."],
                ["obrigatorioSaida", "Exigir para avançar", "Bloqueia a saída desta etapa sem valor."],
                ["obrigatorioEntrada", "Exigir para entrar", "Bloqueia a entrada nesta etapa sem valor."],
              ] as const).map(([chave, rotulo, ajuda]) => {
                const regraObrigacao = chave === "obrigatorio" || chave === "obrigatorioSaida" || chave === "obrigatorioEntrada";
                const marcado = regraObrigacao ? Boolean(obrigacoesSelecionadas?.[chave]) : Boolean(configSelecionada?.[chave]);
                const possuiObrigacaoPublicada = Boolean(configSelecionada?.obrigatorio || configSelecionada?.obrigatorioEntrada || configSelecionada?.obrigatorioSaida);
                // Permite retirar uma obrigação legada mesmo quando o campo já está somente leitura.
                // A restrição de editabilidade vale apenas para ativar uma nova obrigação.
                const indisponivel = bloqueado || (regraObrigacao && !marcado && (!estaNoRascunho || !configSelecionada?.visivel || !configSelecionada?.editavel || configSelecionada?.somenteLeitura || campoSelecionado.editavel === false || campoSelecionado.somenteLeitura)) || (chave === "visivel" && publicadoNaEtapa && marcado) || (chave === "editavel" && possuiObrigacaoPublicada && marcado);
                return <label key={chave} className="mt-3 flex items-start gap-2.5 rounded-lg border border-white/10 bg-slate-900/40 p-2.5 text-xs text-slate-200"><input type="checkbox" checked={marcado} disabled={indisponivel} onChange={(event) => atualizarRegra(chave, event.target.checked)} className="mt-0.5 accent-cyan-400" /><span><span className="font-semibold">{rotulo}</span><span className="mt-0.5 block text-[11px] text-slate-500">{ajuda}</span></span></label>;
              })}
              {!publicadoNaEtapa && estaNoRascunho && <p className="mt-2 text-[11px] text-amber-200">Defina as obrigações agora; elas serão ativadas ao publicar o formulário.</p>}
              {publicadoNaEtapa && <p className="mt-2 text-[11px] text-slate-500">Para ocultar, retire o campo da composição publicada após desativar suas obrigações. Para torná-lo somente leitura, desative e publique as obrigações primeiro.</p>}
            </div>
            <div className="border-t border-white/10 pt-3 text-xs text-slate-300">
              <h4 className="font-semibold text-white">Análise de uso</h4>
              {usoSelecionado ? <p className="mt-2 leading-5">{usoSelecionado.valoresCard} valores em cards · {usoSelecionado.valoresGlobais} valores globais · {usoSelecionado.anexos} anexos · {usoSelecionado.formularios} formulários · {usoSelecionado.etapas} etapas</p> : <p className="mt-2 text-slate-500">{erroUso ? "Análise indisponível. Exclusão bloqueada por segurança." : "Carregando usos…"}</p>}
              {usoSelecionado && (usoSelecionado.valoresCard + usoSelecionado.valoresGlobais + usoSelecionado.anexos + usoSelecionado.formularios + usoSelecionado.etapas > 0) && <p className="mt-2 text-amber-200">Este campo está em uso. Edite suas propriedades sem mudar seu ID ou remover dados.</p>}
              <button type="button" disabled={bloqueado || !usoSelecionado || Object.values(usoSelecionado).some((valor) => valor > 0) || estaNoRascunho} onClick={() => setCampoParaExcluir(campoSelecionado.id)} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-400/30 px-3 text-rose-200 hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={14} /> Excluir campo sem uso</button>
            </div>
          </div>}
        </div>
      {mostrarPreview && (
        <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.08),transparent_55%)] p-4 xl:p-6">
          <div className="mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950 p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">Preview do card</p>
                <h3 className="mt-1 font-bold text-white">
                  Empresa de exemplo
                </h3>
                {sujo && (
                  <p className="mt-1 text-[10px] font-semibold text-amber-300">
                    Prévia com alterações ainda não salvas
                  </p>
                )}
              </div>
              <span
                className="rounded-full px-2 py-1 text-[10px] font-bold text-white"
                style={{ background: etapa.cor ?? "#64748b" }}
              >
                {etapa.nome}
              </span>
            </div>
            <div className="mt-4">
              <FormularioEtapaRenderer
                formulario={formularioPreview}
                mode="preview"
                bindings={{
                  renderCampos: ({ campoIds, campoLabels }) => (
                    <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      {campoIds.map((campoId) => {
                        const campo = campoPorId.get(campoId);
                        if (!campo) return null;
                        const config = campo.etapaConfiguracoes?.find(
                          (item) => item.etapaId === etapaId,
                        );
                        return (
                          <label
                            key={campo.id}
                            className="block space-y-1 text-xs text-slate-400"
                          >
                            <span>
                              {campoLabels[campo.id] ?? campo.nome}
                              {(obrigacoesDraft[campo.id]?.obrigatorio ?? config?.obrigatorio) ? " *" : ""}
                            </span>
                            <input
                              aria-label={`Preview de ${campo.nome}`}
                              readOnly
                              disabled
                              value=""
                              placeholder={campo.tipo}
                              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-slate-300 disabled:opacity-70"
                            />
                          </label>
                        );
                      })}
                    </div>
                  ),
                  renderComponente: (componente) => {
                    const definicao = obterDefinicaoComponenteFormulario(
                      componente.capability,
                    );
                    return (
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        {typeof componente.config.label !== "string" && (
                          <p className="text-xs font-semibold text-slate-200">
                            {definicao?.label ?? componente.chave}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-slate-500">
                          {definicao?.description}
                        </p>
                      </div>
                    );
                  },
                }}
              />
            </div>
          </div>
        </section>
      )}
      </aside>

      <Dialog open={Boolean(blocoParaRemover)} onOpenChange={(aberto) => { if (!aberto) setBlocoParaRemover(null); }}>
        <DialogContent className="border-white/10 bg-slate-950 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Retirar {blocoParaRemover?.label}?</DialogTitle>
            <DialogDescription className="text-slate-400">O controle deixará de aparecer no card desta etapa depois da publicação. Os dados já salvos permanecem guardados e o bloco pode ser adicionado novamente.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" onClick={() => setBlocoParaRemover(null)} className="min-h-10 rounded-lg border border-white/15 px-4 text-sm text-slate-200">Manter bloco</button>
            <button type="button" disabled={bloqueado} onClick={() => {
              if (!blocoParaRemover) return;
              const alvo = blocoParaRemover;
              setSecoes((atuais) => atuais.map((secao) => secao.chave === alvo.secaoChave
                ? { ...secao, componentes: secao.componentes.filter((item) => item.capability !== alvo.capability) }
                : secao));
              setSujo(true);
              setBlocoParaRemover(null);
            }} className="min-h-10 rounded-lg bg-rose-500/90 px-4 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-40">Retirar do formulário</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={secaoNovoCampo !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !criandoCampo) setSecaoNovoCampo(null);
        }}
      >
        <DialogContent className="border-white/10 bg-slate-950 text-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Criar campo para {etapa.nome}</DialogTitle>
            <DialogDescription className="text-slate-400">
              O campo ficará disponível somente nesta etapa e será adicionado à
              seção escolhida. Depois, salve a composição.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            <label className="grid gap-1.5 text-sm text-slate-200">
              Nome do campo
              <input
                autoFocus
                value={nomeNovoCampo}
                maxLength={120}
                onChange={(event) => setNomeNovoCampo(event.target.value)}
                placeholder="Ex.: Número do processo"
                className="min-h-10 rounded-lg border border-white/10 bg-slate-900 px-3 text-white placeholder:text-slate-600"
              />
            </label>

            <label className="grid gap-1.5 text-sm text-slate-200">
              Tipo
              <select
                value={tipoNovoCampo}
                onChange={(event) =>
                  setTipoNovoCampo(
                    event.target.value as (typeof TIPOS_CAMPO)[number][0],
                  )
                }
                className="min-h-10 rounded-lg border border-white/10 bg-slate-900 px-3 text-white"
              >
                {TIPOS_CAMPO.map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </label>

            {["selecao", "multiselecao"].includes(tipoNovoCampo) && (
              <label className="grid gap-1.5 text-sm text-slate-200">
                Opções
                <textarea
                  value={opcoesNovoCampo}
                  onChange={(event) => setOpcoesNovoCampo(event.target.value)}
                  placeholder="Uma opção por linha ou separadas por vírgula"
                  rows={4}
                  className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-600"
                />
              </label>
            )}

            <p className="text-xs text-slate-400">Após publicar o campo no card, selecione-o para configurar as obrigações desta etapa.</p>
          </div>

          <DialogFooter>
            <button
              type="button"
              disabled={criandoCampo}
              onClick={() => setSecaoNovoCampo(null)}
              className="min-h-10 rounded-lg border border-white/10 px-4 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={criandoCampo || !nomeNovoCampo.trim()}
              onClick={() => void criarNovoCampo()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 text-sm font-bold text-slate-950 disabled:opacity-40"
            >
              {criandoCampo ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Plus size={15} />
              )}
              Criar e adicionar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={campoParaExcluir !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !excluindoCampo) setCampoParaExcluir(null);
        }}
      >
        <DialogContent className="border-white/10 bg-slate-950 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Excluir campo aplicável</DialogTitle>
            <DialogDescription className="text-slate-400">
              A exclusão é permanente e só será concluída se o campo não tiver dados associados.
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-1.5 text-sm text-slate-200">
            Campo
            <select
              aria-label="Campo aplicável para exclusão"
              value={campoParaExcluir ?? ""}
              disabled={excluindoCampo}
              onChange={(event) => setCampoParaExcluir(event.target.value || null)}
              className="min-h-10 rounded-lg border border-white/10 bg-slate-900 px-3 text-white"
            >
              {camposLocais.filter((campo) => {
                const uso = usoCampos?.[campo.id];
                return uso && Object.values(uso).every((valor) => valor === 0) && !secoes.some((secao) => secao.componentes.some((item) => item.campoId === campo.id));
              }).map((campo) => (
                <option key={campo.id} value={campo.id}>{campo.nome} · {campo.tipo}</option>
              ))}
            </select>
          </label>
          <DialogFooter>
            <button
              type="button"
              disabled={excluindoCampo}
              onClick={() => setCampoParaExcluir(null)}
              className="min-h-10 rounded-lg border border-white/10 px-4 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={excluindoCampo || !campoParaExcluir}
              onClick={() => void excluirCampoAplicavel()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              {excluindoCampo ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Excluir definitivamente
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function FormularioEtapaWorkspaceSelection(props: Parameters<typeof FormularioEtapaWorkspaceContent>[0]) {
  const [selected] = usePipelineEditorState(`${props.pipelineId}:${props.modo ?? "formulario"}:etapa`, props.etapas[0]?.id ?? "");
  const stage = props.etapas.find((item) => item.id === selected) ?? props.etapas[0];
  return <FormularioEtapaWorkspaceContent key={`${props.pipelineId}:${props.modo ?? "formulario"}:${stage?.id ?? ""}`} {...props} />;
}

export function FormularioEtapaWorkspace(props: Parameters<typeof FormularioEtapaWorkspaceContent>[0]) {
  return <PipelineEditorStateBoundary key={props.pipelineId}><FormularioEtapaWorkspaceSelection {...props} /></PipelineEditorStateBoundary>;
}
