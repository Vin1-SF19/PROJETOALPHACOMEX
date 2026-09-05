'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity as ActivityLucide,
  AlertTriangle,
  ListChecks,
  CheckCircle2,
  Clock,
  ArrowRight,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import type { TemaAlpha } from '@/lib/temas';
import { fmtDateTime } from '@/lib/format-date';
import { ObterDashboardBpm } from '@/actions/bpm/Dashboard';
import CardFullViewModal from './CardModal/CardFullViewModal';
import {
  GlowIcon,
  GlassCard,
  TiltSpotCard,
  SectionHeader,
  StatusBadge,
  PipelineGlyph,
  getPipelineIdentity,
  getAcaoVisual,
} from '@/components/crm-visual';

type DashboardData = NonNullable<Awaited<ReturnType<typeof ObterDashboardBpm>>['data']>;

interface Props {
  dashboard: DashboardData | null;
  erro: string | null;
  visual: TemaAlpha;
  currentUserId: number | null;
  currentUserRole: string | null;
}

/* ── KPI card (apenas visual; dados vêm de `dashboard`) ────────── */
function KpiCard({
  icon,
  label,
  value,
  accent,
  tone,
  delay,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  accent: string; // rgb
  tone?: 'danger' | 'ok' | 'warn';
  delay?: number;
}) {
  const accentRgb =
    tone === 'danger'
      ? '251, 113, 133'
      : tone === 'ok'
        ? '52, 211, 153'
        : tone === 'warn'
          ? '245, 158, 11'
          : accent;

  return (
    <TiltSpotCard
      maxTilt={1.4}
      className="p-4 sm:p-5 min-h-[96px]"
      style={{ animationDelay: `${delay ?? 0}ms` }}
    >
      <div className="flex items-start justify-between">
        <GlowIcon icon={icon} accent={accentRgb} chip={46} size={22} />
        <span
          className="hidden sm:block h-15 w-[3px] rounded-full"
          aria-hidden
          style={{
            height: 46,
            background: `linear-gradient(180deg, rgba(${accentRgb},0.4), rgba(${accentRgb},0.05))`,
          }}
        />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p
          className="text-3xl sm:text-[34px] leading-none font-black tabular-nums text-white"
          style={{ textShadow: `0 0 18px rgba(${accentRgb},0.16)` }}
        >
          {value === 0 ? '—' : value}
        </p>
        {value > 0 && (
          <span
            className="mb-1.5 h-2 w-2 rounded-full crm-pulse-dot"
            style={{
              background: `rgb(${accentRgb})`,
              boxShadow: `0 0 12px rgba(${accentRgb},0.7)`,
            }}
            aria-hidden
          />
        )}
      </div>
      <p className="mt-1.5 text-[11px] font-medium tracking-wide uppercase text-[hsl(215,16%,46%)]">
        {label}
      </p>
    </TiltSpotCard>
  );
}

