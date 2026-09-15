import { notFound, redirect } from "next/navigation";

import { verificarAcessoMesclagem } from "@/lib/mesclagem/autorizacao";
import { obterHistoricoMesclagem } from "@/lib/mesclagem/historico";

import { HistoryDetail } from "../components/HistoryDetail";

export const dynamic = "force-dynamic";

export default async function DetalheMesclagemPage({ params }: { params: Promise<{ id: string }> }) {
  const acesso = await verificarAcessoMesclagem();
  if (!acesso.autorizado) redirect(acesso.status === 401 ? "/" : "/PainelAlpha");
  const { id } = await params;
  const item = await obterHistoricoMesclagem(acesso.userId, id);
  if (!item) notFound();
  return <HistoryDetail item={item} />;
}
