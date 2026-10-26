"use server";

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LegacyAccessError, legacyActionError, requireLegacyActor } from "@/lib/legacy-write-access";
import { validarIntervaloReserva } from "@/lib/reservas/intervalo";
import { repetirTransacaoOcupada } from "@/lib/bpm/sqlite-busy-retry";

const readPermissions = ["Reservas", "ServiçosGerais", "tarefasComercial", "gerenciamentoTarefas"];
const salaSchema = z.string().trim().min(1, "Informe a sala.").max(200);
const idSchema = z.coerce.number().int().positive();
function refreshReservations() {
  try { revalidatePath("/PainelAlpha/ReservaSalas"); }
  catch (error) { console.error("[Reservas/cache]", error); }
}
function errorMessage(error: unknown) {
  console.error("[Reservas]", error);
  return error instanceof z.ZodError ? error.issues[0]?.message ?? "Dados inválidos." : legacyActionError(error, "Não foi possível salvar a reserva. Tente novamente.");
}

export async function agendarSala(dados: { sala: string; data: string; inicio: string; fim: string; tipo: string; paoDeQueijo: boolean; motivo: string }) {
  try {
    const actor = await requireLegacyActor(["Reservas"]);
    const sala = salaSchema.parse(dados.sala);
    const intervalo = validarIntervaloReserva(dados.data, dados.inicio, dados.fim);
    if (!intervalo.success) return intervalo;
    const tipo = z.string().trim().max(200).parse(dados.tipo);
    const motivo = z.string().trim().max(10000).parse(dados.motivo);
    // O teste de sobreposição e a inserção são um único comando SQLite:
    // duas instâncias não conseguem confirmar o mesmo intervalo entre SELECT e INSERT.
    const count = await repetirTransacaoOcupada(() => db.$executeRaw`
      INSERT INTO "reservas" ("sala", "usuario", "data", "inicio", "fim", "status", "tipo", "paoDeQueijo", "motivo")
      SELECT ${sala}, ${actor.nome}, ${intervalo.dia}, ${intervalo.inicioEm}, ${intervalo.fimEm}, 'Agendado', ${tipo}, ${z.boolean().parse(dados.paoDeQueijo)}, ${motivo}
      WHERE NOT EXISTS (
        SELECT 1 FROM "reservas" WHERE "sala" = ${sala} AND "status" = 'Agendado'
          AND "inicio" < ${intervalo.fimEm} AND "fim" > ${intervalo.inicioEm}
      )`);
    if (count !== 1) return { success: false as const, error: "Horário já ocupado!" };
    refreshReservations();
    return { success: true as const };

  } catch (error) { return { success: false as const, error: errorMessage(error) }; }
}

// O legado guarda autoria por nome. Nomes compartilhados não identificam um autor.
async function requireReservationOwner() {
  const actor = await requireLegacyActor(["Reservas"]);
  if (!actor.isAdmin && await db.usuarios.count({ where: { nome: actor.nome } }) !== 1) {
    throw new LegacyAccessError("Não foi possível identificar o autor da reserva com segurança. Solicite a alteração a um administrador.");
  }
  return actor;
}

export async function liberarSala(id: number) {
  try {
    const actor = await requireReservationOwner();
    const result = await db.reservas.updateMany({ where: { id: idSchema.parse(id), status: "Agendado", ...(actor.isAdmin ? {} : { usuario: actor.nome }) }, data: { status: "Concluído" } });
    if (result.count !== 1) return { success: false as const, error: "Reserva não encontrada, concluída ou sem permissão para edição." };
    refreshReservations(); return { success: true as const };
  } catch (error) { return { success: false as const, error: errorMessage(error) }; }
}

export async function cancelarReserva(id: number | string) {
  try {
    const actor = await requireReservationOwner();
    const result = await db.reservas.deleteMany({ where: { id: idSchema.parse(id), ...(actor.isAdmin ? {} : { usuario: actor.nome }) } });
    if (result.count !== 1) return { success: false as const, error: "Reserva não encontrada." };
    refreshReservations(); return { success: true as const };
  } catch (error) { return { success: false as const, error: errorMessage(error) }; }
}

export async function buscarReservasAtivas() {
  try {
    await requireLegacyActor(readPermissions);
    return await db.reservas.findMany({ where: { status: "Agendado" }, orderBy: { inicio: "asc" } });
  } catch (error) { console.error("[buscarReservasAtivas]", error); return []; }
}

export async function editarReserva(id: number, dados: { data: string; inicio: string; fim: string; sala: string }) {
  try {
    const actor = await requireReservationOwner();
    const reservaId = idSchema.parse(id);
    const sala = salaSchema.parse(dados.sala);
    const intervalo = validarIntervaloReserva(dados.data, dados.inicio, dados.fim);
    if (!intervalo.success) return intervalo;
    const count = await repetirTransacaoOcupada(() => db.$executeRaw`
      UPDATE "reservas" SET "sala" = ${sala}, "data" = ${intervalo.dia}, "inicio" = ${intervalo.inicioEm}, "fim" = ${intervalo.fimEm}
      WHERE "id" = ${reservaId} AND "status" = 'Agendado' AND (${actor.isAdmin} OR "usuario" = ${actor.nome})
        AND NOT EXISTS (
          SELECT 1 FROM "reservas" AS outra WHERE outra."id" <> ${reservaId} AND outra."sala" = ${sala} AND outra."status" = 'Agendado'
            AND outra."inicio" < ${intervalo.fimEm} AND outra."fim" > ${intervalo.inicioEm}
        )`);
    if (count !== 1) return { success: false as const, error: "Reserva indisponível, horário em conflito ou sem permissão para edição." };
    refreshReservations();
    return { success: true as const };

  } catch (error) { return { success: false as const, error: errorMessage(error) }; }
}

export async function buscarHistoricoReservas() {
  try {
    await requireLegacyActor(readPermissions);
    return await db.reservas.findMany({ where: { status: "Concluído" }, orderBy: { inicio: "desc" }, take: 10 });
  } catch (error) { console.error("[buscarHistoricoReservas]", error); return []; }
}

export async function SalvarDiretrizSala(sala: string, descricao: string) {
  try {
    await requireLegacyActor(["gerenciamentoTarefas"]);
    const nome = salaSchema.parse(sala);
    const texto = z.string().trim().max(20000).parse(descricao);
    await db.diretrizSala.upsert({ where: { sala: nome }, update: { descricao: texto }, create: { sala: nome, descricao: texto } });
    return { success: true as const };
  } catch (error) { return { success: false as const, error: errorMessage(error) }; }
}

export async function BuscarDiretrizPorSala(sala: string) {
  try {
    await requireLegacyActor(readPermissions);
    return await db.diretrizSala.findUnique({ where: { sala: salaSchema.parse(sala) } });
  } catch (error) { console.error("[BuscarDiretrizPorSala]", error); return null; }
}

export async function BuscarTodasDiretrizes() {
  try { await requireLegacyActor(readPermissions); return await db.diretrizSala.findMany(); }
  catch (error) { console.error("[BuscarTodasDiretrizes]", error); return []; }
}
