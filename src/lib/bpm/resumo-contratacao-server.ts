import "server-only";

import db from "@/lib/prisma";
import { carregarValoresCanonicosCampos } from "@/lib/bpm/campos-configuraveis-server";

const CAMPOS = [
  ["Contato", "alpha.contato.responsavel.representante"],
  ["E-mail", "alpha.e.mail"],
  ["Serviço contratado", "alpha.servico.contratado"],
  ["Data da assinatura", "alpha.data.da.assinatura"],
  ["Valor contratado", "alpha.valor.acordado.no.contrato"],
  ["Valor líquido", "alpha.financeiro.valor.liquido.pagamento"],
  ["Forma de pagamento", "alpha.forma.de.pagamento"],
  ["Pagamento realizado", "alpha.pagamento.confirmado"],
  ["Data do pagamento", "alpha.data.do.pagamento"],
  ["NF emitida", "alpha.nf.emitida"],
  ["Data de emissão da NF", "alpha.data.de.emissao"],
  ["Número da NF", "alpha.numero.da.nf"],
  ["Link da NF", "alpha.arquivo.link.da.nf"],
  ["Vendedor responsável", "alpha.vendedor.a"],
  ["Parceiro", "alpha.parceiro.responsavel"],
  ["Origem", "alpha.canal.origem.do.cliente"],
  ["Observações comerciais", "alpha.observacoes.comerciais"],
] as const;

/** Projeção de leitura pelo vínculo explícito; os documentos seguem na origem. */
export async function carregarResumoContratacao(financeiroCardId: string) {
  const card = await db.bpmCard.findFirst({
    where: { id: financeiroCardId, pipeline: { chave: "financeiro" } },
    select: {
      id: true, empresa: { select: { cnpj: true, razaoSocial: true } }, concluidoEm: true,
      campoValores: { select: { campoId: true, valor: true } },
      anexos: { select: { id: true, nome: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      historico: { select: { id: true, acao: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 },
      vinculosOrigem: { where: { cardDestino: { pipeline: { chave: "operacional" }, status: { not: "ARQUIVADO" } } },
        select: { cardDestinoId: true }, take: 1 },
      vinculosDestino: { where: { cardOrigem: { pipeline: { chave: "comercial" } } }, select: {
        cardOrigem: { select: {
          id: true, campoValores: { select: { campoId: true, valor: true } },
          anexos: { select: { id: true, nome: true, createdAt: true }, orderBy: { createdAt: "desc" } },
          historico: { select: { id: true, acao: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 },
        } },
      }, take: 1 },
    },
  });
  if (!card) return null;
  const campos = await db.bpmCampo.findMany({
    where: { chave: { in: CAMPOS.map((item) => item[1]) }, ativo: true },
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
  const anexoContratoId = await db.bpmCampo.findFirst({
    where: { chave: "alpha.contrato.assinado.anexo", ativo: true }, select: { id: true },
  }).then((campo) => campo ? persistidos.get(campo.id) : null);
  const contratoAssinado = Boolean(anexoContratoId && card.anexos.some((anexo) => anexo.id === anexoContratoId));
  const falhaLiberacao = await db.bpmAutomacaoExecucao.findFirst({
    where: { cardId: card.id, automacao: { chave: "financeiro.handoff.contrato.concluido.operacional" }, status: "FALHA" },
    orderBy: { iniciadoEm: "desc" }, select: { mensagemErro: true },
  });

  return {
    financeiroCardId: card.id,
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
