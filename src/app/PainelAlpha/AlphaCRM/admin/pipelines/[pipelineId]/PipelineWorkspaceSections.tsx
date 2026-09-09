"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
} from "lucide-react";

import type { SlaConfiguracaoAdmin } from "@/lib/validations/bpm-sla";
import { FormularioEtapaRenderer } from "@/app/PainelAlpha/AlphaCRM/CardModal/FormularioEtapaRenderer";
import { resolverFormularioEtapa } from "@/lib/bpm/formulario-renderer";
import { obterDefinicaoComponenteFormulario } from "@/lib/bpm/formularios-etapa";
import type { FormularioEtapaAdmin } from "./FormularioEtapaWorkspace";
import type { TransicaoBpm } from "./EtapaAvancadaSection";

export type EtapaWorkspace = {
  id: string;
  chave?: string | null;
  nome: string;
  ordem: number;
  cor: string | null;
  ativo: boolean;
  ehInicial: boolean;
  ehFinal: boolean;
  capabilitiesJson?: string | null;
  formulario?: FormularioEtapaAdmin | null;
  automacoes?: AutomacaoWorkspace[];
};
export type CampoWorkspace = {
  id: string;
  chave?: string | null;
  nome: string;
  tipo: string;
  ativo?: boolean;
  fonteEntidade?: string | null;
  opcoesJson?: string | null;
  opcoes?: Array<{ ativo: boolean }>;
  etapaConfiguracoes?: Array<{
    etapaId: string;
    visivel: boolean;
    ordem: number;
    obrigatorio: boolean;
    obrigatorioEntrada: boolean;
    obrigatorioSaida: boolean;
  }>;
};
export type AutomacaoWorkspace = {
  id: string;
  nome: string;
  descricao: string | null;
  ativa: boolean;
  gatilhoTipo: string;
  possuiCondicoes: boolean;
  acoes: string[];
};
export type AuditoriaWorkspace = {
  id: string;
  campoAlterado: string;
  createdAt: Date | string;
  admin?: { id: number; nome: string };
  adminId?: number;
};

type TabWorkspace =
  | "overview"
  | "stages"
  | "fields"
  | "card"
  | "sla"
  | "automations"
  | "permissions"
  | "history";

function possuiOpcoesLegadas(campo: CampoWorkspace): boolean {
  try {
    return (
      Array.isArray(campo.opcoesJson ? JSON.parse(campo.opcoesJson) : []) &&
      JSON.parse(campo.opcoesJson ?? "[]").length > 0
    );
  } catch {
    return false;
  }
}

function chaveSla(config: SlaConfiguracaoAdmin): string {
  return [
    config.etapaId,
    config.tipoTarefa,
    config.tipoProcesso,
    config.servicoId,
    config.inicioMomento,
  ]
    .map((item) => item ?? "*")
    .join("|");
}

