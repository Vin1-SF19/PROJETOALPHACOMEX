import { auth } from "../../../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import ParceirosLayoutClient from "@/components/Parceiros/ParceirosLayoutClient";

export default async function ParceirosLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const rec = userId
    ? await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } })
    : null;
  const temaName = rec?.tema_interface ?? "blue";

  return <ParceirosLayoutClient temaName={temaName}>{children}</ParceirosLayoutClient>;
}
