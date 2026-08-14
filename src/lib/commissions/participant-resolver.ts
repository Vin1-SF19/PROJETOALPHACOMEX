import db from "@/lib/prisma";

const CARGOS_GLOBAIS_CONTRATACAO = [
  "Coordenadora Comercial",
  "Diretora Comercial",
  "Auditor Contábil",
] as const;

const CARGOS_GLOBAIS_EXITO = [
  "Auditor Contábil",
  "Diretor Operacional",
] as const;

export interface ParticipantesAutomaticos {
  collaboratorIds: number[];
  ambiguidades: Array<{ cargo: string; candidatos: number }>;
}

async function resolverUnicosPorCargo(cargos: readonly string[]) {
  const usuarios = await db.usuarios.findMany({
    where: { status: "ATIVO", cargo: { in: [...cargos] } },
    select: { id: true, cargo: true },
  });

  const ids: number[] = [];
  const ambiguidades: Array<{ cargo: string; candidatos: number }> = [];
  for (const cargo of cargos) {
    const candidatos = usuarios.filter(
      (usuario) => usuario.cargo?.trim().toLocaleLowerCase("pt-BR") === cargo.toLocaleLowerCase("pt-BR"),
    );
    if (candidatos.length === 1) ids.push(candidatos[0].id);
    if (candidatos.length > 1) ambiguidades.push({ cargo, candidatos: candidatos.length });
  }
  return { ids, ambiguidades };
}

/**
 * Resolve somente vínculos confiáveis. Liderança/auditoria sem FK por evento é
 * automática apenas quando existe exatamente um ocupante ativo para o cargo.
 */
export async function resolverParticipantesAutomaticosEvento(eventId: string): Promise<ParticipantesAutomaticos> {
  const event = await db.commissionEvent.findUnique({
    where: { id: eventId },
    select: {
      eventType: true,
      clienteServicoId: true,
      businessProcessId: true,
      closerUsuarioId: true,
      analistaResponsavelUsuarioId: true,
    },
  });
  if (!event) throw new Error("Evento não encontrado.");

  const processo = event.businessProcessId
    ? await db.businessProcess.findUnique({
        where: { id: event.businessProcessId },
        select: {
          analistaResponsavelId: true,
          analistaAuxiliarId: true,
          auditorId: true,
          diretorId: true,
        },
      })
    : event.clienteServicoId !== null
      ? await db.businessProcess.findFirst({
          where: { clienteServicoId: event.clienteServicoId },
          select: {
            analistaResponsavelId: true,
            analistaAuxiliarId: true,
            auditorId: true,
            diretorId: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : null;

  const globais =
    event.eventType === "CONTRACTING"
      ? await resolverUnicosPorCargo(CARGOS_GLOBAIS_CONTRATACAO)
      : event.eventType === "PROCESS_SUCCESS"
        ? await resolverUnicosPorCargo(CARGOS_GLOBAIS_EXITO)
        : { ids: [], ambiguidades: [] };

  const idsDoProcesso =
    event.eventType === "CONTRACTING"
      ? [processo?.analistaResponsavelId, processo?.auditorId]
      : event.eventType === "PROCESS_SUCCESS"
        ? [
            processo?.analistaResponsavelId ?? event.analistaResponsavelUsuarioId,
            processo?.analistaAuxiliarId,
            processo?.auditorId,
            processo?.diretorId,
          ]
        : [event.closerUsuarioId, event.analistaResponsavelUsuarioId];

  const idsBase =
    event.eventType === "CONTRACTING"
      ? [event.closerUsuarioId, ...idsDoProcesso, ...globais.ids]
      : [...idsDoProcesso, ...globais.ids];

  return {
    collaboratorIds: [...new Set(idsBase.filter((id): id is number => typeof id === "number"))],
    ambiguidades: globais.ambiguidades,
  };
}

export async function registrarAmbiguidadesParticipantes(
  eventId: string,
  ambiguidades: ParticipantesAutomaticos["ambiguidades"],
) {
  for (const item of ambiguidades) {
    const tipo = `PARTICIPANTE_AMBIGUO_${item.cargo.toUpperCase().replaceAll(/\W+/g, "_")}`;
    const existente = await db.commissionDivergence.findFirst({
      where: { eventId, tipo, resolvidoEm: null },
      select: { id: true },
    });
    const detalhes = `${item.candidatos} colaboradores ativos ocupam o cargo "${item.cargo}". Selecione manualmente quem participa do evento.`;
    if (existente) {
      await db.commissionDivergence.update({
        where: { id: existente.id },
        data: { detalhes, severidade: "PENDING_REVIEW" },
      });
    } else {
      await db.commissionDivergence.create({
        data: { eventId, tipo, severidade: "PENDING_REVIEW", detalhes },
      });
    }
  }
}
