"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type PapelCompartilhamento = "VISUALIZADOR" | "EDITOR";

interface SeletorPapelCompartilhamentoProps {
  value: PapelCompartilhamento;
  onChange: (papel: PapelCompartilhamento) => void;
  disabled?: boolean;
}

/** Dropdown Visualizador/Editor, estilo Google Calendar. */
export function SeletorPapelCompartilhamento({ value, onChange, disabled }: SeletorPapelCompartilhamentoProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PapelCompartilhamento)} disabled={disabled}>
      <SelectTrigger className="w-[130px]" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="VISUALIZADOR">Visualizador</SelectItem>
        <SelectItem value="EDITOR">Editor</SelectItem>
      </SelectContent>
    </Select>
  );
}
