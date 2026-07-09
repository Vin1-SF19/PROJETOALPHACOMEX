import { auth } from "../../../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import { ExtratoDetalhe } from "@/components/Extratos/ExtratoDetalhe";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ Id: string }>;
}

export default async function ExtratoDetalhePage({ params }: PageProps) {
  const { Id } = await params;

  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const rec = userId
    ? await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } })
    : null;
  const temaName = rec?.tema_interface ?? "blue";

  return <ExtratoDetalhe extratoId={Id} temaName={temaName} />;
}
