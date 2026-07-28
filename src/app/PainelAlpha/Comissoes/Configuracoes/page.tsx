import { auth } from "../../../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { ConfiguracoesComissoes } from "@/components/Comissoes/Configuracoes/ConfiguracoesComissoes";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesComissoesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = session.user.role ?? "";
  const isAdmin = role === "Admin" || role === "CEO";

  if (!isAdmin) {
    const perms = await getPermissoesEfetivas(userId);
    if (!perms.includes("comissoes")) redirect("/PainelAlpha");
  }

  const setores = await db.setor.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return <ConfiguracoesComissoes setores={setores} />;
}
