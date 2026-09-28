import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import db from "@/lib/prisma";
import { etapaEhReuniaoAgendada, transcricaoRealRegistrada } from "@/lib/bpm/reuniao-agendada";

function textoPdf(valor: string): string {
  return valor.replace(/\s+/g, " ").replace(/[\u2013\u2014]/g, "-").replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, "?").trim();
}

export async function gerarFichaViabilidadeCardBpm(cardId: string): Promise<{ nome: string; base64: string }> {
  const card = await db.bpmCard.findUnique({
    where: { id: cardId },
    select: {
      id: true, pipeline: { select: { nome: true } }, etapa: { select: { id: true, nome: true } },
      empresa: { select: { razaoSocial: true, cnpj: true } }, dataReuniao: true,
      transcricaoReuniao: true, campoValores: { select: { campoId: true, valor: true } },
    },
  });
  if (!card || card.pipeline.nome !== "Revisão de Radar" || !etapaEhReuniaoAgendada(card.etapa.nome)) {
    throw new Error("Card não está em Reunião Agendada no pipeline Revisão de Radar.");
  }
  const configs = await db.bpmCampoEtapaConfig.findMany({
    where: { etapaId: card.etapa.id, grupo: { in: ["Análise de Viabilidade", "Resumo da reunião"] } },
    include: { campo: { select: { nome: true, ativo: true } } }, orderBy: { ordem: "asc" },
  });
  const valores = new Map(card.campoValores.map((item) => [item.campoId, item.valor]));
  const linhas = [
    "FICHA DE ANALISE DE VIABILIDADE - REVISAO DE RADAR",
    `Empresa: ${card.empresa.razaoSocial}`,
    `CNPJ: ${card.empresa.cnpj || "Nao informado"}`,
    `Reuniao: ${card.dataReuniao ? card.dataReuniao.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Nao informada"}`,
    `Transcricao: ${transcricaoRealRegistrada(card.transcricaoReuniao) ? "Registrada no card" : "Pendente"}`,
    "",
    "ANALISE DE VIABILIDADE",
    ...configs.filter((item) => item.grupo === "Análise de Viabilidade").map((item) =>
      `${item.campo.nome}: ${valores.get(item.campoId)?.trim() || (item.campo.ativo ? "Nao informado" : "Opcao pendente de configuracao")}`),
    "",
    "RESUMO DA REUNIAO",
    valores.get(configs.find((item) => item.grupo === "Resumo da reunião")?.campoId ?? "")?.trim() || "Nao informado",
  ];
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const largura = 595.28;
  const altura = 841.89;
  let pagina = pdf.addPage([largura, altura]);
  let y = altura - 45;
  for (const linhaOriginal of linhas) {
    const linha = textoPdf(linhaOriginal);
    const cabecalho = linha === linhas[0] || ["ANALISE DE VIABILIDADE", "RESUMO DA REUNIAO"].includes(linha);
    const tamanho = cabecalho ? 11 : 9;
    const ativa = cabecalho ? fonteNegrito : fonte;
    const palavras = linha.split(" ");
    let atual = "";
    const fragmentos: string[] = [];
    for (const palavra of palavras) {
      const candidata = atual ? `${atual} ${palavra}` : palavra;
      if (ativa.widthOfTextAtSize(candidata, tamanho) > largura - 88 && atual) {
        fragmentos.push(atual);
        atual = palavra;
      } else atual = candidata;
    }
    fragmentos.push(atual);
    for (const fragmento of fragmentos) {
      if (y < 50) { pagina = pdf.addPage([largura, altura]); y = altura - 45; }
      if (fragmento) pagina.drawText(fragmento, { x: 44, y, size: tamanho, font: ativa, color: rgb(0.12, 0.18, 0.28) });
      y -= cabecalho ? 20 : 16;
    }
  }
  const bytes = await pdf.save();
  return { nome: `ficha-viabilidade-${card.id}.pdf`, base64: Buffer.from(bytes).toString("base64") };
}
