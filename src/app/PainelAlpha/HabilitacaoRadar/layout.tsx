import type { Metadata } from "next";
import { Toaster } from "sonner";
import { auth } from "../../../../auth";
import db from "@/lib/prisma";
import { getTema } from "@/lib/temas";
import RadarBackground from "@/components/ComponentesRadar/RadarBackground";

export const metadata: Metadata = {
  title: "Habilitação RADAR – Alpha",
};

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = Number((session?.user as { id?: string | number })?.id ?? 0);

  const userDb = userId
    ? await db.usuarios.findUnique({
        where: { id: userId },
        select: { tema_interface: true },
      })
    : null;

  const tema = getTema(userDb?.tema_interface ?? "blue");

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#020617]">
      {/* Fundo gerenciado aqui — vale para TODAS as páginas do Habilitação Radar */}
      <RadarBackground accentRgb={tema.accent} />

      <Toaster position="top-right" richColors />

      {/* Conteúdo acima do fundo */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
