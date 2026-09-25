import "server-only";

import type { Prisma } from "@prisma/client";

import { avaliarElaboracaoContrato, calcularNovoContratoFinanceiro, FINANCIAL_FIELD_KEYS } from "@/lib/bpm/pipeline-financeiro";
import { carregarValoresCanonicosCampos } from "@/lib/bpm/campos-configuraveis-server";

const TAREFA_ACOMPANHAR_ASSINATURA = "Acompanhar assinatura do contrato";
const TAREFA_REVISAR_CONTRATO = "Verificar atualização do contrato";

/** Persiste os efeitos da elaboração no mesmo commit do salvamento do formulário. */
export async function atualizarElaboracaoContrato(
  tx: Prisma.TransactionClient,
  cardId: string,
  pipelineId: string,
  camposAlterados: readonly string[],
): Promise<void> {
  const k = FINANCIAL_FIELD_KEYS;
  const campos = await tx.bpmCampo.findMany({
    where: {
      ativo: true, chave: { in: [...new Set(Object.values(k))] },
      OR: [{ pipelineId }, { pipelinesAssociados: { some: { pipelineId } } }],
    },
    select: { id: true, nome: true, chave: true, escopo: true, fonteEntidade: true, fonteAtributo: true, entidadeGlobal: true },
  });
  const porChave = new Map(campos.flatMap((campo) => campo.chave ? [[campo.chave, campo] as const] : []));
  const [salvos, canonicos, card, anexos] = await Promise.all([
    tx.bpmCardCampoValor.findMany({ where: { cardId, campoId: { in: campos.map((campo) => campo.id) } }, select: { campoId: true, valor: true } }),
    carregarValoresCanonicosCampos(cardId, campos, tx),
    tx.bpmCard.findUnique({ where: { id: cardId }, select: { responsavelId: true } }),
    tx.bpmCardAnexo.findMany({ where: { cardId }, select: { nome: true } }),
  ]);
  const valores: Record<string, string | null> = {};
  for (const campo of campos) if (campo.chave) valores[campo.chave] = canonicos[campo.id] ?? null;
  for (const salvo of salvos) {
    const chave = campos.find((campo) => campo.id === salvo.campoId)?.chave;
    if (chave && salvo.valor?.trim()) valores[chave] = salvo.valor;
  }
  const resultado = avaliarElaboracaoContrato(valores, new Date(), anexos.map((anexo) => anexo.nome));
  if (resultado.pendencias.length) {
    const nomes = resultado.pendencias.map((chave) => campos.find((campo) => campo.chave === chave)?.nome ?? chave);
    throw new Error(`CONTRATO_INVALIDO:Campos pendentes: ${nomes.join(", ")}.`);
  }
  for (const [chave, valor] of Object.entries(resultado.automaticValues)) {
    const campo = porChave.get(chave);
    if (!campo) throw new Error(`CONTRATO_INVALIDO:Campo configurado ausente: ${chave}.`);
    // O status assinado nunca deve retroceder por um salvamento posterior.
    if (chave === k.STATUS_ASSINATURA && valores[chave] === "Assinado") continue;
    await tx.bpmCardCampoValor.upsert({
      where: { cardId_campoId: { cardId, campoId: campo.id } },
      create: { cardId, campoId: campo.id, valor }, update: { valor },
    });
  }
  if (camposAlterados.includes(porChave.get(k.CONTRATO_ENVIADO)?.id ?? "")
    && (valores[k.CONTRATO_ENVIADO]?.toLowerCase() === "sim" || valores[k.CONTRATO_ENVIADO] === "true")) {
    const envioRegistrado = await tx.bpmCardHistorico.findFirst({
      where: { cardId, acao: "CONTRATO_ENVIADO_ASSINATURA" }, select: { id: true },
    });
    if (!envioRegistrado) await tx.bpmCardHistorico.create({ data: {
      cardId, acao: "CONTRATO_ENVIADO_ASSINATURA", automacaoOrigem: "financeiro_elaboracao_contrato",
      valorNovoJson: JSON.stringify({ enviadoEm: new Date().toISOString(), contrato: valores[k.LINK_CONTRATO] || "anexo do card" }),
    } });
  }
  if (valores[k.CONTRATO_ENVIADO]?.toLowerCase() === "sim" || valores[k.CONTRATO_ENVIADO] === "true") {
    const existente = await tx.bpmTarefa.findFirst({ where: { cardId, titulo: TAREFA_ACOMPANHAR_ASSINATURA }, select: { id: true } });
    if (!existente) await tx.bpmTarefa.create({ data: {
      cardId, titulo: TAREFA_ACOMPANHAR_ASSINATURA,
      descricao: "Confirmar a assinatura e atualizar o status do contrato no Financeiro.",
      responsavelId: card?.responsavelId, prioridade: "ALTA",
    } });
  }
  const relevantes = new Set<string>([k.CNPJ,k.RAZAO_SOCIAL,k.RUA,k.NUMERO,k.BAIRRO,k.CEP,k.MUNICIPIO,k.ESTADO,k.EMAIL,k.REGIME_CLIENTE,k.SERVICO,k.VALOR_BRUTO,k.FORMA_PAGAMENTO,k.CONDICAO]);
  const nomesAlterados = camposAlterados.flatMap((id) => {
    const campo = campos.find((item) => item.id === id);
    return campo?.chave && relevantes.has(campo.chave) ? [campo.nome] : [];
  });
  if (valores[k.CONTRATO_ELABORADO]?.toLowerCase() === "sim" && nomesAlterados.length) {
    const existente = await tx.bpmTarefa.findFirst({ where: { cardId, titulo: TAREFA_REVISAR_CONTRATO, status: "PENDENTE" }, select: { id: true } });
    if (!existente) await tx.bpmTarefa.create({ data: {
      cardId, titulo: TAREFA_REVISAR_CONTRATO,
      descricao: `Campos alterados após a elaboração: ${nomesAlterados.join(", ")}. Confira se o contrato precisa ser atualizado.`,
      responsavelId: card?.responsavelId, prioridade: "ALTA",
    } });
  }
}

