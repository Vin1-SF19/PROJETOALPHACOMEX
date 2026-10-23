import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { cnpjEhValido, normalizarCNPJ } from "@/lib/format-cnpj";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { exigirCompatibilidadeMasterDossie } from "@/lib/bpm/checklist-documental";
import { carregarDadosEmpresaCard } from "@/lib/bpm/dados-empresa-server";
import { publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";
import { ACAO_VINCULO_EMPRESA, type PropostaVinculoEmpresa } from "./cnpj-empresa-vinculo";

type Usuario = { id: number; role: string | null };
type InputProposta = { cardId: string; cnpj: string; modo: PropostaVinculoEmpresa["modo"] };
export class ErroVinculoEmpresa extends Error {
  constructor(message: string, public readonly code = "VINCULO_EMPRESA_INDISPONIVEL") { super(message); }
}
const CONFLITO = "O card ou o cadastro da empresa mudou. Recarregue os dados e confirme o vínculo novamente.";

async function validarVinculos(tx: Prisma.TransactionClient, cardId: string, destinoId: number) {
  try { await exigirCompatibilidadeMasterDossie(tx, cardId, destinoId); }
  catch (error) {
    if (error instanceof Error && error.message === "Desvincule o dossiê antes de trocar a empresa do card.") throw new ErroVinculoEmpresa(error.message);
    throw error;
  }
  const [contexto, indicacao, vinculos] = await Promise.all([
    tx.bpmCardServicoContexto.findUnique({ where: { cardId }, select: {
      clienteServico: { select: { clienteId: true } }, contratoComercial: { select: { clienteId: true } },
    } }),
    tx.indicacao.findUnique({ where: { bpmCardId: cardId }, select: { clienteId: true } }),
    tx.bpmCardVinculo.findMany({ where: { OR: [{ cardOrigemId: cardId }, { cardDestinoId: cardId }] },
      select: { cardOrigemId: true, cardDestinoId: true, cardOrigem: { select: { empresaId: true } }, cardDestino: { select: { empresaId: true } } } }),
  ]);
  if (contexto && (contexto.clienteServico && contexto.clienteServico.clienteId !== destinoId
    || contexto.contratoComercial && contexto.contratoComercial.clienteId !== destinoId)) {
    throw new ErroVinculoEmpresa("Este card possui serviço ou contrato de outra empresa. Revise esse vínculo antes de trocar a empresa.");
  }
  if (indicacao && indicacao.clienteId !== destinoId) throw new ErroVinculoEmpresa("Este card possui uma indicação de parceiro vinculada à empresa atual. Revise a indicação antes de trocar a empresa.");
  if (vinculos.some(v => (v.cardOrigemId === cardId ? v.cardDestino.empresaId : v.cardOrigem.empresaId) !== destinoId)) {
    throw new ErroVinculoEmpresa("Este card já está ligado a outro processo da empresa atual. Revise os encaminhamentos antes de trocar a empresa.");
  }
}

/** Snapshot é controle de concorrência, não credencial: toda confirmação revalida a sessão e os vínculos. */
export async function proporVinculoEmpresaPorCnpj(input: InputProposta, usuario: Usuario, tx: Prisma.TransactionClient = db): Promise<PropostaVinculoEmpresa | null> {
  const cnpj = normalizarCNPJ(input.cnpj);
  if (!cnpjEhValido(cnpj)) return null;
  const destino = await tx.cliente.findUnique({ where: { cnpj }, select: { id: true, cnpj: true, razaoSocial: true, status: true, updatedAt: true } });
  if (!destino) return null;
  await exigirAcessoBpmCard(input.cardId, usuario.id, usuario.role, "editarCard", tx);
  const card = await tx.bpmCard.findUnique({ where: { id: input.cardId }, select: {
    id: true, empresaId: true, versao: true, updatedAt: true, status: true,
    empresa: { select: { id: true, cnpj: true, razaoSocial: true, updatedAt: true } },
    pipeline: { select: { nome: true } },
    nolossLeadOrigem: { select: { id: true, promotedClienteId: true } },
  } });
  if (!card || card.status === "ARQUIVADO") throw new ErroVinculoEmpresa("Card indisponível para vincular empresa.");
  if (destino.id === card.empresaId || normalizarCNPJ(card.empresa.cnpj ?? "") === cnpj) return null;
  if (destino.status !== "ATIVO") throw new ErroVinculoEmpresa("A empresa cadastrada está arquivada. Reative o cadastro antes de vincular este card.");
  if (input.modo === "NOLOSS" && (card.pipeline.nome !== "Revisão de Radar" || !card.nolossLeadOrigem.length || card.empresa.cnpj)) {
    throw new ErroVinculoEmpresa("Este card não possui CNPJ pendente de origem NoLoss.");
  }
  if (card.nolossLeadOrigem.some(lead => lead.promotedClienteId !== card.empresaId)) throw new ErroVinculoEmpresa("A origem NoLoss deste card precisa de revisão de integridade antes de alterar a empresa.");
  await validarVinculos(tx, card.id, destino.id);
  const base = { versao: 1 as const, modo: input.modo, cardId: card.id, empresaOrigemId: card.empresaId,
    empresaDestinoId: destino.id, cnpj, empresaOrigemNome: card.empresa.razaoSocial, empresaDestinoNome: destino.razaoSocial,
    versaoCardEsperada: card.versao, atualizadoCardEsperado: card.updatedAt.toISOString(),
    atualizadoOrigemEsperado: card.empresa.updatedAt.toISOString(), atualizadoDestinoEsperado: destino.updatedAt.toISOString() };
  return { ...base, snapshot: createHash("sha256").update(JSON.stringify(base)).digest("hex") };
}

/** Comando de vínculo de um card; nenhum cadastro ou contato empresarial é mesclado. */
export async function confirmarVinculoEmpresaNoCard(proposta: PropostaVinculoEmpresa, usuario: Usuario, tx: Prisma.TransactionClient) {
  await exigirAcessoBpmCard(proposta.cardId, usuario.id, usuario.role, "editarCard", tx);
  const card = await tx.bpmCard.findUnique({ where: { id: proposta.cardId }, select: { empresaId: true, pipelineId: true } });
  if (!card) throw new ErroVinculoEmpresa("Card não encontrado.");
  if (card.empresaId === proposta.empresaDestinoId) {
    const anterior = await tx.bpmCardHistorico.findFirst({ where: { cardId: proposta.cardId, acao: ACAO_VINCULO_EMPRESA, usuarioId: usuario.id,
      valorNovoJson: { contains: `"snapshot":"${proposta.snapshot}"` } }, select: { id: true } });
    if (!anterior) throw new ErroVinculoEmpresa(CONFLITO, "VINCULO_EMPRESA_CONFLITO");
    const dados = await carregarDadosEmpresaCard(proposta.cardId, tx);
    if (!dados) throw new ErroVinculoEmpresa("Card não encontrado.");
    return { dados, pipelineId: card.pipelineId, idempotente: true };
  }
  const atual = await proporVinculoEmpresaPorCnpj({ cardId: proposta.cardId, cnpj: proposta.cnpj, modo: proposta.modo }, usuario, tx);
  if (!atual || JSON.stringify(atual) !== JSON.stringify(proposta)) throw new ErroVinculoEmpresa(CONFLITO, "VINCULO_EMPRESA_CONFLITO");
  const agora = new Date(Math.max(Date.now(), Date.parse(proposta.atualizadoCardEsperado) + 1));
  const alterado = await tx.bpmCard.updateMany({ where: { id: proposta.cardId, empresaId: proposta.empresaOrigemId,
    versao: proposta.versaoCardEsperada, updatedAt: new Date(proposta.atualizadoCardEsperado) },
    data: { empresaId: proposta.empresaDestinoId, versao: { increment: 1 }, updatedAt: agora } });
  if (alterado.count !== 1) throw new ErroVinculoEmpresa(CONFLITO, "VINCULO_EMPRESA_CONFLITO");
  // Referência corrente necessária ao redirect NoLoss; os dados e a promoção original permanecem intactos.
  const referencias = await tx.nolossLead.findMany({ where: { promotedCardId: proposta.cardId }, select: { id: true, promotedClienteId: true } });
  if (referencias.some(lead => lead.promotedClienteId !== proposta.empresaOrigemId)) throw new ErroVinculoEmpresa(CONFLITO, "VINCULO_EMPRESA_CONFLITO");
  await tx.nolossLead.updateMany({ where: { promotedCardId: proposta.cardId, promotedClienteId: proposta.empresaOrigemId },
    data: { promotedClienteId: proposta.empresaDestinoId } });
  const autor = await tx.usuarios.findUniqueOrThrow({ where: { id: usuario.id }, select: { nome: true } });
  const historico = await tx.bpmCardHistorico.create({ data: { cardId: proposta.cardId, usuarioId: usuario.id, acao: ACAO_VINCULO_EMPRESA,
    valorAnteriorJson: JSON.stringify({ empresaId: proposta.empresaOrigemId, nome: proposta.empresaOrigemNome,
      referenciasNoLoss: referencias.map(lead => ({ id: lead.id, empresaId: lead.promotedClienteId })) }),
    valorNovoJson: JSON.stringify({ empresaId: proposta.empresaDestinoId, nome: proposta.empresaDestinoNome, cnpj: proposta.cnpj,
      modo: proposta.modo, snapshot: proposta.snapshot, autor: autor.nome, rascunhoAplicado: false,
      referenciasNoLoss: referencias.map(lead => ({ id: lead.id, empresaId: proposta.empresaDestinoId })) }), createdAt: agora } });
  const evento = await publicarEventoBpm({ tipo: "CAMPO_ALTERADO", entidadeTipo: "CARD", entidadeId: proposta.cardId,
    cardId: proposta.cardId, pipelineId: card.pipelineId, atorTipo: "USUARIO", atorUserId: usuario.id,
    correlationId: proposta.snapshot, causationId: historico.id, idempotencyKey: `empresa-vinculo:${proposta.cardId}:${proposta.snapshot}`,
    valorAnterior: { campoId: "empresaId", valor: proposta.empresaOrigemId },
    valorNovo: { campoId: "empresaId", valor: proposta.empresaDestinoId, automacoesSuprimidas: true }, ocorridoEm: agora }, tx);
  if (!evento) throw new Error("Outbox de vínculo empresarial indisponível");
  const dados = await carregarDadosEmpresaCard(proposta.cardId, tx);
  if (!dados) throw new ErroVinculoEmpresa("Não foi possível recarregar os dados da empresa vinculada.");
  return { dados, pipelineId: card.pipelineId, idempotente: false };
}
