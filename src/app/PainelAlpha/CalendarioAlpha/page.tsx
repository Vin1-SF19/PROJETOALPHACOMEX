import { redirect } from "next/navigation";

import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { obterStatusConexaoCalendarioAlpha } from "@/actions/google-calendar-conexao";
import { listarCalendariosSelecionados, listarEventosCache } from "@/actions/google-calendar-eventos";
import { CalendarioAlphaDashboard } from "@/components/CalendarioAlpha/CalendarioAlphaDashboard";
import {
  calcularIntervaloVisao,
  parsearDataCivil,
  type VisaoCalendario,
} from "@/components/CalendarioAlpha/lib/datas";
import type { EventoExibicao } from "@/components/CalendarioAlpha/lib/tipos";
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
    : "mes";
  const dataReferencia = parsearDataCivil(dataParam) ?? new Date();

  if (!statusConexao.conectado) {
    return (
      <CalendarioAlphaDashboard
        temaName={temaName}
        statusConexao={statusConexao}
        conexaoId={null}
        calendarios={[]}
        eventos={[]}
        isAdmin={isAdmin}
        visao={visao}
        dataReferenciaISO={dataReferencia.toISOString()}
        algumaFalhaSync={false}
      />
    );
  }

  const calendariosResultado = await listarCalendariosSelecionados();
  const calendarios = calendariosResultado.success ? calendariosResultado.data : [];

  const { inicio, fim } = calcularIntervaloVisao(visao, dataReferencia);
  const calendariosVisiveis = calendarios.filter((c) => c.visivel);

  const resultadosEventos = await Promise.all(
    calendariosVisiveis.map((calendario) =>
      listarEventosCache({
        calendarioId: calendario.id,
        inicioISO: inicio.toISOString(),
        fimISO: fim.toISOString(),
      }),
    ),
  );

  const eventos: EventoExibicao[] = resultadosEventos.flatMap((resultado, indice) => {
    if (!resultado.success) return [];
    const calendario = calendariosVisiveis[indice];
    return resultado.data.map((evento) => ({
      id: evento.id,
      googleEventId: evento.googleEventId,
      status: evento.status,
      titulo: evento.titulo,
      inicioEm: evento.inicioEm?.toISOString() ?? null,
      fimEm: evento.fimEm?.toISOString() ?? null,
      diaInteiro: evento.diaInteiro,
      etag: evento.etag,
      linkMeet: evento.linkMeet,
      calendarioId: calendario.id,
      calendarioGoogleId: calendario.googleCalendarId,
      calendarioNome: calendario.nome,
      calendarioCorHex: calendario.corHex,
      calendarioGravavel: calendario.gravavel,
    }));
  });

  const algumaFalhaSync = resultadosEventos.some((resultado) => !resultado.success);

  return (
    <CalendarioAlphaDashboard
      temaName={temaName}
      statusConexao={statusConexao}
      conexaoId={statusConexao.conexaoId ?? null}
      calendarios={calendarios}
      eventos={eventos}
      isAdmin={isAdmin}
      visao={visao}
      dataReferenciaISO={dataReferencia.toISOString()}
      algumaFalhaSync={algumaFalhaSync}
    />
  );
}
