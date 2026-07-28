import { auth } from "../../../../../auth";
import { redirect } from "next/navigation";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { PainelDivergencias } from "@/components/Comissoes/Divergencias/PainelDivergencias";

export const dynamic = "force-dynamic";

export default async function DivergenciasComissoesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = session.user.role ?? "";
  const isAdmin = role === "Admin" || role === "CEO";

  if (!isAdmin) {
    const perms = await getPermissoesEfetivas(userId);
    if (!perms.includes("comissoes")) redirect("/PainelAlpha");
  }

  return <PainelDivergencias />;
}
