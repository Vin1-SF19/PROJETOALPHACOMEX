import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { ApresentacoesDashboard } from "@/components/Apresentacoes/Dashboard/ApresentacoesDashboard";

export const dynamic = "force-dynamic";

export default async function ApresentacoesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = session.user.role ?? "";
  const isAdmin = role === "Admin" || role === "CEO";

  if (!isAdmin) {
    const perms = await getPermissoesEfetivas(userId);
    if (!perms.includes("apresentacoes")) redirect("/PainelAlpha");
  }

  const rec = userId
    ? await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } })
    : null;
  const temaName = rec?.tema_interface ?? "blue";

  return <ApresentacoesDashboard temaName={temaName} />;
}
