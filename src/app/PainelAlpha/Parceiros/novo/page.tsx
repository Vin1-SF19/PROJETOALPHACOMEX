import { auth } from "../../../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import NovoParceiro from "@/components/Parceiros/NovoParceiro";

export default async function NovoParceiroPAge() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);

  const [rec, template] = await Promise.all([
    userId
      ? db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } })
      : null,
    db.onboardingTemplate.findFirst({
      where: { setor: "parceiros", ativo: true },
      select: { id: true, nome: true, mensagem: true },
      orderBy: { padrao: "desc" },
    }),
  ]);

  const temaName = rec?.tema_interface ?? "blue";

  return <NovoParceiro template={template} temaName={temaName} />;
}
