import "server-only";

import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { Resend } from "resend";
import { z } from "zod";

import db from "@/lib/prisma";
import { gerarFichaServer } from "@/lib/bibble/gerar-ficha-server";
import { gerarPdfDocumento } from "@/lib/gerador-documentos/pdf";
import { carregarContratoPadrao, qualificarContratadaContratoPadrao } from "@/lib/gerador-documentos/contrato-padrao";
import { valoresContratoParaConferencia } from "@/lib/gerador-documentos/contrato-conferencia";
import { CONTRATO_PADRAO_ID } from "@/lib/gerador-documentos/contrato-padrao-id";
import { renderizarConteudo } from "@/lib/gerador-documentos/render";
import { carregarValoresCanonicosCampos } from "@/lib/bpm/campos-configuraveis-server";
import { VariavelTemplateSchema } from "@/lib/gerador-documentos/schemas";
import {
  escaparHtmlAutomacaoBpm,
  renderizarPlaceholdersAutomacaoBpm,
} from "@/lib/bpm/automacoes/placeholders";
import {
  type AcaoAutomacaoBpm,
  type ParametrosContratoBpm,
  type ParametrosDistribuicaoBpm,
  type ParametrosEmailBpm,
  type ParametrosOportunidadeBpm,
  validarParametrosAutomacaoBpm,
} from "@/lib/bpm/automacoes/schemas";
import { montarFatoChecklistAutomacaoBpm } from "@/lib/bpm/checklists/integracao";
import { materializarChecklistsAplicaveisCard } from "@/lib/bpm/checklists/service";
import {
  executarDistribuicaoBpm,
  executarOportunidadeBpm,
} from "@/lib/bpm/automacoes/distribuicao-oportunidades";

const variaveisTemplateSchema = z.array(VariavelTemplateSchema).max(50);

function lerVariaveisTemplate(valor: unknown) {
  const normalizado = typeof valor === "string" ? JSON.parse(valor) : valor;
  return variaveisTemplateSchema.parse(normalizado);
}

type ContextoExecucao = {
  card: {
    id: string;
    pipelineId: string;
    etapaId: string;
    servico: string | null;
    tipoProcesso: string | null;
    responsavelId: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    concluidoEm: Date | null;
    primeiraVisualizacaoEm: Date | null;
    proximoContatoEm: Date | null;
    dataReuniao: Date | null;
    statusPosFechamento: string | null;
    empresaId: number;
    empresa: { razaoSocial: string; nomeFantasia: string | null; cnpj: string | null };
    responsavel: { nome: string };
    pipeline: { nome: string };
    etapa: { nome: string };
  };
  placeholders: Record<string, string>;
};

async function montarContexto(card: ContextoExecucao["card"]): Promise<ContextoExecucao> {
  const fatoChecklist = await montarFatoChecklistAutomacaoBpm({
    id: card.id,
    pipelineId: card.pipelineId,
    etapaId: card.etapaId,
  });
  return {
    card,
    placeholders: {
      "card.id": card.id,
      "card.servico": card.servico ?? "",
      "empresa.razaoSocial": card.empresa.razaoSocial,
      "empresa.nomeFantasia": card.empresa.nomeFantasia ?? "",
      "empresa.cnpj": card.empresa.cnpj ?? "",
      "responsavel.nome": card.responsavel.nome,
      "pipeline.nome": card.pipeline.nome,
      "coluna.nome": card.etapa.nome,
      ...fatoChecklist.placeholders,
    },
  };
}

async function enviarEmail(
  parametros: ParametrosEmailBpm,
  contexto: ContextoExecucao,
  idempotencyKey?: string,
) {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada");
  const remetente = process.env.BPM_AUTOMACOES_EMAIL_FROM
    ?? "Painel Alpha <onboarding@resend.dev>";
  const para = renderizarPlaceholdersAutomacaoBpm(parametros.para, contexto.placeholders);
  const assunto = renderizarPlaceholdersAutomacaoBpm(parametros.assunto, contexto.placeholders);
  const corpo = renderizarPlaceholdersAutomacaoBpm(parametros.corpo, contexto.placeholders);
  const cc = parametros.cc.map((item) =>
    renderizarPlaceholdersAutomacaoBpm(item, contexto.placeholders),
  );
  const html = corpo
    .split("\n")
    .map((linha) => `<p style="margin:4px 0">${escaparHtmlAutomacaoBpm(linha) || "&nbsp;"}</p>`)
    .join("");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const resposta = await resend.emails.send({
    from: remetente,
    to: para,
    subject: assunto,
    html,
    ...(cc.length > 0 ? { cc } : {}),
  }, idempotencyKey ? { idempotencyKey } : undefined);
  if (resposta.error) throw new Error(`Falha no envio: ${resposta.error.message}`);
  return { tipo: "EMAIL", destinatario: para, messageId: resposta.data?.id ?? null };
}

