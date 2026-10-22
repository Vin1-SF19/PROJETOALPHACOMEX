import { notFound } from "next/navigation";
import { obterAtorChecklist, obterCapacidadesChecklist } from "@/lib/checklist/acesso";
import { tiposChecklist } from "@/lib/checklist/schemas";
import { ModelosWorkspace } from "@/components/checklist/ModelosWorkspace";
export default async function Page({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!tiposChecklist.some((t) => t === tipo)) notFound();
  const ator = await obterAtorChecklist();
  const caps = await obterCapacidadesChecklist(ator, { analistaId: null });
  return <ModelosWorkspace canManage={caps.canManageModels} tipoInicial={tipo} />;
}
