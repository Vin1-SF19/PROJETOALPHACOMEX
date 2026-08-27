import { auth } from "../../../../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import { getPermissaoParceiros } from "@/actions/parceiros";
import { ListarTodasIndicacoes } from "@/actions/parceiros-indicacoes";
import IndicacoesClient from "@/components/Parceiros/Indicacoes/IndicacoesClient";

export const dynamic = "force-dynamic";

export default async function IndicacoesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const rec = userId
    ? await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } })
    : null;
  const temaName = rec?.tema_interface ?? "blue";

  const [permissao, resultado] = await Promise.all([
    getPermissaoParceiros(),
    ListarTodasIndicacoes(),
  ]);

  return (
    <IndicacoesClient
      temaName={temaName}
      podeEditar={permissao.isAdmin || permissao.podeEditar}
      indicacoesIniciais={resultado.success ? resultado.indicacoes : []}
    />
  );
}
