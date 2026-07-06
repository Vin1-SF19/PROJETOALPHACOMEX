import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import { listarParceiros, getPermissaoParceiros } from "@/actions/parceiros";
import { getTemplateParadaoConvite } from "@/actions/onboarding";
import ParceirosClient from "@/components/Parceiros/ParceirosClient";

export const dynamic = "force-dynamic";

export default async function ParceirosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; nivel?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const rec = userId
    ? await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } })
    : null;
  const temaName = rec?.tema_interface ?? "blue";

  const { busca, nivel } = await searchParams;
  const [{ parceiros }, permissao, templateConvite] = await Promise.all([
    listarParceiros(busca, nivel),
    getPermissaoParceiros(),
    getTemplateParadaoConvite(),
  ]);

  return (
    <ParceirosClient
      parceiros={parceiros}
      temaName={temaName}
      busca={busca}
      nivel={nivel}
      permissao={permissao}
      templateConvite={templateConvite}
    />
  );
}
