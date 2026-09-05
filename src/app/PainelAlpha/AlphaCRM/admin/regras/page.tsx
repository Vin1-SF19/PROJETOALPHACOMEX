import { redirect } from "next/navigation";

import { auth } from "../../../../../../auth";
import { ListarWorkspaceRegrasBpm } from "@/actions/bpm/Regras";
import { RegrasWorkspace } from "@/components/bpm/regras/RegrasWorkspace";
import { isAdminRole } from "@/lib/roles";
import { getTema } from "@/lib/temas";

export const dynamic = "force-dynamic";

export default async function RegrasBpmPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!isAdminRole(session.user.role ?? null)) redirect("/PainelAlpha/AlphaCRM");

  const workspace = await ListarWorkspaceRegrasBpm();
  const temaNome = (session.user as { tema_interface?: string }).tema_interface || "blue";
  const visual = getTema(temaNome);

  return (
    <RegrasWorkspace
      pipelines={workspace.data.pipelines}
      regras={workspace.data.regras}
      erro={workspace.success ? null : workspace.error}
      accent={visual.accent}
    />
  );
}
