import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { isAdminRole } from "@/lib/roles";
import { ListarTemplatesDocumentos, ListarDocumentosGerados } from "@/actions/gerador-documentos";
import { GeradorDocumentosClient } from "@/components/GeradorDocumentos/GeradorDocumentosClient";

export const dynamic = "force-dynamic";

export default async function GeradorDocumentosPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = session.user.role ?? "";
  const isAdmin = isAdminRole(role);

  if (!isAdmin) {
    const perms = await getPermissoesEfetivas(userId);
    if (!perms.includes("geradorDocumentos")) redirect("/PainelAlpha");
  }

  const [templatesResult, documentosResult] = await Promise.all([
    ListarTemplatesDocumentos(),
    ListarDocumentosGerados(),
  ]);

  return (
    <GeradorDocumentosClient
      templatesIniciais={templatesResult.success ? templatesResult.data : []}
      documentosIniciais={documentosResult.success ? documentosResult.data : []}
    />
  );
}
