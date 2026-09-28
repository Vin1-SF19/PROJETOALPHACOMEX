import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import db from "@/lib/prisma";
import { FichaAlphaPDF } from "@/components/GerarFicha";
import { etapaEhReuniaoAgendada } from "@/lib/bpm/reuniao-agendada";
import { montarFichaAlphaDoCard } from "@/lib/bpm/ficha-viabilidade-dados";

export async function gerarFichaViabilidadeCardBpm(cardId: string): Promise<{ nome: string; base64: string }> {
  const card = await db.bpmCard.findUnique({
    where: { id: cardId },
    select: {
      id: true, pipelineId: true, pipeline: { select: { nome: true } },
      etapa: { select: { nome: true } },
      responsavel: { select: { nome: true } },
      empresa: { select: {
        razaoSocial: true, nomeFantasia: true, cnpj: true, uf: true,
        dataConstituicao: true, capitalSocial: true, regimeTributario: true,
        pessoas: { where: { ativo: true }, orderBy: { principal: "desc" }, take: 5,
          select: { principal: true, pessoa: { select: { nome: true, celular: true, email: true, telefoneExtra: true } } } },
      } },
      dataReuniao: true, transcricaoReuniao: true,
      reunioes: { where: { chave: "principal" }, take: 1, select: { emailCliente: true } },
      campoValores: { select: { campoId: true, valor: true } },
    },
  });
  if (!card || card.pipeline.nome !== "Revisão de Radar" || !etapaEhReuniaoAgendada(card.etapa.nome)) {
    throw new Error("Card não está em Reunião Agendada no pipeline Revisão de Radar.");
  }
  const cnpj = card.empresa.cnpj?.replace(/\D/g, "") ?? "";
  const [campos, consulta] = await Promise.all([
    db.bpmCampo.findMany({ where: { pipelineId: card.pipelineId, ativo: true }, select: { id: true, chave: true, nome: true } }),
    cnpj ? db.consultaPreAnalise.findUnique({ where: { cnpj }, select: {
      cnpj: true, regimeEA: true, submodalidade: true, situacao: true,
      capitalSocial: true, nomeResponsavel: true, telefoneContato: true,
      observacoes: true, dadosBrutos: true,
    } }) : null,
  ]);
  const ficha = montarFichaAlphaDoCard({ card, campos, consulta });
  const logo = await readFile(path.join(process.cwd(), "public", "LogoTipo02.png"));
  const elemento = React.createElement(FichaAlphaPDF, {
    ...ficha, logoPath: `data:image/png;base64,${logo.toString("base64")}`,
  });
  const bytes = await renderToBuffer(elemento as Parameters<typeof renderToBuffer>[0]);
  return {
    nome: `Ficha_Alpha_${cnpj || card.id}.pdf`,
    base64: Buffer.from(bytes).toString("base64"),
  };
}
