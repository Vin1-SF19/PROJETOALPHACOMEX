import { adicionarDias, formatarDataCivil, inicioDoDia } from "@/components/CalendarioAlpha/lib/datas";

export const PIPELINE_OPERACIONAL_CHECKLIST_ID = "cmuih4tnh000409gm5z34jvss";
export const ETAPA_ENVIO_CHECKLIST_ID = "draft-stage-b455e79f-2390-43f2-bed9-6e86054aa95a";
export const CAMPO_CHECKLIST_EXCEL = "alpha.operacional.checklist.atualizado.excel";
export const TITULO_TAREFA_CHECKLIST = "Enviar checklist atualizado";

export function planilhaChecklistValida(nome: string, tipo: string | null | undefined): boolean {
  const extensao = /\.(xlsx|xls)$/i.exec(nome.trim())?.[1]?.toLowerCase();
  if (!extensao) return false;
  return extensao === "xlsx"
    ? tipo === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : tipo === "application/vnd.ms-excel";
}

export function prazoEnvioChecklist(dataReuniao: Date | null | undefined): Date | null {
  if (!dataReuniao || Number.isNaN(dataReuniao.getTime())) return null;
  return new Date(adicionarDias(inicioDoDia(dataReuniao), 1).getTime() - 1);
}

export function checklistNoDiaDaReuniao(dataReuniao: Date | null | undefined, enviadoEm: Date): boolean {
  return Boolean(dataReuniao && formatarDataCivil(dataReuniao) === formatarDataCivil(enviadoEm));
}
