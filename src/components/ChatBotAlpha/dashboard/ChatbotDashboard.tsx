"use client";

import { Activity, ArrowDownRight, ArrowUpRight, Bot, Clock3, MessagesSquare, Workflow } from "lucide-react";
import type { DashboardData } from "@/types/chatbot";

const icons = [MessagesSquare, Clock3, Activity, Bot, Workflow, Activity];

export function ChatbotDashboard({ data }: { data: DashboardData }) {
  const maxVolume = Math.max(1, ...data.volume.flatMap((point) => [point.received, point.sent]));

  return (
    <div className="space-y-5 p-4 md:p-5" data-testid="chatbot-dashboard">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {data.metrics.map((metric, index) => {
          const Icon = icons[index % icons.length];
          const positive = metric.tone === "positive";
          return (
            <article key={metric.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4 shadow-sm transition-colors hover:border-indigo-400/30">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-slate-400">{metric.label}</p>
                <Icon className="size-4 text-indigo-300" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{metric.value}</p>
              <p className={`mt-1 flex items-center gap-1 text-xs ${metric.tone === "warning" ? "text-amber-300" : positive ? "text-emerald-300" : "text-slate-400"}`}>
                {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{metric.change}
              </p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.8fr)]">
        <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <div className="mb-5 flex items-center justify-between">
            <div><h2 className="font-semibold text-white">Volume de mensagens</h2><p className="text-xs text-slate-400">Movimento operacional nas últimas horas</p></div>
            <div className="flex gap-3 text-xs text-slate-400"><span><i className="mr-1 inline-block size-2 rounded-full bg-indigo-400" />Recebidas</span><span><i className="mr-1 inline-block size-2 rounded-full bg-cyan-400" />Enviadas</span></div>
          </div>
          <div className="flex h-52 items-end gap-3" role="img" aria-label="Gráfico de volume de mensagens recebidas e enviadas">
            {data.volume.map((point) => (
              <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-40 w-full max-w-14 items-end justify-center gap-1">
                  <div className="w-2/5 rounded-t bg-indigo-400/80" style={{ height: `${(point.received / maxVolume) * 100}%` }} title={`${point.received} recebidas`} />
                  <div className="w-2/5 rounded-t bg-cyan-400/70" style={{ height: `${(point.sent / maxVolume) * 100}%` }} title={`${point.sent} enviadas`} />
                </div>
                <span className="text-[11px] text-slate-500">{point.label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <h2 className="font-semibold text-white">Fila agora</h2><p className="mb-4 text-xs text-slate-400">Distribuição dos atendimentos</p>
          <div className="space-y-3">
            {data.queue.map((item, index) => (
              <div key={item.label} className="rounded-lg border border-white/5 bg-white/[0.025] p-3">
                <div className="mb-2 flex justify-between text-sm"><span className="text-slate-300">{item.label}</span><strong className="text-white">{item.value}</strong></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className={index === 0 ? "h-full bg-indigo-400" : index === 1 ? "h-full bg-cyan-400" : "h-full bg-amber-400"} style={{ width: `${Math.min(100, item.value * 4)}%` }} /></div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
        <h2 className="font-semibold text-white">Canais com maior volume</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {data.channelVolume.map((item) => <div key={item.channel} className="flex items-center justify-between rounded-lg bg-white/[0.035] px-3 py-2 text-sm"><span className="capitalize text-slate-300">{item.channel}</span><strong className="text-white">{item.count}</strong></div>)}
        </div>
      </section>
    </div>
  );
}
