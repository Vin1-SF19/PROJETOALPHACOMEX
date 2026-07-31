"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";
import { gerarLancamentosParaEvento } from "@/lib/commissions/entry-generator";
import {
  registrarAmbiguidadesParticipantes,
  resolverParticipantesAutomaticosEvento,
} from "@/lib/commissions/participant-resolver";
import { verificarAcessoCategoria, type CategoriaPermissao } from "@/lib/commissions/permissions";

async function exigirAcesso(categoria: CategoriaPermissao) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Não autenticado" };

  const role = (session.user as { role?: string }).role ?? "";
  const resultado = await verificarAcessoCategoria(Number(session.user.id), role, categoria);
  if (!resultado.ok) return { ok: false as const, error: resultado.error ?? "Sem permissão" };

  return { ok: true as const, userId: resultado.userId! };
}

const criarEventoManualSchema = z.object({
  cnpj: z.string().min(1),
  razaoSocial: z.string().min(1),
  servico: z.string().min(1),
  eventDate: z.coerce.date(),
  grossContractAmountCents: z.number().int().nonnegative(),
  netContractAmountCents: z.number().int().nonnegative(),
  collaboratorIds: z.array(z.number().int().positive()).min(1),
});

export async function CriarEventoFinanceiro(input: z.infer<typeof criarEventoManualSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = criarEventoManualSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { collaboratorIds, ...eventData } = parsed.data;

  try {
    const event = await db.commissionEvent.create({
      data: {
        eventType: "MANUAL_EVENT",
        cnpj: eventData.cnpj,
        razaoSocial: eventData.razaoSocial,
        servico: eventData.servico,
        eventDate: eventData.eventDate,
        grossContractAmountCents: eventData.grossContractAmountCents,
        netContractAmountCents: eventData.netContractAmountCents,
        status: "OK",
        sourceSystem: "manual",
        sourceEntity: "lancamento-manual",
        sourceId: crypto.randomUUID(),
        lastSyncAt: new Date(),
      },
    });

    const resultado = await gerarLancamentosParaEvento({ eventId: event.id, collaboratorIds });

    return { success: true, data: { eventId: event.id, ...resultado } } as const;
  } catch (error) {
    console.error("[CriarEventoFinanceiro]", error);
    return { success: false, error: "Erro interno ao criar evento" } as const;
  }
}

const recalcularEventoSchema = z.object({
  eventId: z.string().min(1),
  collaboratorIds: z.array(z.number().int().positive()).min(1),
});

export async function RecalcularEvento(input: z.infer<typeof recalcularEventoSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = recalcularEventoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const resultado = await gerarLancamentosParaEvento(parsed.data);
    return { success: true, data: resultado } as const;
  } catch (error) {
    console.error("[RecalcularEvento]", error);
    return { success: false, error: "Erro interno ao recalcular evento" } as const;
  }
}

const gerarLancamentosAutomaticosSchema = z.object({ eventId: z.string().min(1) });

/**
 * Gera lançamentos para um evento que ainda não tem nenhum, resolvendo automaticamente
 * closer/analista responsável já gravados no próprio CommissionEvent (mesma lógica usada
 * na sincronização — ver sync-engine.ts). Usado para retroagir eventos sincronizados ANTES
 * da conexão automática existir, ou qualquer evento que ficou sem lançamento por algum
 * motivo. Não inclui os demais cargos do Big Card (Coordenadora/Diretora Comercial,
 * Auditor Contábil, Diretor Operacional) — esses continuam exigindo adição manual, pois o
 * sistema não tem fonte de dado para resolvê-los sozinho.
 */
export async function GerarLancamentosAutomaticosEvento(input: z.infer<typeof gerarLancamentosAutomaticosSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = gerarLancamentosAutomaticosSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const event = await db.commissionEvent.findUnique({
      where: { id: parsed.data.eventId },
      select: { id: true },
    });
    if (!event) return { success: false, error: "Evento não encontrado" } as const;

    const { collaboratorIds, ambiguidades } = await resolverParticipantesAutomaticosEvento(event.id);
    await registrarAmbiguidadesParticipantes(event.id, ambiguidades);

    if (collaboratorIds.length === 0) {
      return {
        success: false,
        error: "Nenhum participante pôde ser resolvido automaticamente. Atribua os responsáveis no card ou crie o lançamento manual.",
      } as const;
    }

    const resultado = await gerarLancamentosParaEvento({ eventId: parsed.data.eventId, collaboratorIds });
    return { success: true, data: resultado } as const;
  } catch (error) {
    console.error("[GerarLancamentosAutomaticosEvento]", error);
    return { success: false, error: "Erro interno ao gerar lançamentos" } as const;
  }
}

const aprovarEventoSchema = z.object({ eventId: z.string().min(1) });

export async function AprovarEvento(input: z.infer<typeof aprovarEventoSchema>) {
  const acesso = await exigirAcesso("APROVAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = aprovarEventoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const event = await db.commissionEvent.findUnique({ where: { id: parsed.data.eventId }, select: { id: true } });
    if (!event) return { success: false, error: "Evento não encontrado" } as const;

    const updated = await db.commissionEvent.update({
      where: { id: parsed.data.eventId },
      data: { status: "OK" },
    });

    return { success: true, data: updated } as const;
  } catch (error) {
    console.error("[AprovarEvento]", error);
    return { success: false, error: "Erro interno ao aprovar evento" } as const;
  }
}
