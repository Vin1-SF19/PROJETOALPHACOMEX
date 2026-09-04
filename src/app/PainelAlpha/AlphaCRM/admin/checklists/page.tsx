import { redirect } from "next/navigation";

import { auth } from "../../../../../../auth";
import { ListarWorkspaceChecklistsBpm } from "@/actions/bpm/Checklists";
import { ChecklistsWorkspace } from "@/components/bpm/checklists/ChecklistsWorkspace";
import { isAdminRole } from "@/lib/bpm/ownership";
import { getTema } from "@/lib/temas";

export const dynamic = "force-dynamic";

export default async function ChecklistsAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!isAdminRole(session.user.role ?? null)) redirect("/PainelAlpha/AlphaCRM");

  const resultado = await ListarWorkspaceChecklistsBpm();
  const temaNome = (session.user as { tema_interface?: string }).tema_interface || "blue";
  const visual = getTema(temaNome);

  return (
    <ChecklistsWorkspace
      workspace={resultado.data}
      erro={resultado.success ? null : resultado.error}
      accent={visual.accent}
    />
  );
}
