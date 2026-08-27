import { auth } from "../../../../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import { getPermissaoParceiros } from "@/actions/parceiros";
import { ListarParceirosParaKanban } from "@/actions/parceiros-desenvolvimento";
import KanbanRelacionamentoParceiros from "@/components/Parceiros/Relacionamento/KanbanRelacionamentoParceiros";

export const dynamic = "force-dynamic";

export default async function RelacionamentoParceirosPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const rec = userId
    ? await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } })
    : null;
  const temaName = rec?.tema_interface ?? "blue";

  const [permissao, { itens }] = await Promise.all([
    getPermissaoParceiros(),
    ListarParceirosParaKanban(),
  ]);

  if (!permissao.isAdmin && !permissao.podeEditar) {
    redirect("/PainelAlpha/Parceiros");
  }

  return (
    <KanbanRelacionamentoParceiros
      temaName={temaName}
      permissao={permissao}
      itensIniciais={itens}
    />
  );
}
