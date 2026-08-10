import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { isAdminRole } from "@/lib/roles";
import { CentralDeNotas } from "@/components/Notas/Central/CentralDeNotas";
import db from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NotasPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = session.user.role ?? "";
  const isAdmin = isAdminRole(role);

  if (!isAdmin) {
    const perms = await getPermissoesEfetivas(userId);
    if (!perms.includes("notas")) redirect("/PainelAlpha");
  }

  const rec = userId > 0 ? await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } }) : null;
  const temaName = rec?.tema_interface ?? "blue";

  return <CentralDeNotas temaName={temaName} />;
}
