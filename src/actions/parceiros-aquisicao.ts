"use server";

// CRM de Canais e Parcerias — Fase 02 (Aquisição de Parceiros).
// Staging tipo "card virtual" (mesmo padrão já em produção da `NolossLead`, ver
// .bibble/memory/architecture.md) — NUNCA cria `BpmCard`. Promoção final materializa
// um `Parceiro` real via `criarParceiro()` já existente (nunca duplica a entidade).

import { z } from "zod";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCtx, criarParceiro } from "./parceiros";

// ─── Máquina de estados (etapas fixas do funil, conforme pedido do usuário) ───

const ETAPAS_ATIVAS = [
  "NOVO_LEAD",
  "EM_PROSPECCAO",
  "CONTATO_REALIZADO",
  "EM_QUALIFICACAO",
  "REUNIAO_AGENDADA",
  "REUNIAO_REALIZADA",
  "NEGOCIACAO_FOLLOWUP",
  "AGUARDANDO_CADASTRO",
  "PRE_CADASTRO",
] as const;

const SAIDAS_LATERAIS = ["STANDBY", "SEM_PERFIL", "PERDIDO"] as const;

// "CADASTRADO" é terminal e só é atingido via `PromoverLeadParaParceiro` (tem efeitos
// colaterais — cria o Parceiro real — que `MoverLeadAquisicaoParceiro` não deve disparar).
type EtapaAtiva = (typeof ETAPAS_ATIVAS)[number];

function podeMoverPara(statusAtual: string, statusDestino: string): boolean {
  if (statusDestino === "CADASTRADO") return false; // só via promoção
  if (statusAtual === "CADASTRADO") return false; // terminal

  const isDestinoLateral = (SAIDAS_LATERAIS as readonly string[]).includes(statusDestino);
  if (isDestinoLateral) {
    // Qualquer etapa ativa pode sair lateralmente.
    return (ETAPAS_ATIVAS as readonly string[]).includes(statusAtual);
  }

  if (!(ETAPAS_ATIVAS as readonly string[]).includes(statusDestino)) return false;

  // De uma saída lateral, pode retomar para qualquer etapa ativa (reingresso manual).
  if ((SAIDAS_LATERAIS as readonly string[]).includes(statusAtual)) return true;

  // Entre etapas ativas: avança 1 posição ou corrige para qualquer etapa anterior.
  const idxAtual = ETAPAS_ATIVAS.indexOf(statusAtual as EtapaAtiva);
  const idxDestino = ETAPAS_ATIVAS.indexOf(statusDestino as EtapaAtiva);
  if (idxAtual === -1 || idxDestino === -1) return false;
  return idxDestino === idxAtual + 1 || idxDestino < idxAtual;
}

async function registrarHistoricoLead(
  leadId: string,
  acao: string,
  valorAnteriorJson: string | null,
  valorNovoJson: string | null,
  usuarioId: number | null,
  automacaoOrigem?: string,
) {
  await db.parceiroLeadHistorico.create({
    data: { leadId, acao, valorAnteriorJson, valorNovoJson, usuarioId, automacaoOrigem: automacaoOrigem ?? null },
  });
}

// ─── Criar lead ────────────────────────────────────────────────────────────

const CriarLeadSchema = z.object({
  nome: z.string().min(2),
  tipo: z.enum(["PF", "PJ"]).optional(),
  documento: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  telefone: z.string().optional(),
  segmento: z.string().optional(),
  origem: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().max(2).optional(),
  responsavelId: z.number().int().positive().optional(),
});

export async function CriarLeadAquisicaoParceiro(input: z.input<typeof CriarLeadSchema>) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false as const, error: "Sem permissão" };

  const parsed = CriarLeadSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const d = parsed.data;

  const lead = await db.parceiroLead.create({
    data: {
      nome: d.nome,
      tipo: d.tipo ?? null,
      documento: d.documento?.replace(/\D/g, "") || null,
      email: d.email || null,
      telefone: d.telefone || null,
      segmento: d.segmento || null,
      origem: d.origem || null,
      cidade: d.cidade || null,
      uf: d.uf || null,
      responsavelId: d.responsavelId ?? null,
    },
  });
  await registrarHistoricoLead(lead.id, "LEAD_CRIADO", null, JSON.stringify({ status: lead.status }), ctx.userId);
  revalidatePath("/PainelAlpha/Parceiros/Aquisicao");
  return { success: true as const, lead };
}

