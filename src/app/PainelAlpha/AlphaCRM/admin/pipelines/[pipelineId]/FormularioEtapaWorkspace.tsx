"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { CriarCampoBpm } from "@/actions/bpm/Campos";
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
  listarCatalogoComponentesFormulario,
  obterDefinicaoComponenteFormulario,
} from "@/lib/bpm/formularios-etapa";

type CampoFormulario = { id: string; nome: string; tipo: string };
type ComponenteFormulario = {
  id?: string;
  chave: string;
  tipo: string;
  campoId: string | null;
  capability: string | null;
  configJson: string | null;
  ordem?: number;
  campo?: CampoFormulario | null;
};
type SecaoFormulario = {
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
  etapaConfiguracoes?: Array<{
    etapaId: string;
    visivel: boolean;
    obrigatorio?: boolean;
  }>;
};

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
  ["usuario", "Usuário"],
  ["cnpj", "CNPJ"],
  ["cpf", "CPF"],
  ["email", "E-mail"],
  ["telefone", "Telefone"],
  ["url", "Link/URL"],
  ["arquivo", "Arquivo"],
  ["relacionamento", "Relacionamento"],
] as const;

function mensagemErroCampo(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object")
    return "Não foi possível criar o campo";
  const fieldErrors = (error as { fieldErrors?: Record<string, string[]> })
    .fieldErrors;
  const primeira =
    fieldErrors && Object.values(fieldErrors).flat().find(Boolean);
  return primeira ?? "Não foi possível criar o campo";
}

