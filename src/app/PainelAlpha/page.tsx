import { auth } from "../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import BibbleChatLayout from "@/components/BibbleChatHome/BibbleChatLayout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PainelAlpha() {
  const session = await auth();
  if (!session) redirect("/");

  const userId = Number((session.user as { id?: string }).id ?? 0);
  const nome =
    (session.user as { nome?: string; name?: string }).nome ||
    (session.user as { nome?: string; name?: string }).name ||
    "Operador";
  const userImage = (session.user as { imagemUrl?: string }).imagemUrl || null;

  const userRecord = await db.usuarios.findUnique({
    where: { id: userId },
    select: { tema_interface: true },
  });
  const temaName = userRecord?.tema_interface ?? "blue";
  const currentHour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(new Date())
  );

  const sessoesIniciais = await db.bibbleSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, title: true, projectId: true, createdAt: true, updatedAt: true },
  });

  return (
    <div className="h-dvh overflow-hidden bg-background">
      <BibbleChatLayout
        userId={userId}
        userName={nome}
        userImage={userImage}
        role={session.user.role as string | undefined}
        temaName={temaName}
        initialHour={currentHour}
        sessoesIniciais={sessoesIniciais.map(s => ({
          ...s,
          projectId: s.projectId ?? null,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
