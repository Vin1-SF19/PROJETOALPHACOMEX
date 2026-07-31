"use server";

import { auth } from "../../auth";
import { z } from "zod";
import { put } from "@vercel/blob";
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { verificarAcessoCategoria, type CategoriaPermissao } from "@/lib/commissions/permissions";

type DbTransaction = Prisma.TransactionClient;

class PagamentoValidationError extends Error {}

async function exigirAcesso(categoria: CategoriaPermissao) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Não autenticado" };

  const role = (session.user as { role?: string }).role ?? "";
  const resultado = await verificarAcessoCategoria(Number(session.user.id), role, categoria);
  if (!resultado.ok) return { ok: false as const, error: resultado.error ?? "Sem permissão" };

  return { ok: true as const, userId: resultado.userId! };
}

async function registrarAuditoria(
  client: DbTransaction,
  params: {
    userId: number;
    acao: string;
    entityId: string;
    before: unknown;
    after: unknown;
    correlationId: string;
  },
) {
  await client.commissionAuditLog.create({
    data: {
      userId: params.userId,
      acao: params.acao,
      entityType: "CommissionEntry",
      entityId: params.entityId,
      beforeJson: JSON.stringify(params.before),
      afterJson: JSON.stringify(params.after),
      correlationId: params.correlationId,
    },
  });
}

function calcularSaldo(alocacoes: Array<{ valorCents: number }>) {
  return alocacoes.reduce((sum, alocacao) => sum + alocacao.valorCents, 0);
}

const STATUS_BLOQUEADOS_PARA_PAGAMENTO = [
  "Pago",
  "Cancelado",
  "Bloqueado",
  "EmDivergencia",
  "Estornado",
];

const TIPOS_COMPROVANTE = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const LIMITE_COMPROVANTE_BYTES = 10 * 1024 * 1024;

/** Upload privado; o banco guarda somente o pathname, nunca uma URL pública. */
export async function EnviarComprovantePagamento(formData: FormData) {
  const acesso = await exigirAcesso("PAGAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { success: false, error: "Nenhum arquivo selecionado" } as const;
  }
  if (file.size > LIMITE_COMPROVANTE_BYTES) {
    return { success: false, error: "Arquivo muito grande (máx. 10MB)" } as const;
  }
  if (!TIPOS_COMPROVANTE.has(file.type)) {
    return { success: false, error: "Envie um comprovante PDF, JPG, PNG ou WEBP." } as const;
  }

  const token = process.env.COMISSOES_COLAB_READ_WRITE_TOKEN;
  if (!token) {
    return { success: false, error: "COMISSOES_COLAB_READ_WRITE_TOKEN não configurado" } as const;
  }

  try {
    const extensao = file.name.split(".").pop()?.replaceAll(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
    const blob = await put(
      `comprovantes-pagamento/${acesso.userId}/${crypto.randomUUID()}.${extensao}`,
      file,
      {
        access: "private",
        addRandomSuffix: true,
        contentType: file.type,
        token,
      },
    );

    return { success: true, pathname: blob.pathname } as const;
  } catch (error) {
    console.error("[EnviarComprovantePagamento]", error);
    return { success: false, error: "Erro ao enviar comprovante" } as const;
  }
}

const registrarPagamentoSchema = z.object({
  entryId: z.string().min(1),
  data: z.coerce.date(),
  valorCents: z.number().int().positive(),
  meio: z.string().trim().min(1),
  referencia: z.string().trim().max(120).optional(),
  observacao: z.string().trim().max(1000).optional(),
  comprovantePathname: z.string().trim().min(1).optional(),
});

export async function RegistrarPagamento(input: z.infer<typeof registrarPagamentoSchema>) {
  const acesso = await exigirAcesso("PAGAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = registrarPagamentoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const resultado = await db.$transaction(async (tx) => {
      const entry = await tx.commissionEntry.findUnique({
        where: { id: parsed.data.entryId },
        include: { alocacoes: { select: { valorCents: true } } },
      });
      if (!entry) throw new PagamentoValidationError("Lançamento não encontrado");
      if (STATUS_BLOQUEADOS_PARA_PAGAMENTO.includes(entry.status)) {
        throw new PagamentoValidationError(
          `Lançamento com status "${entry.status}" não pode receber pagamento.`,
        );
      }

      const saldoPagoAntes = calcularSaldo(entry.alocacoes);
      const saldoPendenteAntes = entry.totalCents - saldoPagoAntes;
      if (saldoPendenteAntes <= 0) {
        throw new PagamentoValidationError("Este lançamento não possui saldo pendente.");
      }
      if (parsed.data.valorCents > saldoPendenteAntes) {
        throw new PagamentoValidationError(
          `O valor informado ultrapassa o saldo pendente de ${saldoPendenteAntes} centavos.`,
        );
      }

      const correlationId = crypto.randomUUID();
      const payment = await tx.payment.create({
        data: {
          data: parsed.data.data,
          valorCents: parsed.data.valorCents,
          meio: parsed.data.meio,
          referencia: parsed.data.referencia,
          observacao: parsed.data.observacao,
          comprovanteUrl: parsed.data.comprovantePathname,
          usuarioResponsavelId: acesso.userId,
          tipo: "PAGAMENTO",
        },
      });

      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          entryId: entry.id,
          valorCents: parsed.data.valorCents,
        },
      });

      const saldoPago = saldoPagoAntes + parsed.data.valorCents;
      const saldoPendenteCents = Math.max(0, entry.totalCents - saldoPago);
      const novoStatus = saldoPendenteCents === 0 ? "Pago" : "ParcialmentePago";
      const entryAtualizado = await tx.commissionEntry.update({
        where: { id: entry.id },
        data: { status: novoStatus, actualPaymentDate: parsed.data.data },
      });

      await registrarAuditoria(tx, {
        userId: acesso.userId,
        acao: "REGISTRAR_PAGAMENTO",
        entityId: entry.id,
        before: {
          status: entry.status,
          saldoPagoCents: saldoPagoAntes,
          saldoPendenteCents: saldoPendenteAntes,
        },
        after: {
          status: novoStatus,
          paymentId: payment.id,
          valorCents: parsed.data.valorCents,
          saldoPagoCents: saldoPago,
          saldoPendenteCents,
        },
        correlationId,
      });

      return { payment, entry: entryAtualizado, saldoPago, saldoPendenteCents };
    });

    return { success: true, data: resultado } as const;
  } catch (error) {
    if (error instanceof PagamentoValidationError) {
      return { success: false, error: error.message } as const;
    }
    console.error("[RegistrarPagamento]", error);
    return { success: false, error: "Erro interno ao registrar pagamento" } as const;
  }
}