function secoesDaEtapa(etapa: EtapaFormulario | undefined): SecaoFormulario[] {
  return (etapa?.formulario?.secoes ?? []).map((secao) => ({
    ...secao,
    componentes: secao.componentes.map((componente) => ({ ...componente })),
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

export function FormularioEtapaWorkspace({
  pipelineId,
  etapas,
  campos,
  onFormularioAtualizado,
  modo = "formulario",
  publicationBlocked = false,
  onPublished,
}: {
  pipelineId: string;
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
  const primeiraEtapa = etapas[0];
  const [etapaId, setEtapaId] = useState(primeiraEtapa?.id ?? "");
  const [secoes, setSecoes] = useState<SecaoFormulario[]>(() =>
    secoesDaEtapa(primeiraEtapa),
  );
  const [ativo, setAtivo] = useState(primeiraEtapa?.formulario?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);
  const [camposLocais, setCamposLocais] = useState<CampoAplicavel[]>(campos);
  const [secaoNovoCampo, setSecaoNovoCampo] = useState<number | null>(null);
  const [nomeNovoCampo, setNomeNovoCampo] = useState("");
  const [tipoNovoCampo, setTipoNovoCampo] =
    useState<(typeof TIPOS_CAMPO)[number][0]>("texto");
  const [opcoesNovoCampo, setOpcoesNovoCampo] = useState("");
  const [novoCampoObrigatorio, setNovoCampoObrigatorio] = useState(false);
  const [criandoCampo, setCriandoCampo] = useState(false);
  const etapa = etapas.find((item) => item.id === etapaId);
  const camposAplicaveis = useMemo(
    () =>
      camposLocais.filter(
        (campo) =>
          campo.ativo !== false &&
          campo.etapaConfiguracoes?.some(
            (config) => config.etapaId === etapaId && config.visivel,
          ),
      ),
    [camposLocais, etapaId],
  );
  const catalogoComponentes = useMemo(
    () => listarCatalogoComponentesFormulario(etapa?.capabilitiesJson),
    [etapa?.capabilitiesJson],
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
              secoes: secoes.map((secao, ordem) => ({
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
    [ativo, camposAplicaveis, etapa, secoes],
  );
  const campoPorId = useMemo(
    () => new Map(camposAplicaveis.map((campo) => [campo.id, campo])),
    [camposAplicaveis],
  );

  function selecionar(id: string) {
    if (id !== etapaId && sujo) {
      toast.error("Salve ou descarte as alterações antes de trocar de etapa");
      return;
    }
    const proxima = etapas.find((item) => item.id === id);
    setEtapaId(id);
    setSecoes(secoesDaEtapa(proxima));
    setAtivo(proxima?.formulario?.ativo ?? true);
    setSujo(false);
  }

  function alterarSecao(indice: number, patch: Partial<SecaoFormulario>) {
    setSecoes((atuais) =>
      atuais.map((secao, atual) =>
        atual === indice ? { ...secao, ...patch } : secao,
      ),
    );
    setSujo(true);
  }

  function descartarAlteracoesFormulario() {
    setSecoes(secoesDaEtapa(etapa));
    setAtivo(etapa?.formulario?.ativo ?? true);
    setSujo(false);
  }

  function adicionarSecao() {
    const sufixo = `${Date.now()}-${secoes.length}`;
    setSecoes((atuais) => [
      ...atuais,
      { chave: `secao-${sufixo}`, titulo: "Nova seção", componentes: [] },
    ]);
    setSujo(true);
  }

  function adicionarCampo(indiceSecao: number, campoId: string) {
    const campo = camposAplicaveis.find((item) => item.id === campoId);
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

  function adicionarComponente(indiceSecao: number, target: string) {
    const definicao = catalogoComponentes.find(
      (item) => item.target === target,
    );
    if (!definicao) return;
    if (
      !definicao.multiple &&
      secoes.some((secao) =>
        secao.componentes.some(
          (componente) => componente.capability === target,
        ),
      )
    )
      return;
    alterarSecao(indiceSecao, {
      componentes: [
        ...secoes[indiceSecao].componentes,
        {
          chave: `componente-${target.toLocaleLowerCase("pt-BR").replaceAll("_", "-")}`,
          tipo: definicao.tipo,
          campoId: null,
          capability: definicao.target,
          configJson: null,
        },
      ],
    });
  }

  function abrirNovoCampo(indiceSecao: number) {
    setSecaoNovoCampo(indiceSecao);
    setNomeNovoCampo("");
    setTipoNovoCampo("texto");
    setOpcoesNovoCampo("");
    setNovoCampoObrigatorio(false);
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
            obrigatorio: novoCampoObrigatorio,
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
      setCamposLocais((atuais) => [...atuais, campoCriado]);
      setSecoes((atuais) =>
        atuais.map((secao, indice) =>
          indice === secaoNovoCampo
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

  function moverComponenteParaSecao(
    indiceSecao: number,
    indiceComponente: number,
    indiceDestino: number,
  ) {
    if (indiceSecao === indiceDestino) return;
    setSecoes((atuais) => {
      const copia = atuais.map((secao) => ({
        ...secao,
        componentes: [...secao.componentes],
      }));
      const [componente] = copia[indiceSecao].componentes.splice(
        indiceComponente,
        1,
      );
      if (!componente || !copia[indiceDestino]) return atuais;
      copia[indiceDestino].componentes.push(componente);
      return copia;
    });
    setSujo(true);
  }

  async function salvar() {
    if (!etapa || publicationBlocked || salvando) return;
    setSalvando(true);
    try {
      const resposta = await SalvarFormularioEtapaBpm({
        pipelineId,
        etapaId: etapa.id,
        versaoEsperada: etapa.formulario?.versao ?? null,
        ativo,
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
      className={
        editandoCard
          ? "grid gap-4 xl:grid-cols-[220px_minmax(280px,0.8fr)_minmax(320px,1.2fr)]"
          : "grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]"
      }
      aria-labelledby="formulario-etapa-title"
    >
      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-2">
        <h3
          id="formulario-etapa-title"
          className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500"
        >
          {editandoCard ? "Etapas" : "Pipeline → etapa"}
        </h3>
        <div className="space-y-1">
          {etapas.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selecionar(item.id)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${item.id === etapaId ? "bg-cyan-400/10 text-cyan-100" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {editandoCard && (
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
      </div>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/35 p-4">
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
                : "Composição visual. Valores, regras e permissões continuam em seus domínios canônicos."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(event) => {
                  setAtivo(event.target.checked);
                  setSujo(true);
                }}
              />{" "}
              Formulário ativo
            </label>
            <button
              type="button"
              disabled={!sujo || salvando}
              onClick={descartarAlteracoesFormulario}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold text-slate-300 hover:bg-white/5 disabled:opacity-40"
            >
              <Undo2 size={14} /> Descartar
            </button>
            <button
              type="button"
              disabled={!sujo || publicationBlocked || salvando}
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

        {secoes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
            Nenhuma seção. Adicione a primeira seção para compor{" "}
            {editandoCard ? "o card" : "o formulário"}.
          </div>
        ) : (
          <div className="space-y-3">
            {secoes.map((secao, indiceSecao) => (
              <div
                key={secao.id ?? secao.chave}
                className="rounded-xl border border-white/10 bg-slate-950/35 p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    aria-label={`Título da seção ${indiceSecao + 1}`}
                    value={secao.titulo}
                    onChange={(event) =>
                      alterarSecao(indiceSecao, { titulo: event.target.value })
                    }
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                  />
                  <button
                    type="button"
                    aria-label="Mover seção para cima"
                    disabled={indiceSecao === 0}
                    onClick={() => {
                      setSecoes((atuais) => mover(atuais, indiceSecao, -1));
                      setSujo(true);
                    }}
                    className="rounded-lg p-2 text-slate-400 hover:bg-white/5 disabled:opacity-30"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label="Mover seção para baixo"
                    disabled={indiceSecao === secoes.length - 1}
                    onClick={() => {
                      setSecoes((atuais) => mover(atuais, indiceSecao, 1));
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
                      setSecoes((atuais) =>
                        atuais.filter((_, atual) => atual !== indiceSecao),
                      );
                      setSujo(true);
                    }}
                    className="rounded-lg p-2 text-rose-300 hover:bg-rose-400/10"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-3 space-y-2 border-l border-white/10 pl-4">
                  {secao.componentes.map((componente, indiceComponente) => (
                    <div
                      key={
                        componente.id ??
                        `${componente.chave}-${indiceComponente}`
                      }
                      className={
                        editandoCard
                          ? "grid gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
                          : "grid gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm sm:grid-cols-[auto_minmax(140px,1fr)_minmax(150px,0.8fr)_auto] sm:items-center"
                      }
                    >
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">
                        {componente.tipo}
                      </span>
                      <div className="min-w-0">
                        <input
                          aria-label={`Rótulo de ${componente.campo?.nome ?? componente.capability ?? componente.chave}`}
                          value={rotuloPersonalizado(componente)}
                          placeholder={
                            componente.campo?.nome ??
                            componente.capability ??
                            componente.chave
                          }
                          maxLength={120}
                          onChange={(event) =>
                            alterarSecao(indiceSecao, {
                              componentes: secao.componentes.map(
                                (item, atual) =>
                                  atual === indiceComponente
                                    ? aplicarRotulo(item, event.target.value)
                                    : item,
                              ),
                            })
                          }
                          className="min-h-9 w-full rounded-lg border border-white/10 bg-slate-900 px-2 text-xs text-white placeholder:text-slate-500"
                        />
                        <span className="mt-0.5 block truncate text-[10px] text-slate-600">
                          {componente.campo?.nome ??
                            componente.capability ??
                            componente.chave}
                        </span>
                      </div>
                      <select
                        aria-label="Mover componente para outra seção"
                        value={indiceSecao}
                        onChange={(event) =>
                          moverComponenteParaSecao(
                            indiceSecao,
                            indiceComponente,
                            Number(event.target.value),
                          )
                        }
                        className="min-h-9 min-w-0 rounded-lg border border-white/10 bg-slate-900 px-2 text-xs text-slate-300"
                      >
                        {secoes.map((secaoDestino, indiceDestino) => (
                          <option
                            key={secaoDestino.id ?? secaoDestino.chave}
                            value={indiceDestino}
                          >
                            {indiceDestino === indiceSecao
                              ? "Nesta seção"
                              : `Mover para ${secaoDestino.titulo}`}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          aria-label="Mover componente para cima"
                          disabled={indiceComponente === 0}
                          onClick={() =>
                            alterarSecao(indiceSecao, {
                              componentes: mover(
                                secao.componentes,
                                indiceComponente,
                                -1,
                              ),
                            })
                          }
                          className="p-1 text-slate-500 disabled:opacity-30"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Mover componente para baixo"
                          disabled={
                            indiceComponente === secao.componentes.length - 1
                          }
                          onClick={() =>
                            alterarSecao(indiceSecao, {
                              componentes: mover(
                                secao.componentes,
                                indiceComponente,
                                1,
                              ),
                            })
                          }
                          className="p-1 text-slate-500 disabled:opacity-30"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Remover componente da apresentação"
                          onClick={() =>
                            alterarSecao(indiceSecao, {
                              componentes: secao.componentes.filter(
                                (_, atual) => atual !== indiceComponente,
                              ),
                            })
                          }
                          className="p-1 text-rose-300"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Plus size={14} aria-hidden="true" />
                    <select
                      aria-label={`Adicionar campo à seção ${secao.titulo}`}
                      value=""
                      onChange={(event) =>
                        adicionarCampo(indiceSecao, event.target.value)
                      }
                      className="min-h-9 min-w-52 flex-1 rounded-lg border border-white/10 bg-slate-900 px-2 text-xs text-slate-300"
                    >
                      <option value="">Adicionar campo aplicável…</option>
                      {camposAplicaveis
                        .filter(
                          (campo) =>
                            !secoes.some((secaoAtual) =>
                              secaoAtual.componentes.some(
                                (componente) => componente.campoId === campo.id,
                              ),
                            ),
                        )
                        .map((campo) => (
                          <option key={campo.id} value={campo.id}>
                            {campo.nome} · {campo.tipo}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={publicationBlocked}
                      onClick={() => abrirNovoCampo(indiceSecao)}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cyan-400/30 px-3 font-semibold text-cyan-200 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus size={13} aria-hidden="true" /> Criar novo campo
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    <Plus size={14} />
                    <select
                      aria-label={`Adicionar componente à seção ${secao.titulo}`}
                      value=""
                      onChange={(event) =>
                        adicionarComponente(indiceSecao, event.target.value)
                      }
                      className="min-h-9 flex-1 rounded-lg border border-white/10 bg-slate-900 px-2 text-xs text-slate-300"
                    >
                      <option value="">Adicionar componente compatível…</option>
                      {catalogoComponentes
                        .filter(
                          (item) =>
                            item.multiple ||
                            !secoes.some((secaoAtual) =>
                              secaoAtual.componentes.some(
                                (componente) =>
                                  componente.capability === item.target,
                              ),
                            ),
                        )
                        .map((item) => (
                          <option key={item.target} value={item.target}>
                            {item.label}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={adicionarSecao}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <Plus size={14} /> Adicionar seção
        </button>
      </div>

      {editandoCard && (
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
                              {config?.obrigatorio ? " *" : ""}
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

            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={novoCampoObrigatorio}
                onChange={(event) =>
                  setNovoCampoObrigatorio(event.target.checked)
                }
              />
              Obrigatório nesta etapa
            </label>
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
    </section>
  );
}
