import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "../../../../../auth";
import { AdminQnapClient } from "@/components/AlphaExplorer/AdminQnapClient";
import { Button } from "@/components/ui/button";
import { resolveExplorerAuthorization } from "@/lib/alpha-explorer/authorization";
import { readExplorerRuntimeFlags } from "@/lib/alpha-explorer/runtime";
import { tryReadSmbRuntimeConfig } from "@/lib/alpha-explorer/smb/config";

export const dynamic = "force-dynamic";

export default async function AdministracaoQnapPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = Number(session.user.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) redirect("/PainelAlpha");
  const flags = readExplorerRuntimeFlags();
  if (!flags.enabled) notFound();
  const authorization = await resolveExplorerAuthorization(userId);
  if (!authorization.active || !authorization.moduleAllowed || !authorization.admin) redirect("/PainelAlpha/ExploradorArquivos");
  const smb = tryReadSmbRuntimeConfig();
  if (!smb.ok || !smb.config.enabled) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-4 text-foreground">
        <section className="w-full max-w-lg rounded-2xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Administração QNAP indisponível</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            O Explorer continua disponível no modo seguro, mas o gateway SMB deste ambiente ainda não foi configurado completamente.
          </p>
          <Button asChild className="mt-5">
            <Link href="/PainelAlpha/ExploradorArquivos">Voltar ao Explorer</Link>
          </Button>
        </section>
      </main>
    );
  }
  return <AdminQnapClient />;
}
