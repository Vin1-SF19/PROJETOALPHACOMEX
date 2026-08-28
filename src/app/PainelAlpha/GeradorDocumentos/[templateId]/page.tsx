import { auth } from "../../../../../auth";
import { redirect, notFound } from "next/navigation";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { isAdminRole } from "@/lib/roles";
import { ObterTemplateDocumento } from "@/actions/gerador-documentos";
import { TemplateDetalheClient } from "@/components/GeradorDocumentos/TemplateDetalheClient";

export const dynamic = "force-dynamic";

export default async function TemplateDetalhePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = session.user.role ?? "";
  const isAdmin = isAdminRole(role);

  if (!isAdmin) {
    const perms = await getPermissoesEfetivas(userId);
    if (!perms.includes("geradorDocumentos")) redirect("/PainelAlpha");
  }

  const resultado = await ObterTemplateDocumento(templateId);
  if (!resultado.success) notFound();

  return <TemplateDetalheClient template={resultado.data} />;
}
