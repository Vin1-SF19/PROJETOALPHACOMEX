"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { erroChecklist, type EmpresaDetalhe } from "@/lib/checklist/client/types";
import { Acao, Falha, campoChecklist } from "./ChecklistUI";
export function ChecklistExport({ empresa }: { empresa: EmpresaDetalhe }) {
  const [zipScope, setZipScope] = useState("ATIVO"),
    [zipBusy, setZipBusy] = useState(false),
    [zipError, setZipError] = useState("");
  async function zip() {
    setZipBusy(true);
    setZipError("");
    try {
      const params = empresa?.historical ? `checklistId=${encodeURIComponent(empresa.checklist?.id ?? "")}` : `escopo=${zipScope}`;
      const response = await fetch(`/api/checklist/${encodeURIComponent(empresa.id)}/documentos/zip?${params}`);
      if (!response.ok) throw new Error("Não foi possível gerar o ZIP. Tente um escopo menor ou recarregue o atendimento.");
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `checklist-${zipScope.toLowerCase()}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setZipError(erroChecklist(e));
    } finally {
      setZipBusy(false);
    }
  }

  return (
    <div className="space-y-2 md:col-span-2">
      <div className="flex flex-wrap gap-2">
        {!empresa.historical && (
          <label className="text-xs text-slate-400">
            Exportar
            <select value={zipScope} onChange={(e) => setZipScope(e.target.value)} className={campoChecklist + " mt-1"}>
              <option value="ATIVO">Somente checklist ativo</option>
              <option value="TODOS">Todos os tipos preservados</option>
            </select>
          </label>
        )}
        <Acao disabled={zipBusy || !empresa.checklist} onClick={() => void zip()}>
          <Download size={15} />
          {zipBusy ? "Preparando ZIP…" : empresa.historical ? "ZIP deste histórico" : "Baixar ZIP"}
        </Acao>
      </div>
      <p className="text-xs text-slate-500">Confira manifesto.json no arquivo: ele informa documentos aceitos e eventuais falhas.</p>
      {zipError && <Falha error={zipError} />}
    </div>
  );
}
