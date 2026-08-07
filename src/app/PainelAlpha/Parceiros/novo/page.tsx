import { auth } from "../../../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import NovoParceiro from "@/components/Parceiros/NovoParceiro";
import { getTemplateParadaoParceiro } from "@/actions/onboarding";
import { buscarParceiroPendenteCadastro } from "@/actions/parceiros";

export default async function NovoParceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ origemContratoId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const { origemContratoId } = await searchParams;

  const [rec, template, pendenciaParceiro] = await Promise.all([
    userId
      ? db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } })
      : null,
    getTemplateParadaoParceiro(),
    origemContratoId ? buscarParceiroPendenteCadastro(origemContratoId) : null,
  ]);

  const temaName = rec?.tema_interface ?? "blue";

  return <NovoParceiro template={template} temaName={temaName} pendenciaParceiro={pendenciaParceiro} />;
}