/** Recalcula os campos derivados da primeira etapa após salvar entradas manuais. */
export async function atualizarCalculoNovoContrato(
  tx: Prisma.TransactionClient,
  cardId: string,
  pipelineId: string,
): Promise<void> {
  const campos = await tx.bpmCampo.findMany({
    where: {
      ativo: true,
      chave: { in: [...new Set(Object.values(FINANCIAL_FIELD_KEYS))] },
      OR: [
        { pipelineId },
        { pipelinesAssociados: { some: { pipelineId } } },
      ],
    },
    select: { id: true, chave: true, escopo: true, fonteEntidade: true, fonteAtributo: true, entidadeGlobal: true, opcoesJson: true, opcoes: { where: { ativo: true }, select: { rotulo: true } } },
  });
  const porChave = new Map(campos.flatMap((campo) => campo.chave ? [[campo.chave, campo] as const] : []));
  const [valores, canonicos] = await Promise.all([
    tx.bpmCardCampoValor.findMany({
      where: { cardId, campoId: { in: campos.map((campo) => campo.id) } },
      select: { campoId: true, valor: true },
    }),
    carregarValoresCanonicosCampos(cardId, campos, tx),
  ]);
  const chavePorId = new Map(campos.map((campo) => [campo.id, campo.chave]));
  const valoresPorChave = Object.fromEntries(Object.entries(canonicos).flatMap(([id, valor]) => {
    const chave = chavePorId.get(id);
    return chave ? [[chave, valor] as const] : [];
  }));
  for (const item of valores) {
    const chave = chavePorId.get(item.campoId);
    if (chave && item.valor?.trim()) valoresPorChave[chave] = item.valor;
  }
  const calculo = calcularNovoContratoFinanceiro(valoresPorChave);
  const k = FINANCIAL_FIELD_KEYS;
  const derivadas = [k.VALOR_IRRF, k.VALOR_CSRF, k.TOTAL_RETENCOES, k.VALOR_LIQUIDO, k.MEMORIA_CALCULO];
  for (const chave of derivadas) {
    const campo = porChave.get(chave);
    if (!campo) continue;
    const valor = calculo.automaticValues[chave] ?? null;
    await tx.bpmCardCampoValor.upsert({
      where: { cardId_campoId: { cardId, campoId: campo.id } },
      create: { cardId, campoId: campo.id, valor },
      update: { valor },
    });
  }
  const status = porChave.get(k.STATUS_FINANCEIRO);
  if (!status) return;
  const opcoes = status.opcoes.map((item) => item.rotulo);
  if (!opcoes.length && status.opcoesJson) {
    try {
      const parsed: unknown = JSON.parse(status.opcoesJson);
      if (Array.isArray(parsed)) opcoes.push(...parsed.filter((item): item is string => typeof item === "string"));
    } catch { /* configuração inválida não autoriza alterar o status */ }
  }
  if (!opcoes.includes("Aguardando pagamento")) return;
  const atual = valoresPorChave[k.STATUS_FINANCEIRO];
  const proximo = calculo.automaticValues[k.STATUS_FINANCEIRO];
  if (proximo && (!atual || atual === proximo)) {
    await tx.bpmCardCampoValor.upsert({
      where: { cardId_campoId: { cardId, campoId: status.id } },
      create: { cardId, campoId: status.id, valor: proximo },
      update: { valor: proximo },
    });
  } else if (!proximo && atual === "Aguardando pagamento") {
    await tx.bpmCardCampoValor.update({
      where: { cardId_campoId: { cardId, campoId: status.id } },
      data: { valor: null },
    });
  }
}