export function PipelineHealthOverview({
  etapas,
  campos,
  transicoes,
  slas,
  automacoes,
  onNavigate,
}: {
  etapas: EtapaWorkspace[];
  campos: CampoWorkspace[];
  transicoes: TransicaoBpm[];
  slas: SlaConfiguracaoAdmin[];
  automacoes: AutomacaoWorkspace[];
  onNavigate: (tab: TabWorkspace, etapaId?: string) => void;
}) {
  const ativas = etapas.filter((etapa) => etapa.ativo);
  const iniciais = ativas.filter((etapa) => etapa.ehInicial);
  const inicial = iniciais.length === 1 ? iniciais[0] : undefined;
  const finais = ativas.filter((etapa) => etapa.ehFinal);
  const selecoesInvalidas = campos.filter(
    (campo) =>
      campo.ativo !== false &&
      ["selecao", "multiselecao"].includes(campo.tipo) &&
      !campo.fonteEntidade &&
      !campo.opcoes?.some((opcao) => opcao.ativo) &&
      !possuiOpcoesLegadas(campo),
  );
  const slaAtivos = slas.filter((sla) => sla.ativa);
  const gruposSla = new Map<string, number>();
  for (const sla of slaAtivos)
    gruposSla.set(chaveSla(sla), (gruposSla.get(chaveSla(sla)) ?? 0) + 1);
  const sobrepostos = [...gruposSla.values()].filter(
    (quantidade) => quantidade > 1,
  ).length;
  const idsAtivos = new Set(ativas.map((etapa) => etapa.id));
  const paresConfigurados = new Set(
    transicoes
      .filter(
        (transicao) =>
          idsAtivos.has(transicao.etapaOrigemId) &&
          idsAtivos.has(transicao.etapaDestinoId),
      )
      .map(
        (transicao) =>
          `${transicao.etapaOrigemId}:${transicao.etapaDestinoId}`,
      ),
  );
  const arestasEsperadas = ativas.length * Math.max(0, ativas.length - 1);
  const arestasAusentes = Math.max(0, arestasEsperadas - paresConfigurados.size);

  const visitadas = new Set<string>();
  if (inicial) {
    const fila = [inicial.id];
    while (fila.length) {
      const atual = fila.shift();
      if (!atual || visitadas.has(atual)) continue;
      visitadas.add(atual);
      for (const transicao of transicoes) {
        if (transicao.etapaOrigemId === atual && transicao.permitida)
          fila.push(transicao.etapaDestinoId);
      }
    }
  }
  const inalcançaveis = inicial
    ? ativas.filter((etapa) => !visitadas.has(etapa.id))
    : [];
  const problemas = [
    iniciais.length !== 1
      ? { texto: `É necessária uma etapa inicial; encontrado: ${iniciais.length}`, tab: "stages" as const }
      : null,
    finais.length === 0
      ? { texto: "Nenhuma etapa final configurada", tab: "stages" as const }
      : null,
    selecoesInvalidas.length
      ? {
          texto: `${selecoesInvalidas.length} campo(s) de seleção sem fonte válida`,
          tab: "fields" as const,
        }
      : null,
    sobrepostos
      ? {
          texto: `${sobrepostos} escopo(s) de SLA sobreposto(s)`,
          tab: "sla" as const,
        }
      : null,
    arestasAusentes
      ? {
          texto: `${arestasAusentes} transição(ões) sem regra explícita`,
          tab: "stages" as const,
        }
      : null,
    inalcançaveis.length
      ? {
          texto: `${inalcançaveis.length} etapa(s) ativa(s) inalcançável(is)`,
          tab: "stages" as const,
          etapaId: inalcançaveis[0].id,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const metricas = [
    ["Etapas", etapas.length],
    ["Campos", campos.length],
    ["Transições", transicoes.length],
    ["Automações", automacoes.length],
    ["SLAs", slas.length],
  ] as const;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metricas.map(([rotulo, valor]) => (
          <div
            key={rotulo}
            className="rounded-2xl border border-white/10 bg-slate-900/45 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {rotulo}
            </p>
            <p className="mt-2 text-3xl font-black text-white">{valor}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        <section className="rounded-2xl border border-white/10 bg-slate-900/45 p-5">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-cyan-300" />
            <h2 className="font-bold text-white">Saúde do pipeline</h2>
          </div>
          <div className="mt-4 space-y-2">
            {problemas.map((problema) => (
              <button
                key={problema.texto}
                type="button"
                onClick={() => onNavigate(problema.tab, problema.etapaId)}
                className="flex w-full items-center gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] px-3 py-3 text-left text-sm text-amber-100 hover:bg-amber-400/10"
              >
                <CircleAlert size={16} className="shrink-0" />
                <span className="flex-1">{problema.texto}</span>
                <ArrowRight size={15} />
              </button>
            ))}
            {problemas.length === 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-3 text-sm text-emerald-200">
                <CheckCircle2 size={17} /> Todas as verificações estruturais
                estão saudáveis.
              </div>
            )}
            {inicial && inalcançaveis.length === 0 && (
              <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-emerald-300">
                <CheckCircle2 size={16} /> Todas as etapas ativas são
                alcançáveis.
              </div>
            )}
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-slate-900/45 p-5">
          <h2 className="font-bold text-white">Entrada e encerramento</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Etapa inicial
              </dt>
              <dd className="mt-1 text-slate-200">
                {inicial?.nome ?? "Não configurada"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Etapas finais
              </dt>
              <dd className="mt-1 text-slate-200">
                {finais.map((etapa) => etapa.nome).join(", ") ||
                  "Não configuradas"}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

export function TransitionMatrix({
  etapas,
  transicoes,
  onSelectEtapa,
}: {
  etapas: EtapaWorkspace[];
  transicoes: TransicaoBpm[];
  onSelectEtapa: (id: string) => void;
}) {
  return (
    <div className="overflow-auto rounded-2xl border border-white/10 bg-slate-900/35">
      <table className="min-w-max border-collapse text-xs">
        <caption className="sr-only">Matriz de transições do pipeline</caption>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-slate-950 px-3 py-3 text-left text-slate-500">
              Origem \ destino
            </th>
            {etapas.map((etapa) => (
              <th
                key={etapa.id}
                className="max-w-28 px-2 py-3 text-center font-semibold text-slate-400"
              >
                <span className="block truncate" title={etapa.nome}>
                  {etapa.nome}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {etapas.map((origem) => (
            <tr key={origem.id} className="border-t border-white/5">
              <th className="sticky left-0 z-10 bg-slate-950 px-3 py-2 text-left">
                <button
                  type="button"
                  onClick={() => onSelectEtapa(origem.id)}
                  className="font-semibold text-slate-200 hover:text-cyan-200"
                >
                  {origem.nome}
                </button>
              </th>
              {etapas.map((destino) => {
                if (origem.id === destino.id)
                  return (
                    <td
                      key={destino.id}
                      className="px-2 py-2 text-center text-slate-700"
                    >
                      —
                    </td>
                  );
                const transicao = transicoes.find(
                  (item) =>
                    item.etapaOrigemId === origem.id &&
                    item.etapaDestinoId === destino.id,
                );
                const estado = !transicao
                  ? "Não configurada"
                  : transicao.permitida
                    ? "Permitida"
                    : "Bloqueada";
                return (
                  <td key={destino.id} className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => onSelectEtapa(origem.id)}
                      title={`${origem.nome} → ${destino.nome}: ${estado}`}
                      aria-label={`${origem.nome} para ${destino.nome}: ${estado}`}
                      className={`mx-auto block size-4 rounded-full border ${!transicao ? "border-slate-500 bg-slate-600/20" : transicao.permitida ? "border-emerald-300 bg-emerald-400" : "border-rose-300 bg-rose-400/30"}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-4 border-t border-white/10 px-4 py-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <i className="size-3 rounded-full bg-emerald-400" /> Permitida
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-3 rounded-full border border-rose-300 bg-rose-400/30" />{" "}
          Bloqueada
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-3 rounded-full border border-slate-500" /> Não
          configurada
        </span>
      </div>
    </div>
  );
}

export function KanbanCardPreview({
  etapas,
  campos,
}: {
  etapas: EtapaWorkspace[];
  campos: CampoWorkspace[];
}) {
  const [etapaId, setEtapaId] = useState(etapas[0]?.id ?? "");
  const etapa = etapas.find((item) => item.id === etapaId);
  const aplicaveis = campos
    .filter(
      (campo) =>
        campo.ativo !== false &&
        campo.etapaConfiguracoes?.some(
          (config) => config.etapaId === etapaId && config.visivel,
        ),
    )
    .sort(
      (a, b) =>
        (a.etapaConfiguracoes?.find((c) => c.etapaId === etapaId)?.ordem ?? 0) -
        (b.etapaConfiguracoes?.find((c) => c.etapaId === etapaId)?.ordem ?? 0),
    );
  const formulario = resolverFormularioEtapa({
    formulario: etapa?.formulario
      ? {
          ...etapa.formulario,
          secoes: etapa.formulario.secoes.map((secao, ordem) => ({
            ...secao,
            id: secao.id ?? `preview-section-${secao.chave}`,
            ordem: secao.ordem ?? ordem,
            componentes: secao.componentes.map((componente, ordemComponente) => ({
              ...componente,
              id: componente.id ?? `preview-component-${secao.chave}-${componente.chave}`,
              ordem: componente.ordem ?? ordemComponente,
            })),
          })),
        }
      : null,
    camposCanonicos: aplicaveis,
  });
  const campoPorId = new Map(aplicaveis.map((campo) => [campo.id, campo]));
  return (
    <div className="grid gap-4 xl:grid-cols-[220px_minmax(280px,0.8fr)_minmax(320px,1.2fr)]">
      <section className="rounded-2xl border border-white/10 bg-slate-900/35 p-2">
        <h3 className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          Etapas
        </h3>
        {etapas.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setEtapaId(item.id)}
            className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${item.id === etapaId ? "bg-cyan-400/10 text-cyan-100" : "text-slate-400 hover:bg-white/5"}`}
          >
            <i
              className="size-2.5 rounded-full"
              style={{ background: item.cor ?? "#64748b" }}
            />{" "}
            <span className="truncate">{item.nome}</span>
          </button>
        ))}
      </section>
      <section className="rounded-2xl border border-white/10 bg-slate-900/35 p-4">
        <h3 className="font-bold text-white">Configuração — {etapa?.nome}</h3>
        <p className="mt-1 text-xs text-slate-500">
          Ordem e visibilidade vêm das regras por etapa do campo.
        </p>
        <div className="mt-4 space-y-2">
          {aplicaveis.map((campo) => (
            <div
              key={campo.id}
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2 text-sm text-slate-300"
            >
              <span className="text-slate-600">☰</span>
              <span className="flex-1 truncate">{campo.nome}</span>
              <span className="text-[10px] text-slate-600">{campo.tipo}</span>
            </div>
          ))}
          {aplicaveis.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">
              Nenhum item visível configurado.
            </p>
          )}
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.08),transparent_55%)] p-6">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950 p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">Preview do card</p>
              <h3 className="mt-1 font-bold text-white">Empresa de exemplo</h3>
            </div>
            <span
              className="rounded-full px-2 py-1 text-[10px] font-bold text-white"
              style={{ background: etapa?.cor ?? "#64748b" }}
            >
              {etapa?.nome}
            </span>
          </div>
          <div className="mt-4">
            <FormularioEtapaRenderer
              formulario={formulario}
              mode="preview"
              bindings={{
                renderCampos: ({ campoIds }) => (
                  <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    {campoIds.map((campoId) => {
                      const campo = campoPorId.get(campoId);
                      if (!campo) return null;
                      const config = campo.etapaConfiguracoes?.find((item) => item.etapaId === etapaId);
                      return (
                        <label key={campo.id} className="block space-y-1 text-xs text-slate-400">
                          <span>{campo.nome}{config?.obrigatorio ? " *" : ""}</span>
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
                  const definicao = obterDefinicaoComponenteFormulario(componente.capability);
                  return (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="text-xs font-semibold text-slate-200">{definicao?.label ?? componente.chave}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{definicao?.description}</p>
                    </div>
                  );
                },
              }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export function AutomationsOverview({
  automacoes,
}: {
  automacoes: AutomacaoWorkspace[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-white">
            <Bot size={18} /> Automações relacionadas
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Resumo das versões ativas projetadas pelo Motor Central.
          </p>
        </div>
        <Link
          href="/PainelAlpha/AlphaCRM/automacoes"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold text-slate-200 hover:bg-white/5"
        >
          Abrir Motor Central <ExternalLink size={14} />
        </Link>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {automacoes.map((automacao) => (
          <article
            key={automacao.id}
            className="rounded-2xl border border-white/10 bg-slate-900/35 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{automacao.nome}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {automacao.descricao ?? "Sem descrição"}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-bold ${automacao.ativa ? "bg-emerald-400/10 text-emerald-200" : "bg-slate-700 text-slate-400"}`}
              >
                {automacao.ativa ? "Ativa" : "Inativa"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
              <span className="rounded bg-white/5 px-2 py-1">
                {automacao.gatilhoTipo}
              </span>
              {automacao.possuiCondicoes && (
                <span className="rounded bg-white/5 px-2 py-1">
                  Com condições
                </span>
              )}
              <span className="rounded bg-white/5 px-2 py-1">
                {automacao.acoes.length} ações
              </span>
            </div>
          </article>
        ))}
        {automacoes.length === 0 && (
          <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500 lg:col-span-2">
            Nenhuma automação relacionada a este pipeline.
          </p>
        )}
      </div>
    </section>
  );
}

export function PipelineHistory({
  auditoria,
}: {
  auditoria: AuditoriaWorkspace[];
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 font-bold text-white">
          <Clock3 size={18} /> Histórico administrativo
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Últimas 50 alterações persistidas em `BpmPipelineConfigAuditoria`.
          Conteúdo de campos e dados pessoais não são exibidos.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        {auditoria.map((item) => (
          <article
            key={item.id}
            className="grid gap-2 border-b border-white/5 bg-slate-900/35 px-4 py-3 last:border-0 sm:grid-cols-[180px_minmax(0,1fr)]"
          >
            <div>
              <p className="text-xs font-semibold text-slate-200">
                {item.admin?.nome ?? `Administrador #${item.adminId ?? "—"}`}
              </p>
              <time className="text-[11px] text-slate-500">
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "America/Sao_Paulo",
                }).format(new Date(item.createdAt))}
              </time>
            </div>
            <p className="text-xs font-semibold text-cyan-200">
              {item.campoAlterado.replaceAll("_", " ")}
            </p>
          </article>
        ))}
        {auditoria.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">
            Nenhuma alteração auditada para este pipeline.
          </p>
        )}
      </div>
    </section>
  );
}
