"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock3, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface BpmDateTimeFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  error?: string | null;
  describedBy?: string;
}

function dataCivilParaDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const data = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (data.getFullYear() !== Number(match[1]) || data.getMonth() !== Number(match[2]) - 1 || data.getDate() !== Number(match[3])) return undefined;
  return data;
}

export function BpmDateTimeField({
  id,
  label,
  value,
  onChange,
  onCommit,
  required = false,
  disabled = false,
  allowClear = false,
  error,
  describedBy,
}: BpmDateTimeFieldProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dataParte = "", horaParte = ""] = value.split("T");
  const selected = dataCivilParaDate(dataParte);
  const errorId = error ? `${id}-error` : undefined;
  const ariaDescribedBy = [describedBy, errorId].filter(Boolean).join(" ") || undefined;

  function selecionarData(data: Date | undefined) {
    if (!data) return;
    const proximoValor = `${format(data, "yyyy-MM-dd")}T${horaParte || "09:00"}`;
    onChange(proximoValor);
    setCalendarOpen(false);
  }

  function alterarHora(hora: string) {
    if (!dataParte) return;
    onChange(`${dataParte}T${hora}`);
  }

  function limpar() {
    onChange("");
    onCommit?.("");
    setCalendarOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <label id={`${id}-label`} className="text-[11px] font-medium text-slate-400">
        {label}{required && <span className="ml-1 text-rose-400" aria-hidden="true">*</span>}
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen} modal>
          <PopoverTrigger asChild>
            <button
              id={id}
              type="button"
              disabled={disabled}
              aria-labelledby={`${id}-label ${id}`}
              aria-describedby={ariaDescribedBy}
              className={cn(
                "flex min-h-10 w-full items-center gap-2 rounded-xl border bg-white/[0.03] px-3 py-2 text-left text-xs outline-none transition-colors",
                "border-white/10 text-slate-200 hover:bg-white/[0.06] focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/10",
                !selected && "text-slate-500",
                error && "border-rose-400/50",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <CalendarDays size={14} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{selected ? format(selected, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={6}
            collisionPadding={12}
            className="w-[min(22rem,calc(100vw-1.5rem))] overflow-auto p-3"
            aria-label={`Calendário de ${label}`}
          >
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={selecionarData}
              locale={ptBR}
              autoFocus
              classNames={{
                root: "relative mx-auto text-sm",
                months: "flex",
                month: "w-full space-y-3",
                month_caption: "flex h-8 items-center justify-center font-semibold text-slate-200",
                nav: "absolute inset-x-3 top-3 flex justify-between",
                button_previous: "rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                button_next: "rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                month_grid: "w-full border-collapse",
                weekdays: "grid grid-cols-7",
                weekday: "py-1 text-center text-[10px] font-medium text-slate-500",
                week: "mt-1 grid grid-cols-7",
                day: "flex items-center justify-center p-0.5",
                day_button: "h-9 w-9 rounded-lg text-xs text-slate-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                selected: "[&>button]:bg-white/15 [&>button]:font-bold [&>button]:text-white",
                today: "[&>button]:border [&>button]:border-white/25",
                outside: "opacity-30",
                disabled: "opacity-30",
                hidden: "invisible",
              }}
            />
          </PopoverContent>
        </Popover>

        <div className="relative">
          <Clock3 size={13} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="time"
            value={horaParte}
            disabled={disabled || !selected}
            required={required}
            aria-label={`Hora de ${label}`}
            aria-invalid={Boolean(error)}
            aria-describedby={ariaDescribedBy}
            onChange={(event) => alterarHora(event.target.value)}
            onBlur={() => value && onCommit?.(value)}
            className={cn(
              "min-h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-8 pr-2 text-xs text-slate-200 outline-none transition-colors",
              "focus:border-white/30 focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-rose-400/50",
            )}
          />
        </div>
      </div>
      {allowClear && value && !disabled && (
        <button type="button" onClick={limpar} className="inline-flex min-h-8 items-center gap-1 text-[11px] text-slate-500 transition-colors hover:text-slate-300">
          <X size={12} aria-hidden="true" /> Limpar data e hora
        </button>
      )}
      {error && <p id={errorId} role="alert" className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
