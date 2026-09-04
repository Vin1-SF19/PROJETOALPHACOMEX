import { redirect } from "next/navigation";

import { auth } from "../../../../../../auth";
import { ListarWorkspaceRegrasFinanceiras } from "@/actions/bpm/RegrasFinanceiras";
import { RegrasFinanceirasWorkspace } from "@/components/bpm/regras-financeiras/RegrasFinanceirasWorkspace";
import { isAdminRole } from "@/lib/roles";
import { getTema } from "@/lib/temas";

export const dynamic = "force-dynamic";

export default async function RegrasFinanceirasPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!isAdminRole(session.user.role ?? null)) redirect("/PainelAlpha/AlphaCRM");
  const workspace = await ListarWorkspaceRegrasFinanceiras();
  const visual = getTema((session.user as { tema_interface?: string }).tema_interface || "blue");
  return <RegrasFinanceirasWorkspace {...workspace.data} erro={workspace.success ? null : workspace.error} accent={visual.accent} />;
}