// ─── Mover etapa ─────────────────────────────────────────────────────────────

const MoverLeadSchema = z.object({
  leadId: z.string().cuid(),
  statusDestino: z.enum([...ETAPAS_ATIVAS] as [string, ...string[]]),
});

export async function MoverLeadAquisicaoParceiro(input: z.input<typeof MoverLeadSchema>) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false as const, error: "Sem permissão" };

  const parsed = MoverLeadSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { leadId, statusDestino } = parsed.data;

  const lead = await db.parceiroLead.findUnique({ where: { id: leadId } });
  if (!lead) return { success: false as const, error: "Lead não encontrado" };

  if (!podeMoverPara(lead.status, statusDestino)) {
    return { success: false as const, error: `Transição inválida: ${lead.status} → ${statusDestino}` };
  }

  await db.$transaction([
    db.parceiroLead.update({ where: { id: leadId }, data: { status: statusDestino } }),
    db.parceiroLeadHistorico.create({
      data: {
        leadId,
        acao: "ETAPA_ALTERADA",
        valorAnteriorJson: JSON.stringify({ status: lead.status }),
        valorNovoJson: JSON.stringify({ status: statusDestino }),
        usuarioId: ctx.userId,
      },
    }),
  ]);

  revalidatePath("/PainelAlpha/Parceiros/Aquisicao");
  return { success: true as const };
}

// ─── Saída lateral ────────────────────────────────────────────────────────────

const SaidaLateralSchema = z.object({
  leadId: z.string().cuid(),
  status: z.enum([...SAIDAS_LATERAIS] as [string, ...string[]]),
  motivo: z.string().min(3, "Descreva o motivo da saída"),
});

export async function RegistrarSaidaLateralLeadAquisicao(input: z.input<typeof SaidaLateralSchema>) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false as const, error: "Sem permissão" };

  const parsed = SaidaLateralSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { leadId, status, motivo } = parsed.data;

  const lead = await db.parceiroLead.findUnique({ where: { id: leadId } });
  if (!lead) return { success: false as const, error: "Lead não encontrado" };
  if (!podeMoverPara(lead.status, status)) {
    return { success: false as const, error: `Transição inválida: ${lead.status} → ${status}` };
  }

  await db.$transaction([
    db.parceiroLead.update({ where: { id: leadId }, data: { status, motivoSaidaLateral: motivo } }),
    db.parceiroLeadHistorico.create({
      data: {
        leadId,
        acao: "SAIDA_LATERAL",
        valorAnteriorJson: JSON.stringify({ status: lead.status }),
        valorNovoJson: JSON.stringify({ status, motivo }),
        usuarioId: ctx.userId,
      },
    }),
  ]);

  revalidatePath("/PainelAlpha/Parceiros/Aquisicao");
  return { success: true as const };
}

// ─── Potencial de recorrência (0-5, manual) ──────────────────────────────────

const PotencialLeadSchema = z.object({
  leadId: z.string().cuid(),
  potencialRecorrencia: z.number().int().min(0).max(5),
});

export async function AtualizarPotencialLeadAquisicao(input: z.input<typeof PotencialLeadSchema>) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false as const, error: "Sem permissão" };

  const parsed = PotencialLeadSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { leadId, potencialRecorrencia } = parsed.data;

  const lead = await db.parceiroLead.findUnique({ where: { id: leadId }, select: { potencialRecorrencia: true } });
  if (!lead) return { success: false as const, error: "Lead não encontrado" };

  await db.$transaction([
    db.parceiroLead.update({ where: { id: leadId }, data: { potencialRecorrencia } }),
    db.parceiroLeadHistorico.create({
      data: {
        leadId,
        acao: "POTENCIAL_ALTERADO",
        valorAnteriorJson: JSON.stringify({ potencialRecorrencia: lead.potencialRecorrencia }),
        valorNovoJson: JSON.stringify({ potencialRecorrencia }),
        usuarioId: ctx.userId,
      },
    }),
  ]);

  revalidatePath("/PainelAlpha/Parceiros/Aquisicao");
  return { success: true as const };
}

// ─── Próxima ação ────────────────────────────────────────────────────────────

