import { obterAtorChecklist, obterCapacidadesChecklist } from "@/lib/checklist/acesso";
import ListaChecklist from "./ListaChecklist";
export default async function CheckListPage() {
  const ator = await obterAtorChecklist();
  const caps = await obterCapacidadesChecklist(ator, { analistaId: null });
  return <ListaChecklist canCreate={caps.canCreateOwn} canAssign={caps.canAssignOwner} />;
}
