import { redirect } from "next/navigation";
import { auth } from "../../../../auth";
import db from "@/lib/prisma";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { getTema } from "@/lib/temas";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = Number(session?.user?.id ?? 0);
  if (!userId) redirect("/");
  const [permissions, user] = await Promise.all([
    getPermissoesEfetivas(userId),
    db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } }),
  ]);
  if (!permissions.includes("alphaSeo")) redirect("/PainelAlpha");
  const accent = getTema(user?.tema_interface ?? "blue").accent;
  return <div style={{ ["--seo-accent" as string]: accent }}>{children}</div>;
}
