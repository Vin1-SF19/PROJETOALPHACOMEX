"use server";

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Tarefa } from "@prisma/client";
import { z } from "zod";
import { LegacyAccessError, legacyActionError, requireLegacyActor } from "@/lib/legacy-write-access";

type TarefaBusca = Pick<Tarefa,
  "id" | "texto" | "descricao" | "feita" | "fixa" | "prioridade" |
  "diaSemana" | "intervaloDias" | "horario" | "userId"
> & { dataInicio: string | null; createdAt: string; concluidaEm: string | null };

const idSchema = z.string().trim().min(1).max(200);
const payloadSchema = z.object({
  texto: z.string().trim().min(1, "Informe o texto da tarefa.").max(2000),
  descricao: z.string().max(20000).optional(),
  fixa: z.boolean(),
  diaSemana: z.number().int().min(0).max(6).nullable().optional(),
  diasSemana: z.array(z.number().int().min(0).max(6)).optional(),
  intervaloDias: z.number().int().positive().nullable().optional(),
  dataInicio: z.date().optional(),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
  horario: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.").or(z.literal("")).nullable().optional(),
});
const sharedServicesEmail = "alexandra@alpha-comex.com";
function refreshTasks() {
  try {
    for (const path of ["/PainelAlpha/PainelTarefas/GerenciarTarefas", "/PainelAlpha/PainelTarefas/PainelTarefaC", "/PainelAlpha/PainelTarefas/painelTarefaSG"]) revalidatePath(path);
  } catch (error) { console.error("[Tarefas/cache]", error); }
}
function taskError(error: unknown) {
  return error instanceof z.ZodError ? error.issues[0]?.message ?? "Dados inválidos." : legacyActionError(error, "Não foi possível salvar a tarefa. Tente novamente.");
}
async function taskAccess(targetUserId: number, managing = false) {
  const actor = await requireLegacyActor();
  if (actor.isAdmin || actor.permissions.includes("gerenciamentoTarefas")) return actor;
  if (managing) throw new LegacyAccessError("Sem permissão para gerenciar tarefas.");
  if (actor.id === targetUserId && actor.permissions.some((p) => ["tarefasComercial", "ServiçosGerais"].includes(p))) return actor;
  if (actor.permissions.includes("ServiçosGerais")) {
    const target = await db.usuarios.findUnique({ where: { id: targetUserId }, select: { email: true } });
    if (target?.email.toLowerCase() === sharedServicesEmail) return actor;
  }
  throw new LegacyAccessError("Sem permissão para esta tarefa.");
}

export async function CriarTarefa(data: {
  texto: string; descricao?: string; userId: string | number; fixa: boolean; diaSemana: number | null;
  intervaloDias?: number | null; dataInicio?: Date; prioridade: string; horario?: string | null; alerta?: string | null;
}) {
  try {
    const userId = z.coerce.number().int().positive().parse(data.userId);
    await taskAccess(userId, true);
    const parsed = payloadSchema.parse(data);
    const target = await db.usuarios.findUnique({ where: { id: userId }, select: { status: true } });
    if (!target || target.status !== "ATIVO") return { success: false as const, error: "Usuário de destino não está ativo." };
    const created = await db.tarefa.create({
      data: { texto: parsed.texto, descricao: parsed.descricao ?? "", fixa: parsed.fixa,
        diaSemana: parsed.diaSemana ?? null, intervaloDias: parsed.intervaloDias ?? null,
        dataInicio: parsed.dataInicio ?? new Date(), feita: false, userId, prioridade: parsed.prioridade, horario: parsed.horario || null },
      select: { id: true },
    });
    let warning: string | undefined;
    if (data.alerta) {
      try { await db.$executeRaw`UPDATE "Tarefa" SET "alerta" = ${data.alerta} WHERE "id" = ${created.id}`; }
      catch { warning = "A tarefa foi salva, mas o alerta não pôde ser configurado neste ambiente."; }
    }
    refreshTasks();
    return { success: true as const, id: created.id, warning };
  } catch (error) {
    console.error("[CriarTarefa]", error);
    return { success: false as const, error: taskError(error) };
  }
}

