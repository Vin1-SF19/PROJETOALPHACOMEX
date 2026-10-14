'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  ListChecks,
  Settings2,
  UsersRound,
} from 'lucide-react';
import type { TemaAlpha } from '@/lib/temas';
import { fmtDateTime } from '@/lib/format-date';
import { isAdminRole } from '@/lib/roles';
import CardFullViewModal from './CardModal/CardFullViewModal';
import { getAcaoVisual } from '@/components/crm-visual';

type DashboardData = NonNullable<Awaited<ReturnType<typeof import('@/actions/bpm/Dashboard').ObterDashboardBpm>>['data']>;
type FiltroTarefa = 'todas' | 'atrasadas' | 'hoje' | 'proximas';

interface Props {
  dashboard: DashboardData | null;
  erro: string | null;
  visual: TemaAlpha;
  currentUserId: number | null;
  currentUserRole: string | null;
}

const brDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short',
});
const brHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
});
const dataLocalKey = (data: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(data);

function percentualComparativo(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

function Comparativo({ atual, anterior, rotulo }: { atual: number; anterior: number; rotulo: string }) {
  const variacao = percentualComparativo(atual, anterior);
  if (variacao === null) {
    return <span className="text-xs text-slate-500">Sem base comparável {rotulo}</span>;
  }
  const Icon = variacao > 0 ? ArrowUpRight : variacao < 0 ? ArrowDownRight : Check;
  const tone = variacao === 0 ? 'text-slate-400' : 'text-slate-300';
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${tone}`}>
      <Icon size={14} aria-hidden="true" />
      {Math.abs(variacao)}% {variacao > 0 ? 'acima' : variacao < 0 ? 'abaixo' : 'estável'} {rotulo}
    </span>
  );
}

function StatCard({
  title, value, description, icon: Icon, children, tone = 'default',
}: {
  title: string;
  value: number;
  description?: string;
  icon: typeof ListChecks;
  children?: ReactNode;
  tone?: 'default' | 'critical';
}) {
  return (
    <article className="min-h-[166px] rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-sm shadow-black/10 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-slate-300">{title}</h2>
          <p className={`mt-3 text-3xl font-semibold tracking-tight tabular-nums ${tone === 'critical' ? 'text-amber-200' : 'text-slate-50'}`}>
            {value.toLocaleString('pt-BR')}
          </p>
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-xl border ${tone === 'critical' ? 'border-amber-400/20 bg-amber-400/[0.07] text-amber-200' : 'border-slate-600/60 bg-slate-800 text-slate-300'}`}>
          <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1">
        {children ?? <span className="text-xs text-slate-500">{description}</span>}
      </div>
    </article>
  );
}

function SettingsCard() {
  return (
    <Link
      href="/PainelAlpha/AlphaCRM/admin"
      className="group flex min-h-[166px] flex-col rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-sm shadow-black/10 transition-colors hover:border-slate-500/80 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-slate-300">Configurações</h2>
          <p className="mt-3 text-base font-semibold text-slate-50">Administre o CRM</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-slate-600/60 bg-slate-800 text-slate-300">
          <Settings2 size={19} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      <span className="mt-2 text-xs leading-relaxed text-slate-400">Gerencie preferências, permissões e parâmetros do sistema</span>
      <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-medium text-slate-300 group-hover:text-white">
        Abrir configurações <ChevronRight size={14} aria-hidden="true" />
      </span>
    </Link>
  );
}

