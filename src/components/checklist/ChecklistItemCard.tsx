"use client";
import { useState } from "react";
import { statusChecklist } from "@/lib/checklist/schemas";
import { STATUS_LABELS } from "@/lib/checklist/items";
import type { EmpresaDetalhe, Item } from "@/lib/checklist/client/types";
import { Acao, campoChecklist } from "./ChecklistUI";
import { DocumentosItem } from "./DocumentosItem";
interface Props {
  item: Item;
  empresa: EmpresaDetalhe;
  busy: boolean;
  draft: string | undefined;
  onDraft: (value: string) => void;
  onSave: () => void;
  onStatus: (value: (typeof statusChecklist)[number]) => void;
  onReload: () => Promise<void>;
}
export function ChecklistItemCard({ item, empresa, busy, draft, onDraft, onSave, onStatus, onReload }: Props) {
  const [documentos, setDocumentos] = useState(false);
  const canEdit = empresa.capabilities.canEdit && !empresa.historical;
  return (
    <article id={`checklist-item-${item.id}`} className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 font-mono text-[10px] text-slate-500">
            {item.codigo} · {item.obrigatorio ? "Obrigatório" : "Condicional"}
          </p>
          <h3 className="text-sm font-semibold text-slate-100">{item.descricao}</h3>
          {item.complemento && <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.complemento}</p>}
        </div>
        <label className="text-xs text-slate-400">
          Status
          <select
            aria-label={`Status de ${item.descricao}`}
            value={item.status}
            disabled={busy || !canEdit}
            onChange={(e) => {
              const value = statusChecklist.find((v) => v === e.target.value);
              if (value) onStatus(value);
            }}
            className={campoChecklist + " mt-1"}
          >
            {!statusChecklist.some((s) => s === item.status) && (
              <option value={item.status} disabled>
                {STATUS_LABELS[item.status] ?? item.status}
              </option>
            )}
            {statusChecklist.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs text-slate-400">
        Observação técnica
        <textarea
          value={draft ?? item.observacao ?? ""}
          onChange={(e) => onDraft(e.target.value)}
          readOnly={!canEdit}
          disabled={busy}
          maxLength={5000}
          rows={2}
          className={campoChecklist + " mt-1"}
        />
      </label>
      <div className="mt-3 flex flex-wrap justify-between gap-2">
        {canEdit && draft !== undefined && draft !== (item.observacao ?? "") && (
          <Acao disabled={busy} onClick={onSave}>
            Salvar observação
          </Acao>
        )}
        <Acao onClick={() => setDocumentos((v) => !v)}>{documentos ? "Recolher documentos" : "Ver documentos"}</Acao>
      </div>
      {documentos && <DocumentosItem empresa={empresa} itemId={item.id} busy={busy} onReload={onReload} />}
    </article>
  );
}
