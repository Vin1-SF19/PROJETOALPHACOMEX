import { redirect } from "next/navigation";

import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { obterStatusConexaoCalendarioAlpha } from "@/actions/google-calendar-conexao";
import { listarCalendariosSelecionados } from "@/actions/google-calendar-eventos";
import { CalendarioAlphaDashboard } from "@/components/CalendarioAlpha/CalendarioAlphaDashboard";
import {
  parsearDataCivil,
  type VisaoCalendario,
} from "@/components/CalendarioAlpha/lib/datas";
import type { ListaTarefasAgendaView } from "@/components/CalendarioAlpha/lib/tipos";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

import { auth } from "../../../../auth";

export const dynamic = "force-dynamic";

export default async function CalendarioAlphaPage({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string; data?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = session.user.role ?? "";
  const isAdmin = isAdminRole(role);

  if (!isAdmin) {
    const perms = await getPermissoesEfetivas(userId);
    if (!perms.includes("calendarioAlpha")) redirect("/PainelAlpha");
  }

  const { visao: visaoParam, data: dataParam } = await searchParams;

  const rec = userId
    ? await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } })
    : null;
  const temaName = rec?.tema_interface ?? "blue";

  const statusConexao = await obterStatusConexaoCalendarioAlpha();

  const VISOES_VALIDAS: VisaoCalendario[] = ["dia", "semana", "mes", "ano"];
  const visao: VisaoCalendario = VISOES_VALIDAS.includes(visaoParam as VisaoCalendario)
    ? (visaoParam as VisaoCalendario)
    : "semana";
  const dataReferencia = parsearDataCivil(dataParam) ?? new Date();

  if (!statusConexao.conectado) {
    return (
      <CalendarioAlphaDashboard
        temaName={temaName}
        statusConexao={statusConexao}
        conexaoId={null}
        calendarios={[]}
        listasTarefas={[]}
        isAdmin={isAdmin}
        visao={visao}
        dataReferenciaISO={dataReferencia.toISOString()}
      />
    );
  }

  const calendariosResultado = await listarCalendariosSelecionados();
  const calendarios = calendariosResultado.success ? calendariosResultado.data : [];
  const listasTarefas: ListaTarefasAgendaView[] = await db.googleCalendarTaskListCache.findMany({
    where: { conexaoId: statusConexao.conexaoId ?? "" },
    orderBy: { titulo: "asc" },
    select: { googleTaskListId: true, titulo: true },
  });

  return (
    <CalendarioAlphaDashboard
      temaName={temaName}
      statusConexao={statusConexao}
      conexaoId={statusConexao.conexaoId ?? null}
      calendarios={calendarios}
      listasTarefas={listasTarefas}
      isAdmin={isAdmin}
      visao={visao}
      dataReferenciaISO={dataReferencia.toISOString()}
    />
  );
}