async function resolverVariaveisContrato(
  parametros: ParametrosContratoBpm,
  contexto: ContextoExecucao,
) {
  const ids = [...new Set(Object.values(parametros.variaveis)
    .flatMap((valor) => typeof valor === "string"
      ? [...valor.matchAll(/\{\{\s*campo\.([a-z0-9]+)\s*\}\}/g)].map((item) => item[1])
      : []))];
  const campos = ids.length ? await db.bpmCampo.findMany({
    where: { id: { in: ids }, ativo: true, OR: [
      { pipelineId: contexto.card.pipelineId },
      { pipelinesAssociados: { some: { pipelineId: contexto.card.pipelineId } } },
    ] },
    select: { id: true, escopo: true, fonteEntidade: true, fonteAtributo: true, entidadeGlobal: true },
  }) : [];
  if (campos.length !== ids.length) throw new Error("Mapeamento do contrato contém campo inativo ou fora do pipeline");
  const [valoresCard, canonicos] = await Promise.all([
    ids.length ? db.bpmCardCampoValor.findMany({ where: { cardId: contexto.card.id, campoId: { in: ids } }, select: { campoId: true, valor: true } }) : [],
    carregarValoresCanonicosCampos(contexto.card.id, campos),
  ]);
  const placeholders = {
    ...contexto.placeholders,
    ...Object.fromEntries(ids.map((id) => [`campo.${id}`, canonicos[id] ?? valoresCard.find((item) => item.campoId === id)?.valor ?? ""])),
  };
  return Object.fromEntries(
    Object.entries(parametros.variaveis).map(([chave, valor]) => [
      chave,
      typeof valor === "string"
        ? renderizarPlaceholdersAutomacaoBpm(valor, placeholders)
        : valor,
    ]),
  );
}

