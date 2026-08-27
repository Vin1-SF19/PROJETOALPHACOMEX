import { auth } from "../../../../../../auth";
import { redirect } from "next/navigation";
import { getPermissaoParceiros } from "@/actions/parceiros";
import { obterConfigParceiros } from "@/actions/convites-parceiro";
import ConfiguracoesParceirosClient from "@/components/Parceiros/Configuracoes/ConfiguracoesParceirosClient";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesParceirosPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const permissao = await getPermissaoParceiros();
  if (!permissao.isAdmin) redirect("/PainelAlpha/Parceiros");

  const config = await obterConfigParceiros();

  return <ConfiguracoesParceirosClient configInicial={config} />;
}
