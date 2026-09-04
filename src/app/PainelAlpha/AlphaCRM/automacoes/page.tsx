import { redirect } from "next/navigation";

import { auth } from "../../../../../auth";
import {
  ListarCatalogosAutomacoesBpm,
  ListarWorkspaceAutomacoesBpm,
} from "@/actions/bpm/Automacoes";
import { AutomacoesWorkspace } from "@/components/bpm/automacoes/AutomacoesWorkspace";
import { ListarMonitoramentoAutomacoesCentraisBpm } from "@/actions/bpm/AutomacoesCentrais";
import { MotorCentralPanel } from "@/components/bpm/automacoes/MotorCentralPanel";
import { isAdminRole } from "@/lib/roles";
import { getTema } from "@/lib/temas";

export const dynamic = "force-dynamic";

export default async function AutomacoesBpmPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!isAdminRole(session.user.role ?? null)) redirect("/PainelAlpha/AlphaCRM");

  const [workspace, catalogos, central] = await Promise.all([
    ListarWorkspaceAutomacoesBpm(),
    ListarCatalogosAutomacoesBpm(),
    ListarMonitoramentoAutomacoesCentraisBpm(),
  ]);
  const temaNome = (session.user as { tema_interface?: string }).tema_interface || "blue";
  const visual = getTema(temaNome);

  return (
    <div>
      {central.success && <div className="mx-auto max-w-[1500px] px-4 pt-4 sm:px-6 sm:pt-6"><MotorCentralPanel monitor={central.data} pipelines={workspace.data} accent={visual.accent} /></div>}
      <AutomacoesWorkspace
      pipelines={workspace.data}
      catalogos={catalogos.data}
      erro={workspace.success ? (catalogos.success ? null : catalogos.error) : workspace.error}
      accent={visual.accent}
      />
    </div>
  );
}