async function gerarContrato(
  parametros: ParametrosContratoBpm,
  contexto: ContextoExecucao,
  criadoPorId: number,
) {
  const template = await db.documentoTemplate.findFirst({
    where: { id: parametros.templateId, status: "ATIVO" },
    include: { clausulas: { orderBy: { ordem: "asc" } } },
  });
  if (!template) throw new Error("Template de contrato não encontrado ou arquivado");

  const padrao = template.id === CONTRATO_PADRAO_ID ? await carregarContratoPadrao() : null;
  const contratada = parametros.empresaContratadaId ? await db.empresaContratada.findFirst({
    where: { id: parametros.empresaContratadaId, status: "ATIVO" },
    select: { id: true, razaoSocial: true, cnpj: true, logradouro: true, numero: true, bairro: true, municipio: true, uf: true, cep: true },
  }) : null;
  if (parametros.empresaContratadaId && !contratada) throw new Error("Contratada configurada não encontrada ou arquivada");
  if (padrao && !contratada) throw new Error("Contrato padrão exige contratada configurada");
  const clausulas = padrao?.clausulas.map((clausula, indice) => ({
    ...clausula,
    conteudo: indice === 0 && contratada ? qualificarContratadaContratoPadrao(clausula.conteudo, contratada) : clausula.conteudo,
  })) ?? template.clausulas;
  const definicoes = padrao?.variaveis ?? lerVariaveisTemplate(template.variaveisJson);
  const variaveis = await resolverVariaveisContrato(parametros, contexto);
  const faltantes = definicoes
    .filter((item) => item.obrigatorio)
    .filter((item) => {
      const valor = variaveis[item.nome];
      return valor === null || valor === undefined || String(valor).trim() === "";
    });
  if (faltantes.length > 0 && !parametros.permitirPendencias) {
    throw new Error(`Variáveis obrigatórias ausentes: ${faltantes.map((item) => item.label).join(", ")}`);
  }

  const titulo = renderizarPlaceholdersAutomacaoBpm(
    parametros.titulo,
    contexto.placeholders,
  );
  const anexosExistentes = await db.bpmCardAnexo.findMany({
    where: { cardId: contexto.card.id, tipo: "application/x-painel-alpha-documento" },
    select: { url: true },
    orderBy: { createdAt: "asc" },
  });
  for (const anexo of anexosExistentes) {
    const token = anexo.url.split("/").at(-1);
    const existente = token ? await db.documentoGerado.findUnique({ where: { tokenAcesso: token }, select: { id: true, templateId: true, pdfUrl: true } }) : null;
    if (existente?.templateId === template.id) return {
      tipo: "CONTRATO", documentoId: existente.id, pdfUrl: existente.pdfUrl,
      urlConferencia: anexo.url, existente: true,
    };
  }
  const tokenAcesso = randomUUID();
  const documento = await db.$transaction(async (tx) => {
    const criado = await tx.documentoGerado.create({
      data: {
        templateId: template.id,
        titulo,
        variaveisJson: JSON.stringify(padrao ? { ...variaveis, __modeloContratoPadrao: "docx-v1", __bpmCardId: contexto.card.id } : variaveis),
        tokenAcesso,
        criadoPorId,
        clienteId: contexto.card.empresaId,
        empresaContratadaId: contratada?.id ?? null,
        status: "CONFERENCIA",
      },
    });
    await tx.documentoClasulaGerada.createMany({
      data: clausulas.map((clausula) => ({
        documentoId: criado.id,
        ordem: clausula.ordem,
        titulo: clausula.titulo,
        conteudo: renderizarConteudo(clausula.conteudo, definicoes, valoresContratoParaConferencia(definicoes, variaveis)),
        conteudoOriginal: clausula.conteudo,
      })),
    });
    await tx.bpmCardAnexo.create({ data: {
      cardId: contexto.card.id,
      url: `/PainelAlpha/GeradorDocumentos/conferencia/${tokenAcesso}`,
      nome: titulo,
      tipo: "application/x-painel-alpha-documento",
      enviadoPorId: criadoPorId,
    } });
    return criado;
  });

  let pdfUrl: string | null = null;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken && faltantes.length === 0) {
    try {
      const buffer = await gerarPdfDocumento({
        titulo,
        clausulas: clausulas.map((clausula) => ({
          titulo: clausula.titulo,
          conteudo: renderizarConteudo(clausula.conteudo, definicoes, variaveis),
        })),
        partes: padrao ? undefined : {
          contratante: {
            razaoSocial: contexto.card.empresa.razaoSocial,
            cnpj: contexto.card.empresa.cnpj,
          },
        },
        numeroContrato: padrao ? undefined : documento.id,
        estiloDocx: padrao?.estiloDocx,
      });
      const blob = await put(
        `gerador-documentos/pdfs-gerados/${criadoPorId}/${documento.id}.pdf`,
        buffer,
        { access: "public", addRandomSuffix: false, token: blobToken },
      );
      pdfUrl = blob.url;
      await db.documentoGerado.update({
        where: { id: documento.id },
        data: { pdfUrl },
      });
    } catch (error) {
      console.warn("[AutomacoesBpm] PDF do contrato não foi gerado", error);
    }
  }

  return {
    tipo: "CONTRATO",
    documentoId: documento.id,
    pendencias: faltantes.map((item) => item.label),
    pdfUrl,
    urlConferencia: `/PainelAlpha/GeradorDocumentos/conferencia/${tokenAcesso}`,
  };
}

async function gerarFicha(contexto: ContextoExecucao, criadoPorId: number) {
  if (!contexto.card.empresa.cnpj) throw new Error("Empresa do card não possui CNPJ");
  const resultado = await gerarFichaServer({
    cnpj: contexto.card.empresa.cnpj,
    userName: contexto.card.responsavel.nome,
    nomeResponsavel: contexto.card.responsavel.nome,
  });
  const existente = await db.bpmCardAnexo.findUnique({
    where: { cardId_url: { cardId: contexto.card.id, url: resultado.url } },
    select: { id: true },
  });
  const anexo = existente ?? await db.bpmCardAnexo.create({
    data: {
      cardId: contexto.card.id,
      url: resultado.url,
      nome: resultado.fileName,
      tipo: "application/pdf",
      enviadoPorId: criadoPorId,
    },
    select: { id: true },
  });
  return {
    tipo: "FICHA",
    url: resultado.url,
    anexoId: anexo.id,
    arquivo: resultado.fileName,
  };
}

