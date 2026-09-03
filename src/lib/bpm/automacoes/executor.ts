import "server-only";

import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { Resend } from "resend";
import { z } from "zod";

import db from "@/lib/prisma";
import { gerarFichaServer } from "@/lib/bibble/gerar-ficha-server";
import { gerarPdfDocumento } from "@/lib/gerador-documentos/pdf";
import { renderizarConteudo } from "@/lib/gerador-documentos/render";
import { VariavelTemplateSchema } from "@/lib/gerador-documentos/schemas";
import {
  escaparHtmlAutomacaoBpm,
  renderizarPlaceholdersAutomacaoBpm,
} from "@/lib/bpm/automacoes/placeholders";
import {
  type AcaoAutomacaoBpm,
  type ParametrosContratoBpm,
  type ParametrosEmailBpm,
  validarParametrosAutomacaoBpm,
} from "@/lib/bpm/automacoes/schemas";

const variaveisTemplateSchema = z.array(VariavelTemplateSchema).max(50);

function lerVariaveisTemplate(valor: unknown) {
  const normalizado = typeof valor === "string" ? JSON.parse(valor) : valor;
  return variaveisTemplateSchema.parse(normalizado);
}

type ContextoExecucao = {
  card: {
    id: string;
    servico: string | null;
    empresaId: number;
    empresa: { razaoSocial: string; nomeFantasia: string | null; cnpj: string | null };
    responsavel: { nome: string };
    pipeline: { nome: string };
    etapa: { nome: string };
  };
  placeholders: Record<string, string>;
};

function montarContexto(card: ContextoExecucao["card"]): ContextoExecucao {
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
    },
  };
}

async function enviarEmail(
  parametros: ParametrosEmailBpm,
  contexto: ContextoExecucao,
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
  });
  if (resposta.error) throw new Error(`Falha no envio: ${resposta.error.message}`);
  return { tipo: "EMAIL", destinatario: para, messageId: resposta.data?.id ?? null };
}

function resolverVariaveisContrato(
  parametros: ParametrosContratoBpm,
  contexto: ContextoExecucao,
) {
  return Object.fromEntries(
    Object.entries(parametros.variaveis).map(([chave, valor]) => [
      chave,
      typeof valor === "string"
        ? renderizarPlaceholdersAutomacaoBpm(valor, contexto.placeholders)
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

  const definicoes = lerVariaveisTemplate(template.variaveisJson);
  const variaveis = resolverVariaveisContrato(parametros, contexto);
  const faltantes = definicoes
    .filter((item) => item.obrigatorio)
    .filter((item) => {
      const valor = variaveis[item.nome];
      return valor === null || valor === undefined || String(valor).trim() === "";
    });
  if (faltantes.length > 0) {
    throw new Error(`Variáveis obrigatórias ausentes: ${faltantes.map((item) => item.label).join(", ")}`);
  }

  const titulo = renderizarPlaceholdersAutomacaoBpm(
    parametros.titulo,
    contexto.placeholders,
  );
  const tokenAcesso = randomUUID();
  const documento = await db.$transaction(async (tx) => {
    const criado = await tx.documentoGerado.create({
      data: {
        templateId: template.id,
        titulo,
        variaveisJson: JSON.stringify(variaveis),
        tokenAcesso,
        criadoPorId,
        clienteId: contexto.card.empresaId,
        status: "CONFERENCIA",
      },
    });
    await tx.documentoClasulaGerada.createMany({
      data: template.clausulas.map((clausula) => ({
        documentoId: criado.id,
        ordem: clausula.ordem,
        titulo: clausula.titulo,
        conteudo: renderizarConteudo(clausula.conteudo, definicoes, variaveis),
        conteudoOriginal: clausula.conteudo,
      })),
    });
    return criado;
  });

  let pdfUrl: string | null = null;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) {
    try {
      const buffer = await gerarPdfDocumento({
        titulo,
        clausulas: template.clausulas.map((clausula) => ({
          titulo: clausula.titulo,
          conteudo: renderizarConteudo(clausula.conteudo, definicoes, variaveis),
        })),
        partes: {
          contratante: {
            razaoSocial: contexto.card.empresa.razaoSocial,
            cnpj: contexto.card.empresa.cnpj,
          },
        },
        numeroContrato: documento.id,
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
  return gerarFicha(params.contexto, params.criadoPorId);
}

function mensagemErro(error: unknown): string {
  if (error instanceof z.ZodError) return "Configuração da ação inválida";
  return error instanceof Error ? error.message.slice(0, 2_000) : "Falha inesperada";
}

export async function processarFilaAutomacoesBpm(
  limite = 20,
): Promise<{ encontrados: number; executados: number; falhos: number }> {
  const agora = new Date();
  const stale = new Date(agora.getTime() - 15 * 60_000);
  await db.bpmAutomacaoExecucao.updateMany({
    where: { status: "EM_EXECUCAO", iniciadoEm: { lte: stale }, tentativas: { lt: 3 } },
    data: { status: "PENDENTE", iniciadoEm: null, disponivelEm: agora },
  });
  const pendentes = await db.bpmAutomacaoExecucao.findMany({
    where: { status: "PENDENTE", disponivelEm: { lte: agora }, tentativas: { lt: 3 } },
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
            servico: true,
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
        contexto: montarContexto(execucao.card),
      });
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
