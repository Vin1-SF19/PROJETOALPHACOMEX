"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bug,
  Check,
  Copy,
  Download,
  Eraser,
  Info,
  Terminal,
  TriangleAlert,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Z_INDEX } from "@/lib/z-index";
import { cn } from "@/lib/utils";
import {
  useDebugStore,
  useFilteredDebugEvents,
  type DebugFilterLevel,
  type DebugFilterSource,
} from "@/store/useDebugStore";
import type { DebugEvent } from "@/lib/debug/error-types";

const LEVEL_OPTIONS: Array<{ value: DebugFilterLevel; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "error", label: "Erros" },
  { value: "warn", label: "Alertas" },
  { value: "info", label: "Info" },
];

const SOURCE_OPTIONS: Array<{ value: DebugFilterSource; label: string }> = [
  { value: "all", label: "Todas fontes" },
  { value: "console", label: "Console" },
  { value: "unhandledrejection", label: "Promise" },
  { value: "unhandlederror", label: "Global" },
  { value: "server-action", label: "Server Action" },
  { value: "api", label: "API" },
  { value: "custom", label: "Custom" },
];

function formatTime(value: string): string {
  const date = new Date(value);
  return date.toLocaleTimeString("pt-BR", { hour12: false });
}

function levelClassName(level: DebugEvent["level"]): string {
  if (level === "error") return "bg-rose-500/10 text-rose-300 border-rose-500/30";
  if (level === "warn") return "bg-amber-500/10 text-amber-300 border-amber-500/30";
  return "bg-sky-500/10 text-sky-300 border-sky-500/30";
}

function LevelIcon({ level, className }: { level: DebugEvent["level"]; className?: string }) {
  if (level === "error") return <TriangleAlert className={className} />;
  if (level === "warn") return <AlertTriangle className={className} />;
  return <Info className={className} />;
}

function DebugEventItem({ event, selected, onSelect }: { event: DebugEvent; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border px-3 py-2 text-left transition-colors",
        selected ? "border-white/20 bg-white/[0.08]" : "border-white/5 bg-slate-950/40 hover:bg-white/[0.04]",
      )}
    >
      <div className="flex items-center gap-2">
        <LevelIcon level={event.level} className="size-4 shrink-0" />
        <span className="truncate text-sm text-slate-100">{event.message}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
        <span>{formatTime(event.ts)}</span>
        <span>{event.source}</span>
      </div>
    </button>
  );
}

function DebugDetail({ event }: { event: DebugEvent }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const payload = JSON.stringify(event, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(event, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `debug-event-${event.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className={levelClassName(event.level)}>
          <LevelIcon level={event.level} className="size-3" />
          {event.level}
        </Badge>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-xs" onClick={copy} aria-label="Copiar evento">
            {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" onClick={download} aria-label="Baixar evento">
            <Download className="size-3" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-white/5 bg-black/30 p-3 font-mono text-xs leading-relaxed">
        <p className="whitespace-pre-wrap break-words text-slate-100">{event.message}</p>
        {event.stack && (
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-950/70 p-2 text-[11px] text-rose-200/80">
            {event.stack}
          </pre>
        )}
        {event.meta && (
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-950/70 p-2 text-[11px] text-slate-300">
            {JSON.stringify(event.meta, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export function DebugErrorOverlay() {
  const events = useDebugStore((state) => state.events);
  const isOpen = useDebugStore((state) => state.isOpen);
  const selectedId = useDebugStore((state) => state.selectedId);
  const levelFilter = useDebugStore((state) => state.levelFilter);
  const sourceFilter = useDebugStore((state) => state.sourceFilter);
  const toggle = useDebugStore((state) => state.toggle);
  const clear = useDebugStore((state) => state.clear);
  const select = useDebugStore((state) => state.select);
  const setLevelFilter = useDebugStore((state) => state.setLevelFilter);
  const setSourceFilter = useDebugStore((state) => state.setSourceFilter);

  const filtered = useFilteredDebugEvents();
  const selected = useMemo(
    () => filtered.find((event) => event.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );
  const errorCount = events.filter((event) => event.level === "error").length;

  if (events.length === 0 && !isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[99998] flex flex-col items-end gap-2">
      <motion.button
        type="button"
        onClick={toggle}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex h-11 items-center gap-2 rounded-full border px-4 text-xs font-bold uppercase tracking-wider shadow-2xl backdrop-blur-xl transition-colors",
          errorCount > 0
            ? "border-rose-500/40 bg-rose-950/70 text-rose-100 hover:bg-rose-900/70"
            : "border-white/10 bg-slate-950/80 text-slate-200 hover:bg-slate-900/80",
        )}
        aria-expanded={isOpen}
        aria-controls="alpha-debug-overlay"
      >
        <Bug className="size-4" />
        <span>Debug</span>
        {events.length > 0 && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] tabular-nums">{events.length}</span>
        )}
      </motion.button>

      {isOpen && (
        <motion.div
          id="alpha-debug-overlay"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="flex h-[min(70vh,620px)] w-[min(92vw,900px)] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur-2xl"
          style={{ zIndex: Z_INDEX.alertaCritico + 1 }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-slate-300" />
              <h2 className="text-sm font-bold text-white">Hook de Erros</h2>
              <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-300">
                {filtered.length} eventos
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon-xs" onClick={clear} aria-label="Limpar eventos">
                <Eraser className="size-3" />
              </Button>
              <Button type="button" variant="ghost" size="icon-xs" onClick={toggle} aria-label="Fechar overlay">
                <X className="size-3" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-2">
            <select
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value as DebugFilterLevel)}
              className="h-8 rounded-lg border border-white/10 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-white/20"
              aria-label="Filtrar por nível"
            >
              {LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as DebugFilterSource)}
              className="h-8 rounded-lg border border-white/10 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-white/20"
              aria-label="Filtrar por fonte"
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-h-0 flex-1 md:grid md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <div className="max-h-64 space-y-2 overflow-y-auto border-b border-white/5 p-3 md:max-h-none md:border-b-0 md:border-r">
              {filtered.length === 0 ? (
                <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center text-slate-500">
                  <Bug className="size-6" />
                  <p className="text-xs">Nenhum evento capturado ainda.</p>
                </div>
              ) : (
                filtered.map((event) => (
                  <DebugEventItem
                    key={event.id}
                    event={event}
                    selected={selected?.id === event.id}
                    onSelect={() => select(event.id)}
                  />
                ))
              )}
            </div>
            <div className="max-h-72 overflow-hidden p-3 md:max-h-none">
              {selected ? (
                <DebugDetail event={selected} />
              ) : (
                <div className="flex h-full min-h-40 items-center justify-center text-sm text-slate-500">
                  Selecione um evento para ver detalhes.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
