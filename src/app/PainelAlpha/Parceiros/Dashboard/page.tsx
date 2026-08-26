import { auth } from "../../../../../auth";
import { redirect } from "next/navigation";
import db from "@/lib/prisma";
import { getPermissaoParceiros } from "@/actions/parceiros";
import { ObterDashboardCanaisParcerias, ListarFilaFollowUpParceiros, ListarAlertasParceiros } from "@/actions/parceiros-dashboard";
import DashboardParceirosClient from "@/components/Parceiros/Dashboard/DashboardParceirosClient";

export const dynamic = "force-dynamic";

export default async function DashboardParceirosPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const rec = userId
    ? await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } })
    : null;
  const temaName = rec?.tema_interface ?? "blue";

  const permissao = await getPermissaoParceiros();
  if (!permissao.isAdmin && !permissao.podeEditar) redirect("/PainelAlpha/Parceiros");

  const [dashboard, fila, alertas] = await Promise.all([
    ObterDashboardCanaisParcerias(),
    ListarFilaFollowUpParceiros(),
    ListarAlertasParceiros(),
  ]);

  const parceiroIds = fila.success ? fila.itens.map((i) => i.parceiroId) : [];
  const tarefasPendentesPorParceiro: Record<number, number> = {};
  if (parceiroIds.length > 0) {
    const grupos = await db.parceiroTarefa.groupBy({
      by: ["parceiroId"],
      where: { parceiroId: { in: parceiroIds }, status: "PENDENTE" },
      _count: { id: true },
    });
    for (const g of grupos) tarefasPendentesPorParceiro[g.parceiroId] = g._count.id;
  }

  const alertaParceiroIds = alertas.success
    ? [...new Set(alertas.alertas.map((a) => a.parceiroId).filter((id): id is number => id !== undefined))]
    : [];
  const tarefasAutomaticasAtivas = alertaParceiroIds.length > 0
    ? await db.parceiroTarefa.findMany({
        where: { parceiroId: { in: alertaParceiroIds }, status: "PENDENTE", origemAutomatica: true },
        select: { parceiroId: true, alertaOrigemTipo: true },
      })
    : [];
  const tarefaAutomaticaChaves = new Set(tarefasAutomaticasAtivas.map((t) => `${t.parceiroId}:${t.alertaOrigemTipo}`));

  return (
    <DashboardParceirosClient
      temaName={temaName}
      permissao={permissao}
      dashboardInicial={dashboard.success ? dashboard : null}
      filaInicial={fila.success ? fila.itens : []}
      alertasIniciais={alertas.success ? alertas.alertas : []}
      tarefasPendentesPorParceiro={tarefasPendentesPorParceiro}
      alertasComTarefaAutomatica={[...tarefaAutomaticaChaves]}
    />
  );
}
