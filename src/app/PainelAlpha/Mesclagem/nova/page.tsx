import { redirect } from "next/navigation";

import { verificarAcessoMesclagem } from "@/lib/mesclagem/autorizacao";

import { MesclagemWorkspace } from "../MesclagemWorkspace";

export const dynamic = "force-dynamic";

export default async function NovaMesclagemPage() {
  const acesso = await verificarAcessoMesclagem();
  if (!acesso.autorizado) redirect(acesso.status === 401 ? "/" : "/PainelAlpha");
  return <MesclagemWorkspace />;
}
