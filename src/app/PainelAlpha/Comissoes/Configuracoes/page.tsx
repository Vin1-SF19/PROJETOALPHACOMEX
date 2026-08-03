import { auth } from "../../../../../auth";
import { redirect } from "next/navigation";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { ConfiguracoesComissoes } from "@/components/Comissoes/Configuracoes/ConfiguracoesComissoes";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Mantida como rota própria para deep-link/bookmark direto, embora o fluxo principal do
 * usuário agora abra Configurações como modal no dashboard (CabecalhoComissoes.tsx).
 */
export default async function ConfiguracoesComissoesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = session.user.role ?? "";
  const isAdmin = isAdminRole(role);

  if (!isAdmin) {
    const perms = await getPermissoesEfetivas(userId);
    if (!perms.includes("comissoes")) redirect("/PainelAlpha");
  }

  return <ConfiguracoesComissoes />;
}