export default function DashboardClient({
  dashboard,
  erro,
  visual,
  currentUserId,
  currentUserRole,
}: Props) {
  const accent = visual.accent;
  const [cardSelecionadoId, setCardSelecionadoId] = useState<string | null>(null);
  const [agora] = useState(() => Date.now());

  const tarefasOrdenadas = useMemo(() => {
    const tarefasPendentes = dashboard?.tarefasPendentes ?? [];
    return [...tarefasPendentes].sort((a, b) => {
      const aAtrasada = a.prazo ? new Date(a.prazo).getTime() < agora : false;
      const bAtrasada = b.prazo ? new Date(b.prazo).getTime() < agora : false;
      if (aAtrasada !== bAtrasada) return aAtrasada ? -1 : 1;
      return 0;
    });
  }, [dashboard, agora]);

  if (erro || !dashboard) {
    return (
      <div className="p-8">
        <GlassCard className="p-6">
          <p className="text-sm text-[hsl(4,90%,82%)]">{erro ?? 'Erro ao carregar dashboard'}</p>
        </GlassCard>
      </div>
    );
  }

  const {
    pipelines,
    totalAtivos,
    concluidasSemana,
    tarefasAtrasadasCount,
    historicoRecente,
  } = dashboard;

  return (
    <div className="px-5 sm:px-7 lg:px-10 py-7 sm:py-10 max-w-[1600px] mx-auto space-y-8">
      {/* ── Header ── */}
      <header className="relative">
        <div
          className="absolute -top-1 left-0 h-[3px] w-24 rounded-full"
          style={{
            background: 'linear-gradient(90deg, #00e6c3, #3485ff, transparent)',
            boxShadow: '0 0 14px rgba(0,230,195,0.5)',
          }}
          aria-hidden
        />
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1
              className="text-2xl sm:text-[32px] font-black tracking-[0.01em] text-white"
              style={{ textShadow: '0 0 24px rgba(120,200,255,0.14)' }}
            >
              Dashboard
            </h1>
            <p className="mt-1.5 text-[13px] sm:text-sm text-[hsl(214,20%,52%)]">
              Controle seus processos em tempo real.
            </p>
          </div>
          <span
            className="relative flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold"
            style={{
              borderColor: 'rgba(0,230,195,0.22)',
              background: 'rgba(0,230,195,0.06)',
              color: 'rgb(0,230,195)',
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full crm-pulse-dot"
              style={{ background: 'rgb(0,230,195)', boxShadow: '0 0 10px rgb(0,230,195)' }}
              aria-hidden
            />
            Ao vivo
          </span>
        </div>
      </header>

      {/* ── KPI cards ── */}
      <section aria-label="Indicadores" className="crm-enter grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5" style={{ animationDelay: "60ms" }}>
        <KpiCard
          icon={ActivityLucide}
          label="Cards ativos"
          value={totalAtivos}
          accent={accent}
          delay={0}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Tarefas atrasadas"
          value={tarefasAtrasadasCount}
          accent={accent}
          tone={tarefasAtrasadasCount > 0 ? 'danger' : undefined}
          delay={60}
        />
        <KpiCard
          icon={ListChecks}
          label="Tarefas pendentes"
          value={tarefasOrdenadas.length}
          accent={accent}
          tone={tarefasOrdenadas.length > 0 ? 'warn' : undefined}
          delay={120}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Concluídos (7 dias)"
          value={concluidasSemana}
          accent={accent}
          tone="ok"
          delay={180}
        />
      </section>

      {/* ── Pipelines ── */}
      <section aria-label="Pipelines" className="crm-enter" style={{ animationDelay: "120ms" }}>
        <SectionHeader title="Pipelines" />
        <div className="mt-3">
          {pipelines.length === 0 ? (
            <GlassCard className="p-6">
              <p className="text-sm text-[hsl(215,18%,50%)]">Nenhum pipeline configurado ainda.</p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
              {pipelines.map((pipeline) => {
                const ident = getPipelineIdentity(pipeline.nome);
                const Icon = ident.icon;
                return (
                  <TiltSpotCard
                    key={pipeline.id}
                    maxTilt={1.5}
                    className="group p-5"
                    aria-label={pipeline.nome}
                  >
                    <Link
                      href={`/PainelAlpha/AlphaCRM/pipeline/${pipeline.id}`}
                      className="flex flex-col h-full"
                    >
                      <div className="flex items-start justify-between">
                        <PipelineGlyph identity={ident} className="crm-float" />
                        <span
                          className="mt-1 h-px w-1/3"
                          style={{
                            background: `linear-gradient(90deg, transparent, rgba(${ident.accent},0.45), transparent)`,
                          }}
                          aria-hidden
                        />
                      </div>

                      <h3
                        className="mt-4 text-[15px] sm:text-base font-bold text-white"
                        style={{ textShadow: '0 0 12px rgba(255,255,255,0.05)' }}
                      >
                        {pipeline.nome}
                      </h3>
                      <p className="mt-1 text-xs text-[hsl(215,16%,46%)]">
                        {pipeline._count.cards === 0
                          ? 'Nenhum card ativo'
                          : `${pipeline._count.cards} card${pipeline._count.cards > 1 ? 's' : ''} ativo${pipeline._count.cards > 1 ? 's' : ''}`}
                      </p>

                      <div className="mt-5 flex items-center justify-between">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium"
                          style={{
                            borderColor: `rgba(${ident.accent},0.24)`,
                            background: `linear-gradient(90deg, rgba(${ident.accent},0.12), rgba(${ident.accent},0.02))`,
                            color: `rgb(${ident.accent})`,
                          }}
                        >
                          <Icon size={12} strokeWidth={2} />
                          Módulo
                        </span>
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[hsl(215,16%,46%)] transition-all duration-200 group-hover:text-[hsl(160,100%,55%)] group-hover:gap-2"
                          aria-hidden
                        >
                          Acessar
                          <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </Link>
                  </TiltSpotCard>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Tarefas pendentes + Atividade recente ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Tarefas pendentes */}
        <section aria-label="Tarefas pendentes" className="crm-enter" style={{ animationDelay: "200ms" }}>
          <SectionHeader title="Tarefas pendentes" hint={`${tarefasOrdenadas.length} item${tarefasOrdenadas.length > 1 ? 's' : ''}`} />
          <GlassCard className="mt-3 h-full p-3 sm:p-4">
            <div className="crm-scroll max-h-[440px] overflow-y-auto pr-1 space-y-2">
              {tarefasOrdenadas.length === 0 && (
                <p className="text-xs text-[hsl(215,16%,42%)]">Nenhuma tarefa pendente.</p>
              )}
              {tarefasOrdenadas.map((t) => {
                const atrasada = t.prazo ? new Date(t.prazo).getTime() < agora : false;
                const c = atrasada ? '251, 113, 133' : '52, 133, 255';
                return (
                  <button
                    key={t.id}
                    onClick={() => setCardSelecionadoId(t.cardId)}
                    className="group w-full text-left crm-surface crm-inner-light rounded-xl border border-white/[0.04] px-3 py-2.5 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/[0.03] hover:translate-x-[2px] hover:border-white/[0.10]"
                    style={{ background: 'rgba(10,20,38,0.42)' }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                        style={{
                          border: `1px solid rgba(${c},0.26)`,
                          background: `linear-gradient(155deg, rgba(${c},0.22), rgba(${c},0.05) 65%)`,
                        }}
                      >
                        <Clock
                          size={14}
                          strokeWidth={2}
                          style={{ color: `rgb(${c})`, filter: `drop-shadow(0 0 6px rgba(${c},0.6))` }}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-medium text-white truncate">{t.titulo}</p>
                          {atrasada ? (
                            <StatusBadge label="Atrasada" tone="danger" className="shrink-0" />
                          ) : t.prazo ? (
                            <StatusBadge label="Pendente" tone="info" className="shrink-0" />
                          ) : null}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-[hsl(215,16%,46%)]">
                          <Building2 size={12} />
                          <span className="truncate">{t.card.empresa.razaoSocial}</span>
                          <span aria-hidden className="h-1 w-1 rounded-full bg-white/20 shrink-0" />
                          <span className="truncate max-w-[130px]">{t.card.pipeline.nome}</span>
                        </div>
                      </div>
                      {t.prazo && (
                        <span
                          className="shrink-0 text-[10.5px] tabular-nums"
                          style={{ color: atrasada ? `rgb(${c})` : 'hsl(215,16%,46%)' }}
                        >
                          {fmtDateTime(t.prazo)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassCard>
        </section>

        {/* Atividade recente */}
        <section aria-label="Atividade recente" className="crm-enter" style={{ animationDelay: "280ms" }}>
          <SectionHeader title="Atividade recente" hint={`${historicoRecente.length} eventos`} />
          <GlassCard className="mt-3 h-full p-3 sm:p-4">
            <div className="crm-scroll max-h-[440px] overflow-y-auto pr-1">
              {historicoRecente.length === 0 ? (
                <p className="text-xs text-[hsl(215,16%,42%)]">Sem atividade recente.</p>
              ) : (
                <ul className="crm-timeline pl-0 space-y-2">
                  {historicoRecente.map((h) => {
                    const Icone = getAcaoVisual(h.acao);
                    return (
                      <li key={h.id} className="relative pl-7">
                        <span
                          className="absolute left-1 top-1.5 h-2.5 w-2.5 rounded-full"
                          style={{
                            background: 'rgb(0,230,195)',
                            boxShadow: '0 0 0 3px rgba(0,230,195,0.14), 0 0 12px rgba(0,230,195,0.6)',
                          }}
                          aria-hidden
                        />
                        <button
                          onClick={() => setCardSelecionadoId(h.card.id)}
                          className="group w-full text-left rounded-xl border border-white/[0.04] px-3 py-2.5 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/[0.03] hover:translate-x-[2px] hover:border-white/[0.10]"
                          style={{ background: 'rgba(10,20,38,0.42)' }}
                        >
                          <div className="flex items-start gap-2.5">
                            <span
                              className="mt-0.5 grid h-6 w-6 place-items-center rounded-md shrink-0"
                              style={{
                                background: 'rgba(0,230,195,0.08)',
                                border: '1px solid rgba(0,230,195,0.18)',
                              }}
                            >
                              <Icone
                                size={12}
                                strokeWidth={2}
                                className="text-[hsl(160,100%,55%)]"
                              />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[12.5px] text-white">
                                <span className="font-medium">{h.usuario?.nome ?? 'sistema'}</span>
                                <span className="text-[hsl(215,16%,46%)]"> · {h.acao.replace(/_/g, ' ').toLowerCase()}</span>
                              </p>
                              <p className="mt-0.5 text-[11px] text-[hsl(215,16%,42%)] truncate">
                                {h.card.empresa.razaoSocial} · {h.card.pipeline.nome}
                              </p>
                              <p className="mt-0.5 text-[10.5px] tabular-nums text-[hsl(215,16%,38%)]">
                                {fmtDateTime(h.createdAt)}
                              </p>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </GlassCard>
        </section>
      </div>

      {cardSelecionadoId && (
        <CardFullViewModal
          cardId={cardSelecionadoId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          accent={accent}
          onClose={() => setCardSelecionadoId(null)}
          onAtualizado={() => {}}
          onAbrirCard={(id) => setCardSelecionadoId(id)}
        />
      )}
    </div>
  );
}
