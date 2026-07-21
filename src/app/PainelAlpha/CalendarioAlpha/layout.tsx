import { type ReactNode } from "react";

import db from "@/lib/prisma";
import { getTema } from "@/lib/temas";

import { auth } from "../../../../auth";
import CalendarioAlphaBackground from "./CalendarioAlphaBackground";

export default async function CalendarioAlphaLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userId = Number(session?.user?.id ?? 0);

  const userDb = userId
    ? await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } })
    : null;

  const tema = getTema(userDb?.tema_interface ?? "blue");

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950">
      <CalendarioAlphaBackground accentRgb={tema.accent} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