async function executarAcao(params: {
  acaoTipo: AcaoAutomacaoBpm;
  parametrosJson: string;
  criadoPorId: number;
  automacaoId: string;
  automacaoNome: string;
  execucaoId: string;
  eventoChave: string;
  gatilhoTipo: string;
  automacaoEtapaId: string;
  contexto: ContextoExecucao;
}) {
  let bruto: unknown;
  try {
    bruto = JSON.parse(params.parametrosJson);
  } catch {
    throw new Error("Parâmetros da automação estão corrompidos");
  }
  const parametros = validarParametrosAutomacaoBpm(params.acaoTipo, bruto);
  if (params.acaoTipo === "ENVIAR_EMAIL") {
    return enviarEmail(parametros as ParametrosEmailBpm, params.contexto);
  }
  if (params.acaoTipo === "GERAR_CONTRATO") {
    return gerarContrato(
      parametros as ParametrosContratoBpm,
      params.contexto,
      params.criadoPorId,
    );
  }
  if (params.acaoTipo === "GERAR_FICHA") {
    return gerarFicha(params.contexto, params.criadoPorId);
  }
  if (params.acaoTipo === "MATERIALIZAR_CHECKLIST") {
    const resultado = await materializarChecklistsAplicaveisCard({
      cardId: params.contexto.card.id,
      automacaoOrigem: params.automacaoId,
    });
    return {
      tipo: "CHECKLIST",
      materializados: resultado.criados.length,
      checklistIds: resultado.criados,
    };
  }
  if (params.acaoTipo === "DISTRIBUIR_RESPONSAVEL") {
    return executarDistribuicaoBpm({
      automacaoId: params.automacaoId,
      automacaoNome: params.automacaoNome,
      execucaoId: params.execucaoId,
      eventoChave: params.eventoChave,
      gatilhoTipo: params.gatilhoTipo,
      automacaoEtapaId: params.automacaoEtapaId,
      card: params.contexto.card,
      configuracao: parametros as ParametrosDistribuicaoBpm,
    });
  }
  const oportunidade = await executarOportunidadeBpm({
    automacaoId: params.automacaoId,
    automacaoNome: params.automacaoNome,
    execucaoId: params.execucaoId,
    criadoPorId: params.criadoPorId,
    card: params.contexto.card,
    configuracao: parametros as ParametrosOportunidadeBpm,
  });
  if (!("status" in oportunidade) || oportunidade.status !== "COMUNICACAO_PENDENTE") return oportunidade;
  const configuracao = parametros as ParametrosOportunidadeBpm;
  if (configuracao.acao.tipo !== "ENVIAR_EMAIL") return oportunidade;
  const email = await enviarEmail(
    configuracao.acao.parametros,
    params.contexto,
    `bpm-opportunity:${params.execucaoId}`,
  );
  await db.bpmCardHistorico.create({
    data: {
      cardId: params.contexto.card.id,
      acao: "OPORTUNIDADE_IDENTIFICADA",
      automacaoOrigem: params.automacaoId,
      valorNovoJson: JSON.stringify({
        execucaoId: params.execucaoId,
        servicoId: configuracao.servicoAlvoId,
        acao: "ENVIAR_EMAIL",
        messageId: email.messageId,
      }),
    },
  });
  return { ...oportunidade, status: "CRIADA", acao: "ENVIAR_EMAIL", messageId: email.messageId };
}

function mensagemErro(error: unknown): string {
  if (error instanceof z.ZodError) return "Configuração da ação inválida";
  return error instanceof Error ? error.message.slice(0, 2_000) : "Falha inesperada";
}

/** Adaptador do catálogo legado para versões do Motor Central. */
export async function executarAcaoLegadaNoMotorCentral(params: {
  execucaoId: string;
  automacaoId: string;
  automacaoNome: string;
  criadoPorId: number;
  cardId: string;
  gatilhoTipo: string;
  automacaoEtapaId: string;
  acaoTipo: AcaoAutomacaoBpm;
  parametros: unknown;
}) {
  const card = await db.bpmCard.findUnique({
    where: { id: params.cardId },
    select: {
      id: true, pipelineId: true, etapaId: true, servico: true, tipoProcesso: true,
      responsavelId: true, status: true, createdAt: true, updatedAt: true,
      concluidoEm: true, primeiraVisualizacaoEm: true, proximoContatoEm: true,
      dataReuniao: true, statusPosFechamento: true, empresaId: true,
      empresa: { select: { razaoSocial: true, nomeFantasia: true, cnpj: true } },
      responsavel: { select: { nome: true } }, pipeline: { select: { nome: true } }, etapa: { select: { nome: true } },
    },
  });
  if (!card) throw new Error("Card não encontrado");
  return executarAcao({
    acaoTipo: params.acaoTipo,
    parametrosJson: JSON.stringify(params.parametros),
    criadoPorId: params.criadoPorId,
    automacaoId: params.automacaoId,
    automacaoNome: params.automacaoNome,
    execucaoId: params.execucaoId,
    eventoChave: `central:${params.execucaoId}`,
    gatilhoTipo: params.gatilhoTipo,
    automacaoEtapaId: params.automacaoEtapaId,
    contexto: await montarContexto(card),
  });
}