export interface ComponentePagamentoLote {
  tipo: string;
  valorCents: number;
  descricao: string;
}

export interface ItemElegivelPagamentoLote {
  entryId: string;
  collaboratorId: number;
  colaboradorNome: string;
  cargoNome: string | null;
  componentes: ComponentePagamentoLote[];
  totalCents: number;
  saldoPagoCents: number;
  valorPendenteCents: number;
}

export interface ItemExcluidoPagamentoLote {
  entryId: string;
  collaboratorId: number | null;
  colaboradorNome: string;
  cargoNome: string | null;
  motivo: string;
}

function descricaoComponente(memoriaCalculoJson: string, tipo: string) {
  try {
    const memoria = JSON.parse(memoriaCalculoJson) as { ruleName?: string };
    return memoria.ruleName ?? tipo;
  } catch {
    return tipo;
  }
}

async function classificarEntriesParaLote(
  client: DbTransaction | typeof db,
  entryIds: string[],
): Promise<{ elegiveis: ItemElegivelPagamentoLote[]; excluidos: ItemExcluidoPagamentoLote[] }> {
  const idsUnicos = [...new Set(entryIds)];
  const entries = await client.commissionEntry.findMany({
    where: { id: { in: idsUnicos } },
    include: {
      componentes: true,
      alocacoes: { select: { valorCents: true } },
    },
  });
  const entriesPorId = new Map(entries.map((entry) => [entry.id, entry]));
  const usuarios = await client.usuarios.findMany({
    where: { id: { in: [...new Set(entries.map((entry) => entry.collaboratorId))] } },
    select: { id: true, nome: true, cargo: true },
  });
  const usuariosPorId = new Map(usuarios.map((usuario) => [usuario.id, usuario]));

  const elegiveis: ItemElegivelPagamentoLote[] = [];
  const excluidos: ItemExcluidoPagamentoLote[] = [];

  for (const entryId of idsUnicos) {
    const entry = entriesPorId.get(entryId);
    if (!entry) {
      excluidos.push({
        entryId,
        collaboratorId: null,
        colaboradorNome: "Lançamento não encontrado",
        cargoNome: null,
        motivo: "Lançamento não encontrado",
      });
      continue;
    }

    const usuario = usuariosPorId.get(entry.collaboratorId);
    const baseExcluido = {
      entryId,
      collaboratorId: entry.collaboratorId,
      colaboradorNome: usuario?.nome ?? "Colaborador não encontrado",
      cargoNome: usuario?.cargo ?? null,
    };

    const motivoStatus: Record<string, string> = {
      Pago: "Já está pago",
      Cancelado: "Lançamento cancelado",
      Bloqueado: "Lançamento bloqueado",
      EmDivergencia: "Lançamento em divergência — resolva antes de pagar",
      Estornado: "Lançamento estornado",
      ParcialmentePago: "Parcialmente pago — requer conferência individual",
    };
    if (motivoStatus[entry.status]) {
      excluidos.push({ ...baseExcluido, motivo: motivoStatus[entry.status] });
      continue;
    }

    const saldoPagoCents = calcularSaldo(entry.alocacoes);
    const valorPendenteCents = entry.totalCents - saldoPagoCents;
    if (valorPendenteCents <= 0) {
      excluidos.push({ ...baseExcluido, motivo: "Saldo pendente zerado ou negativo" });
      continue;
    }

    elegiveis.push({
      ...baseExcluido,
      componentes: entry.componentes.map((componente) => ({
        tipo: componente.tipo,
        valorCents: componente.valorCents,
        descricao: descricaoComponente(componente.memoriaCalculoJson, componente.tipo),
      })),
      totalCents: entry.totalCents,
      saldoPagoCents,
      valorPendenteCents,
    });
  }

  return { elegiveis, excluidos };
}

