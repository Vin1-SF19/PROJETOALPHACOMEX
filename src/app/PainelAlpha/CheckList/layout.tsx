import { auth } from "../../../../auth";
import db from "@/lib/prisma";
import { getTema } from "@/lib/temas";
import ChecklistBackground from "./ChecklistBackground";

export default async function CheckListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userId = Number((session?.user as any)?.id ?? 0);

  const userDb = userId
    ? await db.usuarios.findUnique({
        where: { id: userId },
        select: { tema_interface: true },
      })
    : null;

  const tema = getTema(userDb?.tema_interface ?? "blue");

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Fundo gerenciado aqui — vale para TODAS as páginas do CheckList */}
      <ChecklistBackground accentRgb={tema.accent} />

      {/* Conteúdo acima do fundo */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
