"use client";

import { useState, useTransition } from "react";
import { Download, Sheet } from "lucide-react";
import { ExportarCsvAlphaSeo, ExportarGoogleSheetsAlphaSeo } from "@/actions/AlphaSeoExports";

type ExportKind =
  | "BACKLINKS"
  | "DOMAIN_KEYWORDS"
  | "DOMAIN_PAGES"
  | "AUDIT_ISSUES"
  | "AUDIT_PAGES";

interface CompleteExportButtonsProps {
  projectId: string;
  kind: ExportKind;
  columns: Array<{ key: string; label: string }>;
  title: string;
  totalCount: number | null;
  loadRows: () => Promise<Array<Record<string, unknown>>>;
}

interface CsvPayload {
  filename: string;
  mimeType: string;
  content: string;
}

interface SheetsPayload {
  clipboardText: string;
  spreadsheetUrl: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function csvPayload(value: unknown): CsvPayload | null {
  const row = record(value);
  return row && typeof row.filename === "string" && typeof row.mimeType === "string" && typeof row.content === "string"
    ? { filename: row.filename, mimeType: row.mimeType, content: row.content }
    : null;
}

function sheetsPayload(value: unknown): SheetsPayload | null {
  const row = record(value);
  return row && typeof row.clipboardText === "string" && typeof row.spreadsheetUrl === "string"
    ? { clipboardText: row.clipboardText, spreadsheetUrl: row.spreadsheetUrl }
    : null;
}

export function CompleteExportButtons({
  projectId,
  kind,
  columns,
  title,
  totalCount,
  loadRows,
}: CompleteExportButtonsProps) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function run(format: "csv" | "sheets") {
    startTransition(async () => {
      try {
        setMessage("Carregando todas as páginas…");
        const rows = await loadRows();
        const payload = { projectId, kind, rows, columns, title };
        if (format === "csv") {
          const result = await ExportarCsvAlphaSeo(payload);
          const file = result.success ? csvPayload(result.data) : null;
          if (!result.success || !file) {
            setMessage(result.success ? "Exportação inválida." : result.error);
            return;
          }
          const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = file.filename;
          anchor.click();
          URL.revokeObjectURL(url);
        } else {
          const result = await ExportarGoogleSheetsAlphaSeo(payload);
          const file = result.success ? sheetsPayload(result.data) : null;
          if (!result.success || !file) {
            setMessage(result.success ? "Exportação inválida." : result.error);
            return;
          }
          await navigator.clipboard.writeText(file.clipboardText);
          window.open(file.spreadsheetUrl, "_blank", "noopener,noreferrer");
        }
        setMessage(`${rows.length.toLocaleString("pt-BR")} linhas exportadas.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Não foi possível exportar o conjunto completo.");
      }
    });
  }

  const countLabel = totalCount == null ? "todas as páginas" : `${Math.min(totalCount, 10_000).toLocaleString("pt-BR")} linhas`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => run("csv")} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 text-xs font-bold text-slate-200 disabled:opacity-40">
        <Download size={14} aria-hidden="true" /> CSV completo
      </button>
      <button type="button" onClick={() => run("sheets")} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 text-xs font-bold text-slate-200 disabled:opacity-40">
        <Sheet size={14} aria-hidden="true" /> Sheets
      </button>
      <span role="status" className="text-xs text-slate-500">{message || countLabel}</span>
    </div>
  );
}
