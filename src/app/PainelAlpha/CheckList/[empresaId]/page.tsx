import { obterEmpresaChecklist } from "@/actions/checklist";
import ChecklistView from "../ChecklistView";
import { Falha } from "@/components/checklist/ChecklistUI";
export default async function EmpresaChecklistPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ checklistId?: string }>;
}) {
  const { empresaId } = await params;
  const { checklistId } = await searchParams;
  const result = await obterEmpresaChecklist(empresaId, { checklistId });
  if (!result.ok) return <Falha error={result.error.message} />;
  return <ChecklistView empresaId={empresaId} initial={result.data} initialView={checklistId} />;
}
