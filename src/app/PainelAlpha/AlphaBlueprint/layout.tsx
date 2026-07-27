import { auth } from "../../../../auth";
import db from "@/lib/prisma";
import { getTema } from "@/lib/temas";
import { BlueprintBackground } from "@/components/AlphaBlueprint/BlueprintBackground";

export default async function AlphaBlueprintLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = Number((session?.user as { id?: string | number } | undefined)?.id ?? 0);

  const userDb = userId
    ? await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } })
    : null;

  const tema = getTema(userDb?.tema_interface ?? "blue");

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Fundo "Mesa de Trabalho" — vale para todas as páginas do Alpha Blueprint, mas o
          Canvas em si (BlueprintCanvas.tsx) mantém fundo sólido próprio por cima dele. */}
      <BlueprintBackground accentRgb={tema.accent} />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
