import { auth } from "../../../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import { getPermissaoParceiros } from "@/actions/parceiros";
import { ListarLeadsAquisicaoParceiros, ListarResponsaveisParceiros } from "@/actions/parceiros-aquisicao";
import AquisicaoParceirosClient from "@/components/Parceiros/Aquisicao/AquisicaoParceirosClient";

export const dynamic = "force-dynamic";

export default async function AquisicaoParceirosPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const rec = userId
    ? await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } })
    : null;
  const temaName = rec?.tema_interface ?? "blue";

  const [permissao, { leads }, { usuarios: responsaveis }] = await Promise.all([
    getPermissaoParceiros(),
    ListarLeadsAquisicaoParceiros(),
    ListarResponsaveisParceiros(),
  ]);

  if (!permissao.isAdmin && !permissao.podeEditar) {
    redirect("/PainelAlpha/Parceiros");
  }

  return (
    <AquisicaoParceirosClient
      temaName={temaName}
      permissao={permissao}
      leadsIniciais={leads}
      responsaveis={responsaveis}
    />
  );
}
