import { redirect } from "next/navigation";
import { verificarAcessoMesclagem } from "@/lib/mesclagem/autorizacao";
import { listarHistoricoMesclagem } from "@/lib/mesclagem/historico";
import { HistoryHome } from "./components/HistoryHome";

export const dynamic = "force-dynamic";

export default async function PageMesclagemPlanilhas() {
  const acesso = await verificarAcessoMesclagem();
  if (!acesso.autorizado) redirect(acesso.status === 401 ? "/" : "/PainelAlpha");
  return <HistoryHome historico={await listarHistoricoMesclagem(acesso.userId)} />;
}
