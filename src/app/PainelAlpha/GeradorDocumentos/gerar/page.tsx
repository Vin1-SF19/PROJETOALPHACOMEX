import { auth } from "../../../../../auth";
import { redirect, notFound } from "next/navigation";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { isAdminRole } from "@/lib/roles";
import { ObterTemplateDocumento } from "@/actions/gerador-documentos";
import { GerarDocumentoForm } from "@/components/GeradorDocumentos/GerarDocumentoForm";

export const dynamic = "force-dynamic";

export default async function GerarDocumentoPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const { templateId } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = session.user.role ?? "";
  const isAdmin = isAdminRole(role);

  if (!isAdmin) {
    const perms = await getPermissoesEfetivas(userId);
    if (!perms.includes("geradorDocumentos")) redirect("/PainelAlpha");
  }

  if (!templateId) notFound();

  const resultado = await ObterTemplateDocumento(templateId);
  if (!resultado.success) notFound();

  return <GerarDocumentoForm template={resultado.data} />;
}
