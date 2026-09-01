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
import { eventoFoiCompartilhadoComUsuario, eventoFoiRecusadoPeloUsuario, type EventoExibicao, type ListaTarefasAgendaView, type TarefaAgendaExibicao } from "@/components/CalendarioAlpha/lib/tipos";
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
        eventos={[]}
        tarefas={[]}
        listasTarefas={[]}
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
      eventType: evento.eventType,
      tipo: "evento",
      calendarioId: calendario.id,
      calendarioGoogleId: calendario.googleCalendarId,
      calendarioNome: calendario.nome,
      calendarioCorHex: calendario.corHex,
      calendarioGravavel: calendario.gravavel,
      recusadoPeloUsuario: eventoFoiRecusadoPeloUsuario(evento.statusPropertiesJson),
      compartilhadoComUsuario: eventoFoiCompartilhadoComUsuario(evento.statusPropertiesJson),
    }));
  });

  const algumaFalhaSync = resultadosEventos.some((resultado) => !resultado.success);
  const tarefas: TarefaAgendaExibicao[] = await db.googleCalendarTaskCache.findMany({
    where: { taskList: { conexaoId: statusConexao.conexaoId ?? "" }, excluida: false, oculta: false },
    orderBy: [{ status: "asc" }, { vencimentoEm: "asc" }],
    take: 100,
    select: {
      id: true,
      titulo: true,
      notas: true,
      status: true,
      vencimentoEm: true,
      inicioLocalEm: true,
      fimLocalEm: true,
      agendamentoChamado: { select: { inicioEm: true, fimPlanejadoEm: true, fimConcluidoEm: true, status: true } },
      taskList: { select: { googleTaskListId: true, titulo: true } },
    },
  }).then((items) => items.map((tarefa) => ({
    id: tarefa.id,
    taskListGoogleId: tarefa.taskList.googleTaskListId,
    listaTitulo: tarefa.taskList.titulo,
    titulo: tarefa.titulo,
    notas: tarefa.notas,
    status: tarefa.status === "completed" ? "completed" : "needsAction",
    vencimentoEm: tarefa.vencimentoEm?.toISOString() ?? null,
    inicioAgendadoEm: tarefa.agendamentoChamado?.inicioEm.toISOString() ?? null,
    fimPlanejadoAgendadoEm: tarefa.agendamentoChamado?.fimPlanejadoEm.toISOString() ?? null,
    fimConcluidoAgendadoEm: tarefa.agendamentoChamado?.fimConcluidoEm?.toISOString() ?? null,
    statusAgendamento: tarefa.agendamentoChamado?.status === "CONCLUIDO" ? "CONCLUIDO" : tarefa.agendamentoChamado?.status === "EM_ATENDIMENTO" ? "EM_ATENDIMENTO" : null,
    inicioLocalEm: tarefa.inicioLocalEm?.toISOString() ?? null,
    fimLocalEm: tarefa.fimLocalEm?.toISOString() ?? null,
  })));
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
      eventos={eventos}
      tarefas={tarefas}
      listasTarefas={listasTarefas}
      isAdmin={isAdmin}
      visao={visao}
      dataReferenciaISO={dataReferencia.toISOString()}
      algumaFalhaSync={algumaFalhaSync}
    />
  );
}
