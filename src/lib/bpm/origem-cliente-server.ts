import "server-only";
import type { Prisma } from "@prisma/client";
import { campoEhOrigemCliente, origemEhParceiro, type ParceiroOrigemBpm } from "@/lib/bpm/origem-cliente";

/** Clientes antigos também devem manter origem e indicação consistentes. */
export async function resolverParceiroOrigem(
  selecao: ParceiroOrigemBpm | undefined,
  campos: readonly { id: string; nome: string; chave?: string | null }[],
  valores: Record<string, string>,
  cardId: string,
  tx: Prisma.TransactionClient,
): Promise<ParceiroOrigemBpm | undefined> {
  const origens = campos.filter((campo) => campoEhOrigemCliente(campo) && Object.hasOwn(valores, campo.id));
  if (origens.some((campo) => origemEhParceiro(valores[campo.id]) !== origemEhParceiro(valores[origens[0].id]))) {
    throw new Error("CAMPO_INVALIDO:Informe a mesma origem nos campos do card.");
  }
  if (selecao || !origens.length) return selecao;
  const campo = origens[0];
  if (!origemEhParceiro(valores[campo.id])) return { campoId: campo.id, parceiroId: null };
  const indicacao = await tx.indicacao.findUnique({ where: { bpmCardId: cardId }, select: { parceiroId: true, status: true } });
  return { campoId: campo.id, parceiroId: indicacao?.status === "ATIVA" ? indicacao.parceiroId : await parceiroDaNegociacaoVinculada(cardId, tx) };
}

/** Apenas leitura: pode ser usada na prévia de transição. Campos já devem estar autorizados. */
export async function validarParceiroOrigem(
  selecao: ParceiroOrigemBpm | undefined,
  campos: readonly { id: string; nome: string; chave?: string | null; editavel?: boolean; somenteLeitura?: boolean }[],
  valores: Record<string, string>,
  tx: Prisma.TransactionClient,
) {
  if (!selecao) return undefined;
  const campo = campos.find((item) => item.id === selecao.campoId);
  if (!campo || !campoEhOrigemCliente(campo) || campo.editavel === false || campo.somenteLeitura
    || !Object.hasOwn(valores, campo.id)) throw new Error("CAMPO_INVALIDO:Origem do cliente não disponível para edição.");
  const ehParceiro = origemEhParceiro(valores[campo.id]);
  if (ehParceiro !== (selecao.parceiroId !== null)) {
    throw new Error("CAMPO_INVALIDO:Selecione o parceiro que indicou ou ajuste a origem.");
  }
  if (selecao.parceiroId === null) return null;
  const parceiro = await tx.parceiro.findUnique({ where: { id: selecao.parceiroId },
    select: { id: true, nome: true, nomeFantasia: true, documento: true, email: true, telefone: true, segmento: true, ativo: true } });
  if (!parceiro) throw new Error("CAMPO_INVALIDO:Parceiro não encontrado. Selecione novamente.");
  return parceiro;
}

/** Executada somente dentro da transação de gravação, depois das validações. */
export async function salvarParceiroOrigem(
  selecao: ParceiroOrigemBpm | undefined,
  card: { id: string; empresaId: number; servico: string | null },
  usuarioId: number | null,
  tx: Prisma.TransactionClient,
) {
  if (!selecao) return;
  const anterior = await tx.indicacao.findUnique({ where: { bpmCardId: card.id }, select: { id: true, parceiroId: true, status: true } });
  if (!anterior && selecao.parceiroId === null || anterior?.parceiroId === selecao.parceiroId && anterior.status === "ATIVA") return;
  if (selecao.parceiroId !== null && !usuarioId) throw new Error("CAMPO_INVALIDO:Usuário obrigatório para selecionar parceiro.");
  if (!anterior && selecao.parceiroId !== null) {
    const herdado = await parceiroDaNegociacaoVinculada(card.id, tx);
    if (herdado === selecao.parceiroId) return; // No duplicated referral/commission on Finance/Operations cards.
    if (herdado !== null) throw new Error("CAMPO_INVALIDO:Altere o parceiro no card comercial de origem da negociação.");
  }
  if (anterior) await tx.indicacao.update({ where: { id: anterior.id }, data: { bpmCardId: null, status: "DESVINCULADA" } });
  if (selecao.parceiroId !== null) {
    await tx.indicacao.create({ data: { bpmCardId: card.id, clienteId: card.empresaId, parceiroId: selecao.parceiroId,
      criadoPorId: usuarioId!, servicoIndicado: card.servico } });
  }
  await tx.bpmCardHistorico.create({ data: { cardId: card.id, acao: "CARD_ATUALIZADO", usuarioId,
    valorAnteriorJson: JSON.stringify({ parceiroOrigemId: anterior?.parceiroId ?? null }),
    valorNovoJson: JSON.stringify({ parceiroOrigemId: selecao.parceiroId }) } });
}

/** Resolve aliases of origin only within this negotiation. Conflicting legacy aliases remain explicit. */
export async function carregarOrigemMesmoCard(
  cardId: string,
  client: Pick<Prisma.TransactionClient, "bpmCardCampoValor">,
): Promise<string | null> {
  const valores = await client.bpmCardCampoValor.findMany({ where: { cardId, campo: { ativo: true } },
    select: { campoId: true, valor: true, campo: { select: { nome: true, chave: true } } } });
  const origens = [...new Set(valores.filter((item) => item.campo && campoEhOrigemCliente(item.campo))
    .map((item) => item.valor?.trim()).filter((valor): valor is string => Boolean(valor)))];
  return origens.length === 1 ? origens[0] : null;
}

async function parceiroDaNegociacaoVinculada(cardId: string, tx: Prisma.TransactionClient): Promise<number | null> {
  const card = await tx.bpmCard.findUnique({ where: { id: cardId }, select: { empresaId: true,
    vinculosDestino: { select: { cardOrigem: { select: { empresaId: true,
      indicacaoOrigem: { select: { parceiroId: true, status: true } } } } } } } });
  if (!card) return null;
  const ids = [...new Set(card.vinculosDestino.filter((vinculo) => vinculo.cardOrigem.empresaId === card.empresaId
    && vinculo.cardOrigem.indicacaoOrigem?.status === "ATIVA")
    .flatMap((vinculo) => vinculo.cardOrigem.indicacaoOrigem ? [vinculo.cardOrigem.indicacaoOrigem.parceiroId] : []))];
  return ids.length === 1 ? ids[0] : null;
}