function PipelineCard({
  pipeline, consolidado,
}: {
  pipeline: DashboardData['pipelines'][number];
  consolidado: boolean;
}) {
  const totalEtapas = pipeline.cardsVisiveis;
  return (
    <article className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-sm shadow-black/10 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-slate-50">{pipeline.nome}</h3>
            <span className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-300">
              {consolidado ? 'Visão consolidada' : 'Meu setor'}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-400">
            {pipeline._count.cards.toLocaleString('pt-BR')} cards visíveis
          </p>
          <p className="mt-3 text-sm text-slate-400">Acompanhe o avanço dos cards pelas etapas do processo.</p>
        </div>
        <Link
          href={`/PainelAlpha/AlphaCRM/pipeline/${pipeline.id}`}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-600/80 px-3.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-400 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
        >
          Acessar módulo <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      {pipeline.etapas.length === 0 ? (
        <p className="mt-6 rounded-lg border border-slate-700/60 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">Este pipeline não tem etapas visíveis para seu perfil.</p>
      ) : (
        <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {pipeline.etapas.map((etapa) => {
            const percentual = totalEtapas > 0 ? Math.round((etapa.cardsVisiveis / totalEtapas) * 100) : 0;
            return (
              <li key={etapa.id} className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs text-slate-500">Etapa {etapa.ordem + 1}</span>
                    <h4 className="mt-1 truncate text-sm font-medium text-slate-200" title={etapa.nome}>{etapa.nome}</h4>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-100">{etapa.cardsVisiveis}</span>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label={`${etapa.nome}: ${percentual}% dos cards ativos`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual}>
                    <div className="h-full rounded-full bg-sky-500/80 transition-[width] duration-300" style={{ width: `${percentual}%` }} />
                  </div>
                  <span className="w-9 text-right text-xs tabular-nums text-slate-400">{percentual}%</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}

export default function DashboardClient({
  dashboard,
  erro,
  visual,
  currentUserId,
  currentUserRole,
}: Props) {
  const [cardSelecionadoId, setCardSelecionadoId] = useState<string | null>(null);
  const [filtroTarefa, setFiltroTarefa] = useState<FiltroTarefa>('todas');
  const [atividadeExpandida, setAtividadeExpandida] = useState(false);
  const agora = useMemo(() => new Date(), []);
  const isAdmin = isAdminRole(currentUserRole);

  if (erro || !dashboard) {
    return (
      <div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-7 lg:px-10">
        <div role="alert" className="rounded-2xl border border-rose-900/50 bg-slate-900 p-5 text-sm text-rose-200">
          {erro ?? 'Erro ao carregar dashboard'}
        </div>
      </div>
    );
  }

  const tarefas = dashboard.tarefasPendentes;
  const tarefasFiltradas = tarefas.filter((tarefa) => {
    if (!tarefa.prazo) return filtroTarefa === 'todas';
    const prazo = new Date(tarefa.prazo);
    if (filtroTarefa === 'atrasadas') return prazo.getTime() < agora.getTime();
    if (filtroTarefa === 'hoje') return dataLocalKey(prazo) === dataLocalKey(agora);
    if (filtroTarefa === 'proximas') return prazo.getTime() >= agora.getTime() && dataLocalKey(prazo) !== dataLocalKey(agora);
    return true;
  });
  const filtros: { id: FiltroTarefa; label: string }[] = [
    { id: 'todas', label: 'Todas' }, { id: 'atrasadas', label: 'Atrasadas' },
    { id: 'hoje', label: 'Hoje' }, { id: 'proximas', label: 'Próximas' },
  ];
  const atividadeVisivel = atividadeExpandida ? dashboard.historicoRecente : dashboard.historicoRecente.slice(0, 5);
  const maxTarefasDia = Math.max(1, ...dashboard.tarefasHojePorDia);

  return (
    <main className="mx-auto max-w-[1600px] space-y-7 px-5 py-7 sm:px-7 sm:py-9 lg:px-10">
      <header className="pb-1">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[30px]">Alpha CRM</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-[15px]">
          Centralize seus processos e acompanhe suas operações em tempo real.
        </p>
      </header>

      <section aria-label="Resumo do CRM" className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isAdmin ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        <StatCard title="Tarefas hoje" value={dashboard.tarefasHojeCount} icon={ListChecks}>
          <Comparativo atual={dashboard.tarefasHojeCount} anterior={dashboard.tarefasOntemCount} rotulo="vs. ontem" />
          <div className="ml-auto flex h-6 items-end gap-1" role="img" aria-label="Tarefas pendentes com prazo nos últimos sete dias">
            {dashboard.tarefasHojePorDia.map((count, index) => (
              <span key={index} className="w-1.5 rounded-sm bg-sky-500/70" style={{ height: `${Math.max(4, Math.round((count / maxTarefasDia) * 22))}px` }} />
            ))}
          </div>
        </StatCard>
        <StatCard title="Pendências críticas" value={dashboard.tarefasAtrasadasCount} icon={AlertTriangle} tone="critical">
          <span className="text-xs text-slate-400">Tarefas pendentes com prazo vencido</span>
          <span className="text-xs text-slate-500">Comparativo indisponível</span>
        </StatCard>
        <StatCard title="Cards ativos" value={dashboard.totalAtivos} icon={UsersRound}>
          <Comparativo atual={dashboard.novosCardsSemana} anterior={dashboard.novosCardsSemanaAnterior} rotulo="vs. semana anterior (novos cards)" />
        </StatCard>
        {isAdmin && <SettingsCard />}
      </section>

      <section aria-labelledby="pipeline-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="pipeline-title" className="text-lg font-semibold text-white">Pipeline</h2>
            <p className="mt-1 text-sm text-slate-400">
              {isAdmin ? 'Visão consolidada dos pipelines disponíveis para seu perfil.' : 'Acompanhe o pipeline do seu setor.'}
            </p>
          </div>
          {!isAdmin && <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300"><UsersRound size={13} /> Meu setor</span>}
        </div>
        {dashboard.pipelines.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 text-sm text-slate-400">Nenhum pipeline disponível para seu perfil.</div>
        ) : (
          <div className="space-y-4">
            {dashboard.pipelines.map((pipeline) => <PipelineCard key={pipeline.id} pipeline={pipeline} consolidado={isAdmin} />)}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.9fr)]">
        <section aria-labelledby="tarefas-title" className="min-w-0 rounded-2xl border border-slate-700/70 bg-slate-900/75 p-4 shadow-sm shadow-black/10 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="tarefas-title" className="text-base font-semibold text-white">Tarefas pendentes</h2>
              <p className="mt-1 text-xs text-slate-400">{dashboard.tarefasPendentesCount.toLocaleString('pt-BR')} itens em aberto</p>
            </div>
            <Link href="/PainelAlpha/AlphaCRM/tarefas" className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
              Ver todas <ChevronRight size={14} />
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar tarefas">
            {filtros.map((filtro) => (
              <button
                key={filtro.id}
                type="button"
                aria-pressed={filtroTarefa === filtro.id}
                onClick={() => setFiltroTarefa(filtro.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${filtroTarefa === filtro.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
              >
                {filtro.label}
              </button>
            ))}
          </div>

          <div className="crm-scroll mt-4 max-h-[440px] overflow-auto rounded-xl border border-slate-700/60">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Tarefa</th><th className="px-4 py-3 font-medium">Empresa / Cliente</th>
                  <th className="px-4 py-3 font-medium">Prioridade</th><th className="px-4 py-3 font-medium">Prazo</th>
                  <th className="px-4 py-3 font-medium">Responsável</th><th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {tarefasFiltradas.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">{tarefas.length === 0 ? 'Nenhuma tarefa pendente.' : 'Nenhuma tarefa neste filtro.'}</td></tr>
                ) : tarefasFiltradas.map((tarefa) => {
                  const prazo = tarefa.prazo ? new Date(tarefa.prazo) : null;
                  const atrasada = prazo !== null && prazo.getTime() < agora.getTime();
                  const hoje = prazo !== null && dataLocalKey(prazo) === dataLocalKey(agora);
                  const prioridade = tarefa.prioridade === 'ALTA' ? 'Alta' : tarefa.prioridade === 'BAIXA' ? 'Baixa' : 'Normal';
                  return (
                    <tr key={tarefa.id} className="bg-slate-950/15 transition-colors hover:bg-slate-800/40">
                      <td className="max-w-[220px] px-4 py-3.5 font-medium text-slate-200"><span className="block truncate" title={tarefa.titulo}>{tarefa.titulo}</span></td>
                      <td className="max-w-[200px] px-4 py-3.5 text-slate-400"><span className="block truncate" title={tarefa.card.empresa.razaoSocial}>{tarefa.card.empresa.razaoSocial}</span></td>
                      <td className="px-4 py-3.5"><span className={`rounded-md px-2 py-1 text-[11px] font-medium ${prioridade === 'Alta' ? 'bg-amber-400/10 text-amber-200' : prioridade === 'Baixa' ? 'bg-slate-800 text-slate-400' : 'bg-slate-800/80 text-slate-300'}`}>{prioridade}</span></td>
                      <td className="whitespace-nowrap px-4 py-3.5"><span className={`text-xs ${atrasada ? 'text-rose-300' : hoje ? 'text-amber-200' : 'text-slate-400'}`}>{prazo ? brDataHora.format(prazo) : 'Sem prazo'}</span>{(atrasada || hoje) && <span className={`ml-2 text-[10px] ${atrasada ? 'text-rose-300' : 'text-amber-200'}`}>{atrasada ? 'Atrasada' : 'Hoje'}</span>}</td>
                      <td className="max-w-[150px] px-4 py-3.5 text-xs text-slate-400"><span className="block truncate">{tarefa.responsavel?.nome ?? 'Não atribuído'}</span></td>
                      <td className="px-4 py-3.5"><button type="button" onClick={() => setCardSelecionadoId(tarefa.cardId)} className="rounded-md px-2 py-1 text-xs font-medium text-sky-300 hover:bg-sky-400/10 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">Abrir card</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="atividade-title" className="min-w-0 rounded-2xl border border-slate-700/70 bg-slate-900/75 p-4 shadow-sm shadow-black/10 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="atividade-title" className="text-base font-semibold text-white">Atividade recente</h2>
              <p className="mt-1 text-xs text-slate-400">{dashboard.historicoRecente.length} eventos recentes</p>
            </div>
            {dashboard.historicoRecente.length > 5 && (
              <button type="button" aria-expanded={atividadeExpandida} onClick={() => setAtividadeExpandida((expandida) => !expandida)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
                {atividadeExpandida ? 'Mostrar menos' : 'Ver todas'} <ChevronRight size={14} className={atividadeExpandida ? 'rotate-90' : ''} />
              </button>
            )}
          </div>
          <div className="crm-scroll mt-4 max-h-[480px] overflow-y-auto">
            {atividadeVisivel.length === 0 ? (
              <p className="rounded-xl border border-slate-700/50 bg-slate-950/20 px-4 py-8 text-center text-sm text-slate-500">Sem atividade recente.</p>
            ) : (
              <ol className="divide-y divide-slate-700/50">
                {atividadeVisivel.map((evento) => {
                  const Icone = getAcaoVisual(evento.acao);
                  return (
                    <li key={evento.id}>
                      <button type="button" onClick={() => setCardSelecionadoId(evento.card.id)} className="flex w-full gap-3 py-3.5 text-left first:pt-1 last:pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300"><Icone size={15} aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span className="min-w-0 text-sm text-slate-200"><span className="font-medium">{evento.usuario?.nome ?? 'Sistema'}</span> <span className="text-slate-400">{evento.acao.replace(/_/g, ' ').toLocaleLowerCase('pt-BR')}</span></span>
                            <time className="shrink-0 text-[11px] tabular-nums text-slate-500" dateTime={new Date(evento.createdAt).toISOString()}>{brHora.format(new Date(evento.createdAt))}</time>
                          </span>
                          <span className="mt-1 block truncate text-xs text-slate-400">{evento.card.empresa.razaoSocial} · {evento.card.pipeline.nome}</span>
                          <span className="mt-1 block text-[11px] text-slate-500">{fmtDateTime(evento.createdAt)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
      </div>

      {cardSelecionadoId && (
        <CardFullViewModal
          cardId={cardSelecionadoId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          accent={visual.accent}
          onClose={() => setCardSelecionadoId(null)}
          onAtualizado={() => {}}
          onAbrirCard={(id) => setCardSelecionadoId(id)}
        />
      )}
    </main>
  );
}