export async function BuscarTarefasPorUsuario(userId: string, role: string) {
  void role;
  try {
    const id = z.coerce.number().int().positive().parse(userId);
    await taskAccess(id);
    // Datas históricas são lidas como texto para não depender da codificação legada do SQLite.
    const rows = await db.$queryRaw<TarefaBusca[]>`
      SELECT id, texto, descricao, feita, fixa, prioridade, "diaSemana", "intervaloDias", horario,
        CAST("dataInicio" AS TEXT) AS "dataInicio", "userId", CAST("createdAt" AS TEXT) AS "createdAt", CAST("concluidaEm" AS TEXT) AS "concluidaEm"
      FROM "Tarefa" WHERE "userId" = ${id} AND LOWER(COALESCE("descricao", '')) NOT LIKE '%equipe%'
      ORDER BY "feita" ASC, "horario" ASC`;
    return Array.isArray(rows) ? rows : [];
  } catch (error) { console.error("[BuscarTarefasPorUsuario]", error); return []; }
}

export async function BuscarTarefasPorEmail(email: string) {
  try {
    await requireLegacyActor(["ServiçosGerais", "gerenciamentoTarefas"]);
    const user = await db.usuarios.findUnique({ where: { email: z.email().parse(email) }, select: { id: true } });
    return user ? BuscarTarefasPorUsuario(String(user.id), "") : [];
  } catch (error) { console.error("[BuscarTarefasPorEmail]", error); return []; }
}

export async function AlternarStatusTarefa(id: string, novoStatus: boolean) {
  try {
    await requireLegacyActor();
    const taskId = idSchema.parse(id);
    const task = await db.tarefa.findUnique({ where: { id: taskId }, select: { userId: true } });
    if (!task) return { success: false as const, error: "Tarefa não encontrada." };
    await taskAccess(task.userId);
    const result = await db.tarefa.updateMany({ where: { id: taskId, userId: task.userId }, data: { feita: z.boolean().parse(novoStatus), concluidaEm: novoStatus ? new Date() : null } });
    if (result.count !== 1) return { success: false as const, error: "Tarefa não encontrada ou alterada. Recarregue a lista." };
    refreshTasks(); return { success: true as const };
  } catch (error) { return { success: false as const, error: taskError(error) }; }
}

export async function EditarTarefa(id: string, data: {
  texto: string; descricao?: string; fixa: boolean; diasSemana?: number[]; intervaloDias?: number | null;
  dataInicio?: Date; prioridade: string; horario?: string | null;
}) {
  try {
    const taskId = idSchema.parse(id);
    const parsed = payloadSchema.parse(data);
    await requireLegacyActor(["gerenciamentoTarefas"]);
    const { diasSemana, diaSemana, ...fields } = parsed;
    const result = await db.tarefa.updateMany({ where: { id: taskId }, data: {
      ...fields,
      ...(diasSemana !== undefined ? { diaSemana: diasSemana[0] ?? null } : diaSemana !== undefined ? { diaSemana } : {}),
      ...(parsed.horario !== undefined ? { horario: parsed.horario || null } : {}),
    } });
    if (result.count !== 1) return { success: false as const, error: "Tarefa não encontrada." };
    refreshTasks(); return { success: true as const };
  } catch (error) { return { success: false as const, error: taskError(error) }; }
}

export async function DeletarTarefa(id: string) {
  try {
    await requireLegacyActor(["gerenciamentoTarefas"]);
    const result = await db.tarefa.deleteMany({ where: { id: idSchema.parse(id) } });
    if (result.count !== 1) return { success: false as const, error: "Tarefa não encontrada." };
    refreshTasks(); return { success: true as const };
  } catch (error) { return { success: false as const, error: taskError(error) }; }
}
