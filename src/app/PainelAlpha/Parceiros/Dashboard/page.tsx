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

  return (
    <DashboardParceirosClient
      temaName={temaName}
      permissao={permissao}
      dashboardInicial={dashboard.success ? dashboard : null}
      filaInicial={fila.success ? fila.itens : []}
      alertasIniciais={alertas.success ? alertas.alertas : []}
    />
  );
}
