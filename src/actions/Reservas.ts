"use server"

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";

const toBRT = (dateStr: string, timeStr: string) => {
  const date = new Date(`${dateStr}T${timeStr}:00`);
  return new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
};

const formatToISO = (date: Date) => {
  return new Date(date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
};

export async function agendarSala(dados: { sala: string, data: string, inicio: string, fim: string, tipo: string, paoDeQueijo: boolean, motivo: string }) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Sessão expirada. Faça login novamente." };

    const u = session.user as { nome?: string; usuario?: string };
    const usuarioNome = u.nome || u.usuario || "Usuário";

    const dataHoraInicio = new Date(`${dados.data}T${dados.inicio}:00-03:00`);
    const dataHoraFim = new Date(`${dados.data}T${dados.fim}:00-03:00`);

    if (isNaN(dataHoraInicio.getTime()) || isNaN(dataHoraFim.getTime())) {
      return { success: false, error: "Data ou hora inválida." };
    }

    const conflito = await db.reservas.findFirst({
      where: {
        sala: dados.sala,
        status: "Agendado",
        OR: [{ inicio: { lt: dataHoraFim }, fim: { gt: dataHoraInicio } }]
      }
    });

    if (conflito) return { success: false, error: "Horário já ocupado!" };

    await db.reservas.create({
      data: {
        sala: dados.sala,
        usuario: usuarioNome,
        data: new Date(`${dados.data}T00:00:00-03:00`),
        inicio: dataHoraInicio,
        fim: dataHoraFim,
        status: "Agendado",
        tipo: dados.tipo,
        paoDeQueijo: dados.paoDeQueijo ?? false,
        motivo: dados.motivo
      }
    });

    revalidatePath("/PainelAlpha/ReservaSalas");
    return { success: true };
  } catch (e) {
    return { success: false, error: "Erro ao gravar no banco." };
  }
}


export async function liberarSala(id: number) {
  try {
    await db.reservas.update({
      where: { id },
      data: { status: "Concluído" }
    });
    revalidatePath("/PainelAlpha/ReservaSalas");
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

export async function cancelarReserva(id: any) {
  try {
    const idLimpo = Number(id);
    if (isNaN(idLimpo)) return { success: false, error: "ID inválido" };

    await db.reservas.delete({ where: { id: idLimpo } });
    revalidatePath("/PainelAlpha/ReservaSalas");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Erro interno no servidor" };
  }
}

export async function buscarReservasAtivas() {
  try {
    return await db.reservas.findMany({
      where: { status: "Agendado" },
      orderBy: { inicio: 'asc' }
    });
  } catch (e) {
    return [];
  }
}

export async function editarReserva(id: number, dados: { data: string, inicio: string, fim: string, sala: string }) {
  try {
    const dataHoraInicio = new Date(`${dados.data}T${dados.inicio}:00-03:00`);
    const dataHoraFim = new Date(`${dados.data}T${dados.fim}:00-03:00`);

    if (isNaN(dataHoraInicio.getTime()) || isNaN(dataHoraFim.getTime())) {
      return { success: false, error: "Horário inválido." };
    }

    const conflito = await db.reservas.findFirst({
      where: {
        id: { not: id },
        sala: dados.sala,
        status: "Agendado",
        AND: [
          { inicio: { lt: dataHoraFim } },
          { fim: { gt: dataHoraInicio } }
        ]
      }
    });

    if (conflito) return { success: false, error: "Conflito com outra reserva!" };

    await db.reservas.update({
      where: { id },
      data: {
        sala: dados.sala,
        data: new Date(`${dados.data}T00:00:00-03:00`),
        inicio: dataHoraInicio,
        fim: dataHoraFim
      }
    });

    revalidatePath("/PainelAlpha/ReservaSalas");
    return { success: true };
  } catch (e) {
    return { success: false, error: "Erro ao atualizar no banco." };
  }
}


export async function buscarHistoricoReservas() {
  try {
    return await db.reservas.findMany({
      where: { status: "Concluído" },
      orderBy: { inicio: 'desc' },
      take: 10
    });
  } catch (error) {
    return [];
  }
}

export async function SalvarDiretrizSala(sala: string, descricao: string) {
  try {
      await db.diretrizSala.upsert({
          where: { sala },
          update: { descricao },
          create: { sala, descricao }
      });
      return { success: true };
  } catch (error) {
      return { success: false };
  }
}

export async function BuscarDiretrizPorSala(sala: string) {
  try {
      return await db.diretrizSala.findUnique({
          where: { sala }
      });
  } catch (error) {
      return null;
  }
}

export async function BuscarTodasDiretrizes() {
  try {
      const diretrizes = await db.diretrizSala.findMany();
      return diretrizes;
  } catch (error) {
      console.error("Erro ao buscar diretrizes:", error);
      return [];
  }
}
