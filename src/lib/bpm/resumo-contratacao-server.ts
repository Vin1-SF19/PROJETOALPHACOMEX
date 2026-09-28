import "server-only";

import db from "@/lib/prisma";
import { carregarValoresCanonicosCampos } from "@/lib/bpm/campos-configuraveis-server";
import { PIPELINE_CHAVE, CHAVES_CAMPOS, VALORES } from "@/lib/bpm/financeiro-config";
import { extrairPathnamePrivadoAnexoBpm } from "@/lib/bpm/anexos-storage";
import { avaliarFormalizacaoFinanceira } from "@/lib/bpm/financeiro-formalizacao";

const CAMPOS = [
  ["Contato", CHAVES_CAMPOS.CONTATO_RESPONSAVEL],
  ["E-mail", CHAVES_CAMPOS.EMAIL],
  ["Serviço contratado", CHAVES_CAMPOS.SERVICO_CONTRATADO],
  ["Data da assinatura", CHAVES_CAMPOS.DATA_ASSINATURA],
  ["Valor contratado", CHAVES_CAMPOS.VALOR_CONTRATADO],
  ["Valor líquido", CHAVES_CAMPOS.VALOR_LIQUIDO],
  ["Forma de pagamento", CHAVES_CAMPOS.FORMA_PAGAMENTO],
  ["Pagamento realizado", CHAVES_CAMPOS.PAGAMENTO_CONFIRMADO],
  ["Data do pagamento", CHAVES_CAMPOS.DATA_PAGAMENTO],
  ["NF emitida", CHAVES_CAMPOS.NF_EMITIDA],
  ["Data de emissão da NF", CHAVES_CAMPOS.DATA_EMISSAO_NF],
  ["Número da NF", CHAVES_CAMPOS.NUMERO_NF],
  ["Link da NF", CHAVES_CAMPOS.LINK_NF],
  ["Vendedor responsável", CHAVES_CAMPOS.VENDEDOR_RESPONSAVEL],
  ["Parceiro", CHAVES_CAMPOS.PARCEIRO_RESPONSAVEL],
  ["Origem", CHAVES_CAMPOS.ORIGEM_CLIENTE],
  ["Observações comerciais", CHAVES_CAMPOS.OBSERVACOES_COMERCIAIS],
] as const;

/** Projeção de leitura pelo vínculo explícito; os documentos seguem na origem. */
export async function carregarResumoContratacao(financeiroCardId: string) {
  const card = await db.bpmCard.findFirst({
    where: { id: financeiroCardId, pipeline: { chave: PIPELINE_CHAVE } },
    select: {
      id: true, etapa: { select: { nome: true } }, empresa: { select: { cnpj: true, razaoSocial: true } }, concluidoEm: true,
      campoValores: { select: { campoId: true, valor: true } },
      anexos: { select: { id: true, nome: true, url: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      historico: { select: { id: true, acao: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 },
      vinculosOrigem: { where: { cardDestino: { pipeline: { chave: "operacional" }, status: { not: "ARQUIVADO" } } },
        select: { cardDestinoId: true }, take: 1 },
      vinculosDestino: { where: { cardOrigem: { pipeline: { OR: [{ chave: "comercial" }, { nome: "Revisão de Radar" }] } } }, select: {
        cardOrigem: { select: {
          id: true, campoValores: { select: { campoId: true, valor: true } },
          anexos: { select: { id: true, nome: true, url: true, createdAt: true }, orderBy: { createdAt: "desc" } },
          historico: { select: { id: true, acao: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 },
        } },
      }, take: 1 },
    },
  });
  if (!card) return null;
  const campos = await db.bpmCampo.findMany({
    where: { chave: { in: [...CAMPOS.map((item) => item[1]), CHAVES_CAMPOS.STATUS_ASSINATURA, CHAVES_CAMPOS.ANEXO_ASSINADO] }, ativo: true },
    select: { id: true, chave: true, escopo: true, fonteEntidade: true, fonteAtributo: true, entidadeGlobal: true },
  });
  const globais = await carregarValoresCanonicosCampos(card.id, campos);
  const persistidos = new Map(card.campoValores.map((item) => [item.campoId, item.valor]));
  const comercial = card.vinculosDestino[0]?.cardOrigem;
  const valoresComerciais = new Map(comercial?.campoValores.map((item) => [item.campoId, item.valor]) ?? []);
  const campoPorChave = new Map(campos.map((campo) => [campo.chave, campo]));
  const valor = (chave: string) => {
    const campo = campoPorChave.get(chave);
    if (!campo) return null;
    return persistidos.get(campo.id)?.trim() || globais[campo.id]?.trim()
      || valoresComerciais.get(campo.id)?.trim() || null;
  };
  const anexoContratoId = valor(CHAVES_CAMPOS.ANEXO_ASSINADO);
  const anexoPrivadoVinculado = Boolean(anexoContratoId && card.anexos.some((anexo) =>
    anexo.id === anexoContratoId && extrairPathnamePrivadoAnexoBpm(anexo.url)));
  const contratoAssinado = avaliarFormalizacaoFinanceira({
    statusAssinatura: valor(CHAVES_CAMPOS.STATUS_ASSINATURA),
    dataAssinatura: valor(CHAVES_CAMPOS.DATA_ASSINATURA),
    anexoAssinadoId: anexoContratoId,
    anexoAssinadoVinculado: anexoPrivadoVinculado,
    pagamentoConfirmado: valor(CHAVES_CAMPOS.PAGAMENTO_CONFIRMADO),
  }).contrato === VALORES.CONCLUIDO;
  const falhaLiberacao = await db.bpmAutomacaoExecucao.findFirst({
    where: { cardId: card.id, automacao: { chave: "financeiro.handoff.contrato.concluido.operacional" }, status: "FALHA" },
    orderBy: { iniciadoEm: "desc" }, select: { mensagemErro: true },
  });

  return {
    financeiroCardId: card.id,
    etapaFinanceira: card.etapa.nome,
    contratoAssinadoArquivadoNoCrm: contratoAssinado,
    operacionalCardId: card.vinculosOrigem[0]?.cardDestinoId ?? null,
    negociacaoId: comercial?.id ?? null,
    pendenciasOperacionais: falhaLiberacao?.mensagemErro?.includes("Campos obrigatórios:")
      ? falhaLiberacao.mensagemErro : null,
    campos: [
      { nome: "CNPJ", valor: card.empresa.cnpj ?? null },
      { nome: "Razão Social", valor: card.empresa.razaoSocial ?? null },
      { nome: "Contrato assinado", valor: contratoAssinado ? "Sim" : "Não" },
      ...CAMPOS.map(([nome, chave]) => ({ nome, valor: valor(chave) })),
      { nome: "Data de conclusão da contratação", valor: card.concluidoEm?.toISOString() ?? null },
    ],
    documentos: [...card.anexos, ...(comercial?.anexos ?? [])].map((anexo) => ({
      id: anexo.id, nome: anexo.nome, criadoEm: anexo.createdAt.toISOString(),
      url: `/api/bpm/anexos/${anexo.id}`,
    })),
    historico: [...card.historico, ...(comercial?.historico ?? [])]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((item) => ({ id: item.id, acao: item.acao, criadoEm: item.createdAt.toISOString() })),
  };
}
