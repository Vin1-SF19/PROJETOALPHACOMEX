import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import { ExtratosListagem } from "@/components/Extratos/ExtratosListagem";

export const dynamic = "force-dynamic";

export default async function ExtratosBancariosPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const rec = userId
    ? await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } })
    : null;
  const temaName = rec?.tema_interface ?? "blue";

  return <ExtratosListagem temaName={temaName} />;
}
