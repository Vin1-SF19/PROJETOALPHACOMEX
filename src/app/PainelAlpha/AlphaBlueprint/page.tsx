import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { BlueprintDashboard } from "@/components/AlphaBlueprint/BlueprintDashboard";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function AlphaBlueprintPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = session.user.role ?? "";
  const isAdmin = isAdminRole(role);

  if (!isAdmin) {
    const perms = await getPermissoesEfetivas(userId);
    if (!perms.includes("blueprint")) redirect("/PainelAlpha");
  }

  const rec = userId
    ? await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true, onboarding_blueprint_visto: true } })
    : null;
  const temaName = rec?.tema_interface ?? "blue";
  const onboardingVisto = rec?.onboarding_blueprint_visto ?? false;

  return <BlueprintDashboard temaName={temaName} onboardingVisto={onboardingVisto} userId={userId} isAdmin={isAdmin} />;
}
