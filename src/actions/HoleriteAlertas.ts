'use server';

import { auth } from '../../auth';
import db from '@/lib/prisma';
import { pusherServer } from '@/lib/pusher-server.ts';
import { isAdminRole } from '@/lib/roles';

const ROLES_ALERTA = ['FINANCEIRO', 'RECURSOS HUMANOS'];

export interface HoleriteAlertaPayload {
  id: number;
  tipo: 'INICIAL' | 'FINAL';
  titulo: string;
  mensagem: string;
  disparadoEm: string;
}

export interface EstadoAlerta {
  primeiroAlertaEm: string | null;
  alertaFinalEnviado: boolean;
  podeEnviarFinal: boolean;
  ultimoAlertaId: number | null;
}

function buildPayload(
  id: number,
  tipo: 'INICIAL' | 'FINAL',
  disparadoEm: Date
): HoleriteAlertaPayload {
  return {
    id,
    tipo,
    titulo: tipo === 'INICIAL' ? 'Holerites Disponíveis' : 'ATENÇÃO: Prazo Encerrando',
    mensagem:
      tipo === 'INICIAL'
        ? 'Os holerites já estão disponíveis no aplicativo.\nO prazo para envio é de 5 dias corridos.\n\nCaso você já tenha enviado, desconsidere esta mensagem.'
        : 'ATENÇÃO: O prazo para envio do holerite encerra em 1 dia corrido.\n\nEnvie o documento o quanto antes.\n\nCaso já tenha enviado, desconsidere esta mensagem.',
    disparadoEm: disparadoEm.toISOString(),
  };
}

export async function dispararAlerteInicial(): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const role = session?.user?.role ?? '';
  const userId = Number(session?.user?.id ?? 0);

  if (!session || (!isAdminRole(role) && !ROLES_ALERTA.includes(role)) || userId === 0) {
    return { ok: false, error: 'Sem permissão' };
  }

  const registro = await db.holeriteAlertaHistorico.create({
    data: { tipo: 'INICIAL', disparadoPor: userId },
  });

  const payload = buildPayload(registro.id, 'INICIAL', registro.disparadoEm);
  await pusherServer.trigger('private-holerite-alerts', 'holerite-alert', payload);

  return { ok: true };
}

export async function dispararAlerteFinal(): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const role = session?.user?.role ?? '';
  const userId = Number(session?.user?.id ?? 0);

  if (!session || (!isAdminRole(role) && !ROLES_ALERTA.includes(role)) || userId === 0) {
    return { ok: false, error: 'Sem permissão' };
  }

  const estado = await getEstadoAlerta();
  if (!estado.podeEnviarFinal) {
    return { ok: false, error: 'Prazo de 4 dias ainda não atingido' };
  }

  const registro = await db.holeriteAlertaHistorico.create({
    data: { tipo: 'FINAL', disparadoPor: userId },
  });

  const payload = buildPayload(registro.id, 'FINAL', registro.disparadoEm);
  await pusherServer.trigger('private-holerite-alerts', 'holerite-alert', payload);

  return { ok: true };
}

export async function getEstadoAlerta(): Promise<EstadoAlerta> {
  const ultimoInicial = await db.holeriteAlertaHistorico.findFirst({
    where: { tipo: 'INICIAL' },
    orderBy: { disparadoEm: 'desc' },
  });

  if (!ultimoInicial) {
    return { primeiroAlertaEm: null, alertaFinalEnviado: false, podeEnviarFinal: false, ultimoAlertaId: null };
  }

  const quatroDiasDepois = new Date(ultimoInicial.disparadoEm);
  quatroDiasDepois.setDate(quatroDiasDepois.getDate() + 4);
  const podeEnviarFinal = new Date() >= quatroDiasDepois;

  const ultimoFinal = await db.holeriteAlertaHistorico.findFirst({
    where: { tipo: 'FINAL', disparadoEm: { gt: ultimoInicial.disparadoEm } },
    orderBy: { disparadoEm: 'desc' },
  });

  return {
    primeiroAlertaEm: ultimoInicial.disparadoEm.toISOString(),
    alertaFinalEnviado: !!ultimoFinal,
    podeEnviarFinal,
    ultimoAlertaId: ultimoInicial.id,
  };
}

export async function getUltimoAlerta(): Promise<HoleriteAlertaPayload | null> {
  const ultimo = await db.holeriteAlertaHistorico.findFirst({
    orderBy: { disparadoEm: 'desc' },
  });

  if (!ultimo) return null;

  return buildPayload(ultimo.id, ultimo.tipo as 'INICIAL' | 'FINAL', ultimo.disparadoEm);
}