const listaEntryIdsSchema = z.object({
  entryIds: z.array(z.string().min(1)).min(1).max(200),
});

export async function PrepararPagamentoLoteBigCard(input: z.infer<typeof listaEntryIdsSchema>) {
  const acesso = await exigirAcesso("PAGAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = listaEntryIdsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const { elegiveis, excluidos } = await classificarEntriesParaLote(db, parsed.data.entryIds);
    const totalCents = elegiveis.reduce((sum, entry) => sum + entry.valorPendenteCents, 0);
    return { success: true, data: { elegiveis, excluidos, totalCents } } as const;
  } catch (error) {
    console.error("[PrepararPagamentoLoteBigCard]", error);
    return { success: false, error: "Erro interno ao preparar pagamento em lote" } as const;
  }
}

const registrarPagamentoLoteSchema = listaEntryIdsSchema.extend({
  data: z.coerce.date(),
  meio: z.string().trim().min(1),
  referencia: z.string().trim().max(120).optional(),
  observacao: z.string().trim().max(1000).optional(),
  comprovantePathname: z.string().trim().min(1).optional(),
});

export async function RegistrarPagamentoLote(input: z.infer<typeof registrarPagamentoLoteSchema>) {
  const acesso = await exigirAcesso("PAGAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = registrarPagamentoLoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const resultado = await db.$transaction(async (tx) => {
      const { elegiveis, excluidos } = await classificarEntriesParaLote(tx, parsed.data.entryIds);
      const processados: string[] = [];
      const correlationId = crypto.randomUUID();

      for (const item of elegiveis) {
        const entry = await tx.commissionEntry.findUnique({ where: { id: item.entryId } });
        if (!entry) throw new Error(`Lançamento ${item.entryId} desapareceu durante o lote.`);

        const payment = await tx.payment.create({
          data: {
            data: parsed.data.data,
            valorCents: item.valorPendenteCents,
            meio: parsed.data.meio,
            referencia: parsed.data.referencia,
            observacao: parsed.data.observacao,
            comprovanteUrl: parsed.data.comprovantePathname,
            usuarioResponsavelId: acesso.userId,
            tipo: "PAGAMENTO",
          },
        });
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            entryId: item.entryId,
            valorCents: item.valorPendenteCents,
          },
        });
        await tx.commissionEntry.update({
          where: { id: item.entryId },
          data: { status: "Pago", actualPaymentDate: parsed.data.data },
        });
        await registrarAuditoria(tx, {
          userId: acesso.userId,
          acao: "REGISTRAR_PAGAMENTO_LOTE",
          entityId: item.entryId,
          before: { status: entry.status, saldoPendenteCents: item.valorPendenteCents },
          after: {
            status: "Pago",
            paymentId: payment.id,
            valorCents: item.valorPendenteCents,
            saldoPendenteCents: 0,
          },
          correlationId,
        });
        processados.push(item.entryId);
      }

      return { processados, excluidos };
    });

    return { success: true, data: resultado } as const;
  } catch (error) {
    console.error("[RegistrarPagamentoLote]", error);
    return { success: false, error: "Nenhum pagamento foi registrado; o lote foi revertido." } as const;
  }
}

const programarPagamentoSchema = z.object({
  entryId: z.string().min(1),
  scheduledPaymentDate: z.coerce.date(),
});

