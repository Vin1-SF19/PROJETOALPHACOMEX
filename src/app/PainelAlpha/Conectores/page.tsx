import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { CONECTORES_PERMISSION } from "@/lib/onyx/connectors-guard";
import { isOnyxConfigured } from "@/lib/onyx/client";
import ConectoresClient from "@/components/Conectores/ConectoresClient";

export const dynamic = "force-dynamic";

export default async function ConectoresPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const role = session.user.role ?? "";
  const isAdmin = role === "Admin" || role === "CEO";

  // Admin/CEO sempre; demais precisam da permissão de módulo conectoresIAlpha.
  if (!isAdmin) {
    const perms = await getPermissoesEfetivas(Number(session.user.id));
    if (!perms.includes(CONECTORES_PERMISSION)) redirect("/PainelAlpha");
  }

  return <ConectoresClient onyxConfigured={isOnyxConfigured()} />;
}
