import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { ComissoesDashboard } from "@/components/Comissoes/ComissoesDashboard";

export const dynamic = "force-dynamic";

export default async function ComissoesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = session.user.role ?? "";
  const isAdmin = role === "Admin" || role === "CEO";

  if (!isAdmin) {
    const perms = await getPermissoesEfetivas(userId);
    if (!perms.includes("comissoes")) redirect("/PainelAlpha");
  }

  const usuario = userId ? await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } }) : null;
  const temaName = usuario?.tema_interface ?? "blue";

  return <ComissoesDashboard temaName={temaName} />;
}