const ProximaAcaoLeadSchema = z.object({
  leadId: z.string().cuid(),
  proximaAcaoEm: z.coerce.date(),
  proximaAcaoDescricao: z.string().min(1),
});

export async function RegistrarProximaAcaoLeadAquisicao(input: z.input<typeof ProximaAcaoLeadSchema>) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false as const, error: "Sem permissão" };

  const parsed = ProximaAcaoLeadSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { leadId, proximaAcaoEm, proximaAcaoDescricao } = parsed.data;

  const lead = await db.parceiroLead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return { success: false as const, error: "Lead não encontrado" };

  await db.parceiroLead.update({ where: { id: leadId }, data: { proximaAcaoEm, proximaAcaoDescricao } });
  await registrarHistoricoLead(leadId, "PROXIMA_ACAO_REGISTRADA", null, JSON.stringify({ proximaAcaoEm, proximaAcaoDescricao }), ctx.userId);

  revalidatePath("/PainelAlpha/Parceiros/Aquisicao");
  return { success: true as const };
}

// ─── Responsáveis (para o seletor da UI) ─────────────────────────────────────

export async function ListarResponsaveisParceiros() {
  const ctx = await getCtx();
  if (!ctx) return { success: false as const, error: "Sem permissão", usuarios: [] };
  const usuarios = await db.usuarios.findMany({
    where: { status: "ATIVO" },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  return { success: true as const, usuarios };
}

// ─── Listagem (Kanban) ────────────────────────────────────────────────────────

export async function ListarLeadsAquisicaoParceiros(filtros?: {
  responsavelId?: number;
  status?: string;
  potencialMin?: number;
  segmento?: string;
  origem?: string;
  uf?: string;
}) {
  const ctx = await getCtx();
  if (!ctx) return { success: false as const, error: "Sem permissão", leads: [] };

  const leads = await db.parceiroLead.findMany({
    where: {
      responsavelId: filtros?.responsavelId,
      potencialRecorrencia: filtros?.potencialMin !== undefined ? { gte: filtros.potencialMin } : undefined,
      segmento: filtros?.segmento ? { contains: filtros.segmento } : undefined,
      origem: filtros?.origem ? { contains: filtros.origem } : undefined,
      uf: filtros?.uf,
      // "CADASTRADO" some do Kanban de aquisição (processo encerrado) — continua consultável
      // via histórico/relatório, não na visão operacional do funil.
      status: filtros?.status ?? { not: "CADASTRADO" },
    },
    select: {
      id: true,
      status: true,
      tipo: true,
      documento: true,
      nome: true,
      email: true,
      telefone: true,
      segmento: true,
      origem: true,
      cidade: true,
      uf: true,
      responsavelId: true,
      responsavel: { select: { id: true, nome: true } },
      potencialRecorrencia: true,
      proximaAcaoEm: true,
      proximaAcaoDescricao: true,
      motivoSaidaLateral: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return { success: true as const, leads };
}

// ─── Promoção: Lead → Parceiro real (idempotente, sem duplicidade) ───────────

const PromoverLeadSchema = z.object({
  leadId: z.string().cuid(),
  // Dados obrigatórios de `Parceiro` que podem não ter sido coletados ainda no lead
  // (documento/email são exigidos por `criarParceiro`, mas opcionais em `ParceiroLead`).
  documento: z.string().min(11).optional(),
  email: z.string().email().optional(),
});

export async function PromoverLeadParaParceiro(input: z.input<typeof PromoverLeadSchema>) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false as const, error: "Sem permissão" };

  const parsed = PromoverLeadSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { leadId, documento: documentoOverride, email: emailOverride } = parsed.data;

  const leadAntes = await db.parceiroLead.findUnique({ where: { id: leadId } });
  if (!leadAntes) return { success: false as const, error: "Lead não encontrado" };
  if (leadAntes.status === "CADASTRADO") {
    return { success: false as const, error: "Este lead já foi promovido a parceiro", parceiroId: leadAntes.promovidoParceiroId ?? undefined };
  }
  const statusAntes = leadAntes.status;

  // CAS: só reivindica o lead se o status ainda for exatamente o lido acima — blinda
  // contra duplo-clique e duas promoções concorrentes do mesmo lead (mesmo padrão do
  // card virtual NolossLead: compara valor antigo, troca pelo novo em 1 operação atômica).
  const reserva = await db.parceiroLead.updateMany({
    where: { id: leadId, status: statusAntes },
    data: { status: "CADASTRADO" },
  });
  if (reserva.count === 0) {
    const atual = await db.parceiroLead.findUnique({ where: { id: leadId }, select: { status: true, promovidoParceiroId: true } });
    if (atual?.status === "CADASTRADO") {
      return { success: false as const, error: "Este lead já foi promovido a parceiro", parceiroId: atual.promovidoParceiroId ?? undefined };
    }
    return { success: false as const, error: "O lead mudou de etapa nesse meio-tempo — recarregue e tente novamente" };
  }

  const documento = (documentoOverride ?? leadAntes.documento ?? "").replace(/\D/g, "");
  const email = emailOverride ?? leadAntes.email ?? "";

  if (documento.length < 11) {
    await db.parceiroLead.update({ where: { id: leadId }, data: { status: statusAntes } });
    return { success: false as const, error: "Documento (CPF/CNPJ) é obrigatório para cadastrar o parceiro" };
  }
  if (!email) {
    await db.parceiroLead.update({ where: { id: leadId }, data: { status: statusAntes } });
    return { success: false as const, error: "E-mail é obrigatório para cadastrar o parceiro" };
  }

  // Checagem de duplicidade explícita (além da constraint @unique de `documento`, que
  // devolveria um erro genérico do Prisma sem essa checagem prévia amigável).
  const existente = await db.parceiro.findUnique({ where: { documento } });
  if (existente) {
    await db.parceiroLead.update({ where: { id: leadId }, data: { status: statusAntes } });
    return { success: false as const, error: "Já existe um parceiro cadastrado com este documento", parceiroId: existente.id };
  }

  const resultado = await criarParceiro({
    tipo: (leadAntes.tipo as "PF" | "PJ" | null) ?? "PF",
    documento,
    nome: leadAntes.nome,
    email,
    telefone: leadAntes.telefone ?? undefined,
  });

  if (!resultado.success || !resultado.parceiro) {
    // Reverte a reserva — a promoção falhou, o lead volta a ficar disponível na etapa original.
    await db.parceiroLead.update({ where: { id: leadId }, data: { status: statusAntes } });
    return { success: false as const, error: resultado.error ?? "Erro ao cadastrar parceiro" };
  }

  await db.$transaction([
    db.parceiroLead.update({
      where: { id: leadId },
      data: {
        promovidoParceiroId: resultado.parceiro.id,
        promovidoEm: new Date(),
        promovidoPorUserId: ctx.userId,
      },
    }),
    // Propaga o potencial de recorrência já qualificado no lead para o Parceiro real —
    // não se perde na promoção (requisito explícito do pedido).
    ...(leadAntes.potencialRecorrencia !== null
      ? [
          db.parceiro.update({
            where: { id: resultado.parceiro.id },
            data: {
              potencialRecorrencia: leadAntes.potencialRecorrencia,
              potencialRecorrenciaAtualizadoEm: new Date(),
              potencialRecorrenciaAtualizadoPorId: ctx.userId,
              segmento: leadAntes.segmento,
              origem: leadAntes.origem,
              responsavelId: leadAntes.responsavelId,
            },
          }),
        ]
      : [
          db.parceiro.update({
            where: { id: resultado.parceiro.id },
            data: { segmento: leadAntes.segmento, origem: leadAntes.origem, responsavelId: leadAntes.responsavelId },
          }),
        ]),
    db.parceiroLeadHistorico.create({
      data: {
        leadId,
        acao: "PROMOVIDO_A_PARCEIRO",
        valorAnteriorJson: JSON.stringify({ status: statusAntes }),
        valorNovoJson: JSON.stringify({ status: "CADASTRADO", parceiroId: resultado.parceiro.id }),
        usuarioId: ctx.userId,
      },
    }),
    db.parceiroHistorico.create({
      data: {
        parceiroId: resultado.parceiro.id,
        acao: "PROMOVIDO_DA_AQUISICAO",
        valorNovoJson: JSON.stringify({ leadId }),
        usuarioId: ctx.userId,
        automacaoOrigem: "aquisicao:promocao",
      },
    }),
  ]);

  revalidatePath("/PainelAlpha/Parceiros/Aquisicao");
  revalidatePath("/PainelAlpha/Parceiros");
  return { success: true as const, parceiro: resultado.parceiro };
}
