"use client";

import { ClipboardCopy, ExternalLink, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { checklistNoDiaDaReuniao, prazoEnvioChecklist } from "@/lib/bpm/checklist-envio-operacional";

export function PainelEnvioChecklistOperacional({ dataReuniao, anexo, tarefa }: {
  dataReuniao: Date | string | null;
  anexo: { nome: string; url: string; createdAt: Date | string } | null;
  tarefa: { status: string; prazo: Date | string | null } | null;
}) {
  const reuniao = dataReuniao ? new Date(dataReuniao) : null;
  const criadoEm = anexo ? new Date(anexo.createdAt) : null;
  const noPrazo = reuniao && criadoEm ? checklistNoDiaDaReuniao(reuniao, criadoEm) : false;
  const prazo = tarefa?.prazo ? new Date(tarefa.prazo) : prazoEnvioChecklist(reuniao);

  async function copiarLink() {
    if (!anexo) return;
    try { await navigator.clipboard.writeText(new URL(anexo.url, window.location.origin).href); toast.success("Link do checklist copiado."); }
    catch { toast.error("Não foi possível copiar o link."); }
  }

  return <section aria-label="Envio do checklist atualizado" className="space-y-2 rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] p-4 text-xs text-slate-200">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-sky-100"><FileSpreadsheet size={16} />Checklist atualizado</h3>
    <p>Checklist em Excel: anexe a planilha no campo configurado desta etapa. O link ficará vinculado ao card.</p>
    {prazo ? <p>Prazo da tarefa: <strong>{prazo.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</strong>.</p>
      : <p role="alert" className="text-amber-200">Data da reunião indisponível: confira o prazo antes de disponibilizar a planilha.</p>}
    {anexo ? <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-200 underline">
          {anexo.nome} <ExternalLink size={12} />
        </a>
        <button type="button" onClick={() => void copiarLink()} aria-label="Copiar link do checklist" className="inline-flex items-center gap-1 rounded border border-sky-300/25 px-2 py-1 text-sky-100">
          <ClipboardCopy size={12} /> Copiar link
        </button>
      </div>
      <p>Disponibilizado em {criadoEm?.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
        {reuniao ? (noPrazo ? " No dia da reunião." : " Fora do dia da reunião.") : " Prazo sem data da reunião para comparar."}</p>
    </div> : <p role="alert" className="text-amber-200">Planilha Excel ainda não anexada.</p>}
    {tarefa && <p>Tarefa: {tarefa.status === "CONCLUIDA" ? "concluída" : "pendente"}.</p>}
  </section>;
}
