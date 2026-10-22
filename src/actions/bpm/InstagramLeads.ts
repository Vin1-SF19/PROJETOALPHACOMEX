"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { cnpjEhValido, normalizarCNPJ } from "@/lib/format-cnpj";
import { etapaIdCardSchema } from "@/lib/validations/bpm";
import { gerarTelefonePendente } from "@/lib/validations/cs-nps";
import { exigirAcessoBpmCard, exigirAcessoBpmPipeline, usuarioElegivelResponsavelBpm } from "@/lib/bpm/ownership";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";
import { carregarSnapshotsCopiaCamposCard, verificarTransicaoPermitidaBpm } from "@/lib/bpm/requisitos-etapa-server";
import { lerLeadInstagram } from "@/lib/bpm/instagram-leads";
import { carregarEndpointInstagram, etapaEntradaInstagram } from "@/lib/bpm/instagram-leads-server";
import { publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";
import { enfileirarAutomacoesCriacaoCardBpm } from "@/lib/bpm/automacoes/fila";
import { criarSlaInstancia } from "@/lib/bpm/sla";
import { ativarCadenciasNaEntradaBpm } from "@/lib/bpm/cadencias/ativacao-automatica";
import { processarCadenciasImediatasDoCardBpm } from "@/lib/bpm/cadencias/executor";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { notificarPendenciasLeadsBpm } from "@/lib/bpm/notificacoes-leads-server";

const schema = z.object({
  leadId: z.string().cuid(), etapaDestinoId: etapaIdCardSchema, responsavelId: z.number().int().positive(),
  cnpj: z.string().trim().optional(), radarPretendido: z.string().trim().max(120).optional(),
  qualificacao: z.enum(["Qualificado", "Sem qualificação"]).optional(),
}).strict();

/** A entrada Instagram é independente do NoLoss; só a assunção cria o agregado. */
export async function AssumirLeadInstagram(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos para assumir o lead." };
  const userId = Number(session.user.id);
  try {
    const resultado = await db.$transaction(async (tx) => {
      const endpoint = await carregarEndpointInstagram(tx);
      if (!endpoint?.pipelineId) throw new Error("Integração Instagram indisponível.");
      const pipelineId = endpoint.pipelineId;
      await exigirAcessoBpmPipeline(pipelineId, userId, tx);
      const entrada = await tx.bpmWebhookEntrada.findFirst({
        where: { id: parsed.data.leadId, endpointId: endpoint.id },
        select: { id: true, statusRecebimento: true, payloadSanitizadoJson: true, evento: { select: { cardId: true } } },
      });
      if (entrada?.statusRecebimento === "PROCESSADO" && entrada.evento?.cardId) {
        await exigirAcessoBpmCard(entrada.evento.cardId, userId, session.user.role ?? null, "visualizar");
        return { cardId: entrada.evento.cardId, pipelineId, duplicate: true };
      }
      if (!entrada || entrada.statusRecebimento !== "AUTENTICADO") throw new Error("Lead não encontrado ou já assumido.");
      const dados = lerLeadInstagram(entrada.payloadSanitizadoJson);
      if (!dados) throw new Error("Dados do lead indisponíveis. Contate o administrador.");
      const origem = await etapaEntradaInstagram(pipelineId, tx);
      const [destino, usuario] = await Promise.all([
        tx.bpmEtapa.findFirst({ where: { id: parsed.data.etapaDestinoId, pipelineId, ativo: true },
          select: { id: true, nome: true, visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } } } }),
        tx.usuarios.findUnique({ where: { id: userId }, select: { role: true } }),
      ]);
      if (!usuario || !destino || !resolverVisibilidadeEtapa(usuario.role, origem.visibilidades).podeAgir
        || !resolverVisibilidadeEtapa(usuario.role, destino.visibilidades).podeAgir) throw new Error("Seu perfil não pode assumir o lead nesta etapa.");
      if (destino.id !== origem.id) {
        if (!["agendar reunião", "stand by", "standby", "standby - follow up", "stand-by — follow-up semanal"].includes(destino.nome.trim().toLocaleLowerCase("pt-BR"))
          || !(await verificarTransicaoPermitidaBpm(origem.id, destino.id, "MANUAL", tx)).permitida) throw new Error("Transição de Novo Lead não permitida.");
      }
      if (!await usuarioElegivelResponsavelBpm(pipelineId, parsed.data.responsavelId, tx)) throw new Error("Responsável inválido para este pipeline.");
      const cnpjInformado = parsed.data.cnpj ?? dados.cnpj;
      if (cnpjInformado && !cnpjEhValido(cnpjInformado)) throw new Error("Confira um CNPJ válido ou deixe o campo vazio.");
      const cnpj = cnpjInformado ? normalizarCNPJ(cnpjInformado) : null;
      const radar = parsed.data.radarPretendido || dados.radarPretendido;
      const campos = await tx.bpmCampo.findMany({
        where: { pipelineId, ativo: true, nome: { in: ["Radar pretendido", "Canal de origem", "Qualificação"] },
          etapaConfiguracoes: { some: { etapaId: origem.id, visivel: true } } },
        select: { id: true, nome: true, tipo: true, opcoesJson: true, opcoes: { where: { ativo: true }, select: { rotulo: true } } },
      });
      const campoRadar = campos.find((c) => c.nome === "Radar pretendido");
      const campoCanal = campos.find((c) => c.nome === "Canal de origem");
      let opcoes: unknown = [];
      try { opcoes = campoRadar?.opcoes.length ? campoRadar.opcoes.map((o) => o.rotulo) : JSON.parse(campoRadar?.opcoesJson ?? "[]"); } catch { /* configuração inválida bloqueia abaixo */ }
      if (!radar || campoRadar?.tipo !== "selecao" || !Array.isArray(opcoes) || !opcoes.includes(radar)) throw new Error("Selecione um Radar pretendido válido antes de assumir.");
      if (!campoCanal || campoCanal.tipo !== "texto") throw new Error("Configure Canal de origem como texto no Novo Lead.");
      const campoQualificacao = campos.find((c) => c.nome === "Qualificação");
      if (parsed.data.qualificacao && !campoQualificacao) throw new Error("Configure o campo Qualificação no Novo Lead.");

      // A reserva e todos os efeitos vivem na mesma transação: rollback libera o lead.
      const reservado = await tx.bpmWebhookEntrada.updateMany({ where: { id: entrada.id, endpointId: endpoint.id,
        statusRecebimento: "AUTENTICADO", eventoId: null }, data: { statusRecebimento: "PROCESSADO" } });
      if (reservado.count !== 1) throw new Error("Este lead já foi assumido. Atualize o quadro.");
      const empresa = (cnpj ? await tx.cliente.findUnique({ where: { cnpj }, select: { id: true } }) : null)
        ?? await tx.cliente.create({ data: { cnpj, razaoSocial: dados.nome, status: "ATIVO" }, select: { id: true } });
      const pessoa = dados.telefone
        ? await tx.pessoa.upsert({ where: { celular: dados.telefone }, create: { celular: dados.telefone, nome: dados.nome, email: dados.email }, update: {}, select: { id: true } })
        : await tx.pessoa.create({ data: { celular: gerarTelefonePendente(), nome: dados.nome, email: dados.email }, select: { id: true } });
      await tx.pessoaClienteVinculo.upsert({ where: { pessoaId_clienteId: { pessoaId: pessoa.id, clienteId: empresa.id } },
        create: { pessoaId: pessoa.id, clienteId: empresa.id, ativo: true }, update: { ativo: true } });
      const card = await tx.bpmCard.create({ data: { empresaId: empresa.id, pipelineId, etapaId: destino.id,
        responsavelId: parsed.data.responsavelId, servico: "Revisão de Radar", status: "ATIVO" }, select: { id: true, createdAt: true } });
      await tx.bpmCardMembro.create({ data: { cardId: card.id, userId: parsed.data.responsavelId, role: "RESPONSAVEL" } });
      await tx.bpmCardCampoValor.create({ data: { cardId: card.id, campoId: campoRadar.id, valor: radar } });
      await tx.bpmCardCampoValor.create({ data: { cardId: card.id, campoId: campoCanal.id, valor: "Instagram" } });
      if (parsed.data.qualificacao && campoQualificacao) await tx.bpmCardCampoValor.create({ data: {
        cardId: card.id, campoId: campoQualificacao.id, valor: parsed.data.qualificacao } });
      const snapshots = await carregarSnapshotsCopiaCamposCard(card.id, pipelineId, destino.id, tx);
      for (const [campoId, valor] of Object.entries(snapshots)) await tx.bpmCardCampoValor.upsert({
        where: { cardId_campoId: { cardId: card.id, campoId } }, create: { cardId: card.id, campoId, valor }, update: {} });
      await tx.bpmCardHistorico.create({ data: { cardId: card.id, acao: "CARD_CRIADO", usuarioId: userId,
        valorNovoJson: JSON.stringify({ empresaId: empresa.id, pipelineId, etapaId: destino.id, responsavelId: parsed.data.responsavelId, origem: "INSTAGRAM", leadId: entrada.id }) } });
      const evento = await publicarEventoBpm({ tipo: "CARD_CRIADO", entidadeTipo: "CARD", entidadeId: card.id,
        cardId: card.id, pipelineId, valorNovo: { etapaId: destino.id, responsavelId: parsed.data.responsavelId, origem: "INSTAGRAM" },
        atorTipo: "USUARIO", atorUserId: userId, correlationId: randomUUID(), idempotencyKey: `instagram-assumido:${entrada.id}` }, tx);
      if (!evento) throw new Error("Não foi possível registrar o evento de criação.");
      await tx.bpmWebhookEntrada.update({ where: { id: entrada.id }, data: { eventoId: evento.id } });
      await enfileirarAutomacoesCriacaoCardBpm({ cardId: card.id, pipelineId, etapaId: destino.id }, tx);
      await criarSlaInstancia({ cardId: card.id }, "CRIACAO_CARD", tx, card.createdAt);
      await criarSlaInstancia({ cardId: card.id }, "ENTRADA_ETAPA", tx, card.createdAt);
      await ativarCadenciasNaEntradaBpm({ cardId: card.id, pipelineAnteriorId: null, etapaAnteriorId: null,
        pipelineDestinoId: pipelineId, etapaDestinoId: destino.id, evento: "CARD_CRIADO", usuarioId: userId, agora: card.createdAt }, tx);
      return { cardId: card.id, pipelineId, duplicate: false };
    });
    if (!resultado.duplicate) {
      await notificarPendenciasLeadsBpm({ pipelineId: resultado.pipelineId });
      await notificarPipelineBpm({ pipelineId: resultado.pipelineId, cardId: resultado.cardId, tipo: "CARD_CRIADO" });
      try { await processarCadenciasImediatasDoCardBpm(resultado.cardId); }
      catch { console.error("[InstagramLeads] Cadência imediata pendente de processamento"); }
    }
    return { success: true as const, data: { cardId: resultado.cardId } };
  } catch (error) {
    // Mensagens de domínio são controladas; não devolver mensagens do banco/PII.
    const mensagem = error instanceof Error ? error.message : "";
    const dominio = /^(Não autorizado|Integração Instagram|Lead não encontrado|Dados do lead|Seu perfil|Transição de Novo Lead|Responsável inválido|Confira um CNPJ|Selecione um Radar|Configure |Este lead já foi|Não foi possível registrar)/.test(mensagem);
    return { success: false as const, error: dominio ? mensagem : "Não foi possível assumir o lead. Atualize o quadro e tente novamente." };
  }
}
