"use client";

import { useMemo, type KeyboardEvent } from "react";
import { TimelineEvent } from "@/lib/timeline/types";
import { fmtDateTime } from "@/lib/format-date";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MODULE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  crm: { bg: "bg-blue-500/15", text: "text-blue-400", dot: "bg-blue-500" },
  "cs-nps": { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-500" },
  comissoes: { bg: "bg-orange-500/15", text: "text-orange-400", dot: "bg-orange-500" },
  metas: { bg: "bg-purple-500/15", text: "text-purple-400", dot: "bg-purple-500" },
  seo: { bg: "bg-cyan-500/15", text: "text-cyan-400", dot: "bg-cyan-500" },
  radar: { bg: "bg-rose-500/15", text: "text-rose-400", dot: "bg-rose-500" },
  calendario: { bg: "bg-yellow-500/15", text: "text-yellow-400", dot: "bg-yellow-500" },
};

const FALLBACK_COLOR = { bg: "bg-slate-500/15", text: "text-slate-400", dot: "bg-slate-500" };

interface TimelineProps {
  events: TimelineEvent[];
  onEventClick?: (event: TimelineEvent) => void;
}

function getMonthYearLabel(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

export function Timeline({ events, onEventClick }: TimelineProps) {
  const monthYearLabels = useMemo(() => events.map((event) => getMonthYearLabel(event.timestamp)), [events]);

  if (events.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-slate-500">Nenhum evento registrado para este cliente.</p>
      </div>
    );
  }

  return (
    <ol role="list" className="relative space-y-0" aria-label="Timeline de eventos do cliente">
      {events.map((event, index) => {
        const monthYear = monthYearLabels[index];
        const showSeparator = index === 0 || monthYear !== monthYearLabels[index - 1];

        const color = MODULE_COLORS[event.module] ?? FALLBACK_COLOR;
        const cardId = event.metadata?.cardId;
        const clickable = event.module === "crm" && typeof cardId === "number" && onEventClick;

        return (
          <li key={event.id} role="listitem" className="relative">
            {showSeparator && (
              <div className="mb-4 mt-6 flex items-center gap-3 first:mt-0" aria-hidden="true">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {monthYear}
                </span>
                <div className="h-px flex-1 bg-white/5" />
              </div>
            )}

            <div className="flex gap-4">
              {/* Dot + line */}
              <div className="flex flex-col items-center" aria-hidden="true">
                <span
                  className={cn(
                    "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-slate-950",
                    color.dot
                  )}
                />
                {index < events.length - 1 && (
                  <span className="w-px flex-1 bg-white/10" />
                )}
              </div>

              {/* Content */}
              <div
                className={cn(
                  "min-w-0 flex-1 pb-5",
                  clickable && "-mx-2 -my-1 cursor-pointer rounded-lg px-2 py-1 transition-colors hover:bg-white/5"
                )}
                {...(clickable
                  ? {
                      role: "button",
                      tabIndex: 0,
                      onClick: () => onEventClick(event),
                      onKeyDown: (e: KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onEventClick(event);
                        }
                      },
                      "aria-label": `Abrir card: ${event.title}`,
                    }
                  : {})}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("border-transparent font-semibold", color.bg, color.text)}
                    aria-label={`Módulo: ${event.moduleLabel}`}
                  >
                    {event.moduleLabel}
                  </Badge>
                  <time
                    dateTime={event.timestamp}
                    className="text-xs text-slate-500"
                  >
                    {fmtDateTime(event.timestamp)}
                  </time>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-200">{event.title}</p>
                {event.description && (
                  <p className="mt-0.5 text-xs text-slate-400">{event.description}</p>
                )}
                {event.actor && (
                  <p className="mt-0.5 text-[11px] text-slate-600">{event.actor}</p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
