import { auth } from "@/../auth";
import { redirect } from "next/navigation";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { isAdminRole } from "@/lib/roles";
import { BuilderClient } from "@/app/PainelAlpha/Builder/BuilderClient";

export const dynamic = "force-dynamic";

export default async function BuilderPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number(session.user.id ?? 0);
  if (!isAdminRole(session.user.role ?? "")) {
    let permissoes: string[] = [];
    try {
      permissoes = userId > 0 ? await getPermissoesEfetivas(userId) : [];
    } catch { /* Falha de leitura mantém acesso negado. */ }
    if (!permissoes.includes("builder")) redirect("/PainelAlpha");
  }

  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <BuilderClient />
    </main>
  );
}
