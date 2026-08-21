"use client";

import { useState, useTransition } from "react";
import { Download, Sheet } from "lucide-react";
import {
  ExportarCsvAlphaSeo,
  ExportarGoogleSheetsAlphaSeo,
} from "@/actions/AlphaSeoExports";

type ExportKind =
  | "KEYWORD_RESEARCH"
  | "SAVED_KEYWORDS"
  | "BACKLINKS"
  | "DOMAIN_KEYWORDS"
  | "DOMAIN_PAGES"
  | "AUDIT_ISSUES"
  | "AUDIT_PAGES"
  | "AUDIT_LIGHTHOUSE"
  | "SEARCH_PERFORMANCE"
  | "BRAND_LOOKUP"
  | "PROMPT_EXPLORER";

interface ExportButtonsProps {
  projectId: string;
  kind: ExportKind;
  rows: Array<Record<string, unknown>>;
  columns: Array<{ key: string; label: string }>;
  title: string;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCsvPayload(value: unknown): value is CsvPayload {
  return (
    isRecord(value) &&
    typeof value.filename === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.content === "string"
  );
}

function isSheetsPayload(value: unknown): value is SheetsPayload {
  return (
    isRecord(value) &&
    typeof value.clipboardText === "string" &&
    typeof value.spreadsheetUrl === "string"
  );
}

export function ExportButtons({
  projectId,
  kind,
  rows,
  columns,
  title,
}: ExportButtonsProps) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const payload = { projectId, kind, rows, columns, title };

  function downloadCsv() {
    startTransition(async () => {
      const result = await ExportarCsvAlphaSeo(payload);
      if (!result.success || !isCsvPayload(result.data)) {
        setMessage(result.success ? "Exportação inválida." : result.error);
        return;
      }
      const blob = new Blob([result.data.content], {
        type: result.data.mimeType,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.data.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(`${rows.length} linhas exportadas em CSV.`);
    });
  }

  function openSheets() {
    startTransition(async () => {
      const result = await ExportarGoogleSheetsAlphaSeo(payload);
      if (!result.success || !isSheetsPayload(result.data)) {
        setMessage(result.success ? "Exportação inválida." : result.error);
        return;
      }
      await navigator.clipboard.writeText(result.data.clipboardText);
      window.open(result.data.spreadsheetUrl, "_blank", "noopener,noreferrer");
      setMessage("Dados copiados. Cole na nova planilha aberta.");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={downloadCsv}
        disabled={pending || rows.length === 0}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 text-xs font-bold text-slate-200 transition hover:bg-white/[.08] disabled:opacity-40"
      >
        <Download size={14} aria-hidden="true" /> CSV
      </button>
      <button
        type="button"
        onClick={openSheets}
        disabled={pending || rows.length === 0}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 text-xs font-bold text-slate-200 transition hover:bg-white/[.08] disabled:opacity-40"
      >
        <Sheet size={14} aria-hidden="true" /> Sheets
      </button>
      {message && (
        <span role="status" className="text-xs text-slate-400">
          {message}
        </span>
      )}
    </div>
  );
}
