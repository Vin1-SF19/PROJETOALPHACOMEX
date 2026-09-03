import { redirect } from "next/navigation";

import { auth } from "../../../../../auth";
import {
  ListarTemplatesAutomacoesBpm,
  ListarWorkspaceAutomacoesBpm,
} from "@/actions/bpm/Automacoes";
import { AutomacoesWorkspace } from "@/components/bpm/automacoes/AutomacoesWorkspace";
import { isAdminRole } from "@/lib/roles";
import { getTema } from "@/lib/temas";

export const dynamic = "force-dynamic";

export default async function AutomacoesBpmPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!isAdminRole(session.user.role ?? null)) redirect("/PainelAlpha/AlphaCRM");

  const [workspace, templates] = await Promise.all([
    ListarWorkspaceAutomacoesBpm(),
    ListarTemplatesAutomacoesBpm(),
  ]);
  const temaNome = (session.user as { tema_interface?: string }).tema_interface || "blue";
  const visual = getTema(temaNome);

  return (
    <AutomacoesWorkspace
      pipelines={workspace.data}
      templates={templates.data}
      erro={workspace.success ? (templates.success ? null : templates.error) : workspace.error}
      accent={visual.accent}
    />
  );
}