export async function ProgramarPagamento(input: z.infer<typeof programarPagamentoSchema>) {
  const acesso = await exigirAcesso("PAGAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = programarPagamentoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const atualizado = await db.$transaction(async (tx) => {
      const entry = await tx.commissionEntry.findUnique({ where: { id: parsed.data.entryId } });
      if (!entry) throw new PagamentoValidationError("Lançamento não encontrado");
      if (STATUS_BLOQUEADOS_PARA_PAGAMENTO.includes(entry.status)) {
        throw new PagamentoValidationError(
          `Lançamento com status "${entry.status}" não pode ser programado.`,
        );
      }

      const resultado = await tx.commissionEntry.update({
        where: { id: parsed.data.entryId },
        data: {
          status: "Programado",
          scheduledPaymentDate: parsed.data.scheduledPaymentDate,
        },
      });
      await registrarAuditoria(tx, {
        userId: acesso.userId,
        acao: "PROGRAMAR_PAGAMENTO",
        entityId: parsed.data.entryId,
        before: { status: entry.status, scheduledPaymentDate: entry.scheduledPaymentDate },
        after: {
          status: "Programado",
          scheduledPaymentDate: parsed.data.scheduledPaymentDate,
        },
        correlationId: crypto.randomUUID(),
      });
      return resultado;
    });
    return { success: true, data: atualizado } as const;
  } catch (error) {
    if (error instanceof PagamentoValidationError) {
      return { success: false, error: error.message } as const;
    }
    console.error("[ProgramarPagamento]", error);
    return { success: false, error: "Erro interno ao programar pagamento" } as const;
  }
}

const estornarPagamentoSchema = z.object({
  paymentId: z.string().min(1),
  motivo: z.string().trim().min(5, "Motivo do estorno é obrigatório"),
});

export async function EstornarPagamento(input: z.infer<typeof estornarPagamentoSchema>) {
  const acesso = await exigirAcesso("PAGAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = estornarPagamentoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const resultado = await db.$transaction(async (tx) => {
      const paymentOriginal = await tx.payment.findUnique({ where: { id: parsed.data.paymentId } });
      if (!paymentOriginal) throw new PagamentoValidationError("Pagamento não encontrado");
      if (paymentOriginal.tipo === "ESTORNO") {
        throw new PagamentoValidationError("Não é possível estornar um estorno");
      }
      const jaEstornado = await tx.payment.findFirst({
        where: { estornoDeId: paymentOriginal.id },
        select: { id: true },
      });
      if (jaEstornado) {
        throw new PagamentoValidationError("Este pagamento já foi estornado anteriormente");
      }

      const alocacaoOriginal = await tx.paymentAllocation.findFirst({
        where: { paymentId: paymentOriginal.id },
      });
      if (!alocacaoOriginal) {
        throw new PagamentoValidationError("Alocação original do pagamento não encontrada");
      }
      const entry = await tx.commissionEntry.findUnique({
        where: { id: alocacaoOriginal.entryId },
        include: { alocacoes: { select: { valorCents: true } } },
      });
      if (!entry) throw new PagamentoValidationError("Lançamento associado não encontrado");

      const estorno = await tx.payment.create({
        data: {
          data: new Date(),
          valorCents: -alocacaoOriginal.valorCents,
          meio: paymentOriginal.meio,
          observacao: parsed.data.motivo,
          usuarioResponsavelId: acesso.userId,
          tipo: "ESTORNO",
          estornoDeId: paymentOriginal.id,
        },
      });
      await tx.paymentAllocation.create({
        data: {
          paymentId: estorno.id,
          entryId: entry.id,
          valorCents: -alocacaoOriginal.valorCents,
        },
      });

      const saldoPago = calcularSaldo(entry.alocacoes) - alocacaoOriginal.valorCents;
      const novoStatus = saldoPago <= 0 ? "Pendente" : "ParcialmentePago";
      const entryAtualizado = await tx.commissionEntry.update({
        where: { id: entry.id },
        data: { status: novoStatus, actualPaymentDate: saldoPago <= 0 ? null : entry.actualPaymentDate },
      });
      await registrarAuditoria(tx, {
        userId: acesso.userId,
        acao: "ESTORNAR_PAGAMENTO",
        entityId: entry.id,
        before: { status: entry.status, paymentId: paymentOriginal.id },
        after: { status: novoStatus, estornoId: estorno.id, saldoPagoCents: saldoPago },
        correlationId: crypto.randomUUID(),
      });

      return { estorno, entry: entryAtualizado, saldoPago };
    });

    return { success: true, data: resultado } as const;
  } catch (error) {
    if (error instanceof PagamentoValidationError) {
      return { success: false, error: error.message } as const;
    }
    console.error("[EstornarPagamento]", error);
    return { success: false, error: "Erro interno ao estornar pagamento" } as const;
  }
}
