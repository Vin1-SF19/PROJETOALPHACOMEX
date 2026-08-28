import { auth } from "../../../../../../auth";
import { redirect, notFound } from "next/navigation";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { isAdminRole } from "@/lib/roles";
import { ObterDocumentoConferencia } from "@/actions/gerador-documentos";
import { ConferenciaClient } from "@/components/GeradorDocumentos/ConferenciaClient";

export const dynamic = "force-dynamic";

export default async function ConferenciaDocumentoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // auth() + permissão de módulo + ownership (via ObterDocumentoConferencia) —
  // o tokenAcesso identifica o documento na URL mas NUNCA autoriza sozinho
  // (decisão 2026-08-28: objetivo original exige link não-público).
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = session.user.role ?? "";
  const isAdmin = isAdminRole(role);

  if (!isAdmin) {
    const perms = await getPermissoesEfetivas(userId);
    if (!perms.includes("geradorDocumentos")) redirect("/PainelAlpha");
  }

  const resultado = await ObterDocumentoConferencia(token);
  if (!resultado.success) notFound();

  return <ConferenciaClient documento={resultado.data} />;
}
