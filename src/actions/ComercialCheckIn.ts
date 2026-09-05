"use server";

import { z } from "zod";
import { startOfDay, startOfMonth, endOfMonth } from "date-fns";
import db from "@/lib/prisma";
import { auth } from "../../auth";
import { podeGerenciarMetas } from "@/lib/metas-permissoes";

/**
 * Persistência aditiva pendente de migration (Vault): ver
 * prisma/migrations/20260903120000_add_comercial_checkin_diario/migration.sql
 * Até a migration ser aplicada, as chamadas abaixo falham com erro tratado
 * (tabela ainda não existe no banco).
 */

const RegistrarCheckSchema = z.object({
  data: z.coerce.date().optional(),
});

export async function RegistrarCheckLeadsDia(data?: Date) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Não autenticado");
  }
  const usuarioId = Number(session.user.id);
  const input = RegistrarCheckSchema.parse({ data });
  const diaNormalizado = startOfDay(input.data ?? new Date());

  try {
    const registro = await db.comercialCheckInDiario.upsert({
      where: {
        checkin_dia_pk: {
          usuarioId,
          data: diaNormalizado,
        },
      },
      update: {},
      create: {
        usuarioId,
        data: diaNormalizado,
      },
    });
    return { success: true, data: registro };
  } catch (error) {
    console.error("Erro ao registrar check-in de leads:", error);
    return {
      success: false,
      error: "Falha ao registrar check-in. Verifique se a migration de check-in já foi aplicada.",
    };
  }
}

const ListarChecksSchema = z.object({
  mes: z.number().int().min(0).max(11),
  ano: z.number().int().min(2000).max(2100),
  usuarioIdFiltro: z.number().int().optional(),
});

/**
 * Retorna os check-ins do mês. Sem `usuarioIdFiltro`: TI/Admin/CEO/Lider Comercial
 * veem todos os closers; demais usuários veem só o próprio histórico. Com
 * `usuarioIdFiltro` diferente do próprio usuário, exige role autorizada.
 */
/** Lista closers ativos (id numérico + nome) para o seletor de auditoria do calendário de check-in. Restrito a TI/Admin/CEO/Lider Comercial. */
export async function ListarUsuariosParaCheckIn() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Não autenticado");
  }
  if (!podeGerenciarMetas(session.user.role ?? "")) {
    throw new Error("Acesso negado: apenas TI, Admin, CEO ou Lider Comercial podem visualizar a equipe.");
  }

  return db.usuarios.findMany({
    where: { status: "ATIVO" },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
}

export async function ListarChecksCalendario(mes: number, ano: number, usuarioIdFiltro?: number) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Não autenticado");
  }
  const input = ListarChecksSchema.parse({ mes, ano, usuarioIdFiltro });

  const proprioId = Number(session.user.id);
  const podeVerEquipe = podeGerenciarMetas(session.user.role ?? "");

  if (input.usuarioIdFiltro !== undefined && input.usuarioIdFiltro !== proprioId && !podeVerEquipe) {
    throw new Error("Acesso negado: você só pode visualizar o próprio calendário de check-in.");
  }

  const usuarioIdConsulta = input.usuarioIdFiltro ?? (podeVerEquipe ? undefined : proprioId);

  const dataReferencia = new Date(input.ano, input.mes, 1);
  const inicioMes = startOfMonth(dataReferencia);
  const fimMes = endOfMonth(dataReferencia);

  try {
    const registros = await db.comercialCheckInDiario.findMany({
      where: {
        ...(usuarioIdConsulta !== undefined ? { usuarioId: usuarioIdConsulta } : {}),
        data: { gte: inicioMes, lte: fimMes },
      },
      orderBy: { data: "asc" },
    });
    return registros;
  } catch {
    throw new Error("Falha ao carregar o calendário de check-in.");
  }
}
