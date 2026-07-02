import { auth } from "../../../auth"; 
import { redirect, notFound } from "next/navigation";
import db from "@/lib/prisma";
import { buscarParceiro, getPermissaoParceiros } from "@/actions/parceiros";
import DetalheParceiroClient, { type DetalheParceiro } from "./DetalheParceiroClient";

export const dynamic = "force-dynamic";

export default async function DetalheParceiroPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const { id } = await params;
  const userId = Number((session.user as { id?: string | number }).id ?? 0);

  const [parceiroRaw, permissao, rec] = await Promise.all([
    buscarParceiro(Number(id)),
    getPermissaoParceiros(),
    userId ? db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } }) : null,
  ]);
  if (!parceiroRaw) notFound();

  const parceiro = parceiroRaw as unknown as DetalheParceiro;
  const temaName = rec?.tema_interface ?? "blue";

  return <DetalheParceiroClient parceiro={parceiro} permissao={permissao} temaName={temaName} />;
}