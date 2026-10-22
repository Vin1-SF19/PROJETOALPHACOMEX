import { obterAtorChecklist, obterCapacidadesChecklist } from "@/lib/checklist/acesso";
import { ModelosWorkspace } from "@/components/checklist/ModelosWorkspace";
export default async function Page() {
  const ator = await obterAtorChecklist();
  const caps = await obterCapacidadesChecklist(ator, { analistaId: null });
  return <ModelosWorkspace canManage={caps.canManageModels} />;
}
