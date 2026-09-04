import db from "@/lib/prisma";
import { gerarLancamentosParaEvento } from "@/lib/commissions/entry-generator";

function reaisParaCents(valor: string | null | undefined): number {
  const texto = valor?.trim();
  if (!texto) return 0;
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

function confirmado(valor: string | null | undefined): boolean {
  return ["sim", "true", "1", "confirmado"].includes(valor?.trim().toLowerCase() ?? "");
}

/** Sincroniza o pagamento confirmado do card com o domínio auditável de comissões. */
export async function sincronizarComissoesDoCardFinanceiro(cardId: string) {
  const card = await db.bpmCard.findUnique({
    where: { id: cardId },
    select: {
      id: true,
      responsavelId: true,
      updatedAt: true,
      servico: true,
      pipeline: { select: { nome: true } },
      empresa: {
        select: {
          id: true,
          cnpj: true,
          razaoSocial: true,
          nomeFantasia: true,
        },
      },
      campoValores: {
        select: { valor: true, campo: { select: { nome: true } } },
      },
    },
  });
  if (!card || card.pipeline.nome !== "Financeiro") return null;

  const valores = Object.fromEntries(
    card.campoValores.map((item) => [item.campo.nome, item.valor]),
  );
  if (!confirmado(valores["Pagamento confirmado"])) return null;
  if (!card.empresa.cnpj) throw new Error("CARD_FINANCEIRO_SEM_CNPJ");

  const bruto = reaisParaCents(valores["Valor bruto do contrato"]);
  const liquido = reaisParaCents(valores["Valor líquido para pagamento"]);
  if (bruto <= 0 || liquido <= 0) throw new Error("CARD_FINANCEIRO_SEM_VALORES_CALCULADOS");

  const servico = valores["Serviço contratado"]?.trim() || card.servico || "Não informado";
  const dataPagamento = valores["Data de pagamento"]
    ? new Date(`${valores["Data de pagamento"]}T12:00:00.000Z`)
    : new Date();
  const eventDate = Number.isNaN(dataPagamento.getTime()) ? new Date() : dataPagamento;

  const evento = await db.commissionEvent.upsert({
    where: {
      sourceSystem_sourceEntity_sourceId_eventType: {
        sourceSystem: "alpha-bpm",
        sourceEntity: "bpm-card-payment",
        sourceId: card.id,
        eventType: "CONTRACTING",
      },
    },
    update: {
      clienteId: card.empresa.id,
      cnpj: card.empresa.cnpj,
      razaoSocial: card.empresa.razaoSocial,
      nomeFantasia: card.empresa.nomeFantasia,
      servico,
      eventDate,
      grossContractAmountCents: bruto,
      netContractAmountCents: liquido,
      formaPagamento: valores["Forma de pagamento"] || null,
      closerUsuarioId: card.responsavelId,
      sourceUpdatedAt: card.updatedAt,
      lastSyncAt: new Date(),
      status: "OK",
      syncStatus: "SYNCED",
    },
    create: {
      eventType: "CONTRACTING",
      clienteId: card.empresa.id,
      cnpj: card.empresa.cnpj,
      razaoSocial: card.empresa.razaoSocial,
      nomeFantasia: card.empresa.nomeFantasia,
      servico,
      eventDate,
      grossContractAmountCents: bruto,
      netContractAmountCents: liquido,
      formaPagamento: valores["Forma de pagamento"] || null,
      closerUsuarioId: card.responsavelId,
      status: "OK",
      sourceSystem: "alpha-bpm",
      sourceEntity: "bpm-card-payment",
      sourceId: card.id,
      sourceUpdatedAt: card.updatedAt,
      lastSyncAt: new Date(),
      syncStatus: "SYNCED",
    },
  });

  const beneficiariosConfigurados = await db.commissionRule.findMany({
    where: {
      active: true,
      eventType: "CONTRACTING",
      collaboratorId: { not: null },
      OR: [{ servico: null }, { servico }],
      versoes: {
        some: {
          status: "PUBLISHED",
          validFrom: { lte: eventDate },
          OR: [{ validTo: null }, { validTo: { gte: eventDate } }],
        },
      },
    },
    select: { collaboratorId: true },
  });
  const collaboratorIds = [...new Set([
    card.responsavelId,
    ...beneficiariosConfigurados.flatMap((regra) =>
      regra.collaboratorId === null ? [] : [regra.collaboratorId]),
  ])];
  const lancamentos = await gerarLancamentosParaEvento({
    eventId: evento.id,
    collaboratorIds,
  });
  return { eventoId: evento.id, ...lancamentos };
}
