import { auth } from "../../../../auth";
import PaginaControle from "./PaginaControle";
import { redirect } from "next/navigation";
import { getTema } from "@/lib/temas";
import { listarClosersAlphaLeads } from "@/actions/ComercialControle";
import { podeGerenciarMetas } from "@/lib/metas-permissoes";

export default async function ControleLeadsPage() {
  const session = await auth();


  const temaNome = (session?.user as any)?.tema_interface || "blue";
  const style = getTema(temaNome);

  if (!session) {
    redirect("/");
  }

  const podeAcompanharEquipe = podeGerenciarMetas(session.user.role ?? "");
  const closersAcompanhamento = podeAcompanharEquipe
    ? await listarClosersAlphaLeads().catch(() => [])
    : [];

  return <PaginaControle
    usuario={session.user}
    temaConfig={style}
    podeAcompanharEquipe={podeAcompanharEquipe}
    closersAcompanhamento={closersAcompanhamento}
  />;
}