export async function processarFilaAutomacoesBpm(
  limite = 20,
): Promise<{ encontrados: number; executados: number; falhos: number }> {
  const agora = new Date();
  const stale = new Date(agora.getTime() - 15 * 60_000);
  await db.bpmAutomacaoExecucao.updateMany({
    where: { automacaoVersaoId: null, status: "EM_EXECUCAO", iniciadoEm: { lte: stale }, tentativas: { lt: 3 } },
    data: { status: "PENDENTE", iniciadoEm: null, disponivelEm: agora },
  });
  const pendentes = await db.bpmAutomacaoExecucao.findMany({
    where: { automacaoVersaoId: null, status: "PENDENTE", disponivelEm: { lte: agora }, tentativas: { lt: 3 } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(limite, 1), 50),
  });

  let executados = 0;
  let falhos = 0;
  for (const pendente of pendentes) {
    const claim = await db.bpmAutomacaoExecucao.updateMany({
      where: { id: pendente.id, status: "PENDENTE" },
      data: { status: "EM_EXECUCAO", iniciadoEm: new Date(), tentativas: { increment: 1 } },
    });
    if (claim.count !== 1) continue;

    const execucao = await db.bpmAutomacaoExecucao.findUnique({
      where: { id: pendente.id },
      include: {
        automacao: true,
        card: {
          select: {
            id: true,
            pipelineId: true,
            etapaId: true,
            servico: true,
            tipoProcesso: true,
            responsavelId: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            concluidoEm: true,
            primeiraVisualizacaoEm: true,
            proximoContatoEm: true,
            dataReuniao: true,
            statusPosFechamento: true,
            empresaId: true,
            empresa: { select: { razaoSocial: true, nomeFantasia: true, cnpj: true } },
            responsavel: { select: { nome: true } },
            pipeline: { select: { nome: true } },
            etapa: { select: { nome: true } },
          },
        },
      },
    });
    if (!execucao) continue;

    try {
      if (!execucao.automacao.ativa) throw new Error("Automação desativada antes da execução");
      const resultado = await executarAcao({
        acaoTipo: execucao.automacao.acaoTipo as AcaoAutomacaoBpm,
        parametrosJson: execucao.automacao.parametrosJson,
        criadoPorId: execucao.automacao.criadoPorId,
        automacaoId: execucao.automacaoId,
        automacaoNome: execucao.automacao.nome,
        execucaoId: execucao.id,
        eventoChave: execucao.eventoChave,
        gatilhoTipo: execucao.gatilhoTipo,
        automacaoEtapaId: execucao.automacao.etapaId,
        contexto: await montarContexto(execucao.card),
      });
      if (
        typeof resultado === "object"
        && resultado !== null
        && "execucaoFinalizada" in resultado
        && resultado.execucaoFinalizada === true
      ) {
        executados += 1;
        continue;
      }
      const concluidoEm = new Date();
      await db.$transaction([
        db.bpmAutomacaoExecucao.update({
          where: { id: execucao.id },
          data: {
            status: "SUCESSO",
            resultadoJson: JSON.stringify(resultado),
            mensagemErro: null,
            executadoEm: concluidoEm,
          },
        }),
        db.bpmCardHistorico.create({
          data: {
            cardId: execucao.cardId,
            acao: "AUTOMACAO_EXECUTADA",
            automacaoOrigem: execucao.automacao.id,
            valorNovoJson: JSON.stringify({
              automacaoId: execucao.automacao.id,
              nome: execucao.automacao.nome,
              acaoTipo: execucao.automacao.acaoTipo,
              execucaoId: execucao.id,
              resultado,
            }),
          },
        }),
      ]);
      executados += 1;
    } catch (error) {
      const erro = mensagemErro(error);
      await db.bpmAutomacaoExecucao.update({
        where: { id: execucao.id },
        data: { status: "FALHA", mensagemErro: erro, executadoEm: new Date() },
      });
      falhos += 1;
      console.error("[AutomacoesBpm] Falha na execução", {
        execucaoId: execucao.id,
        automacaoId: execucao.automacaoId,
        erro,
      });
    }
  }
  return { encontrados: pendentes.length, executados, falhos };
}
