import "server-only";

import type { Prisma } from "@prisma/client";

import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";
import { camposPublicadosPorEtapa } from "@/lib/bpm/campos-formulario-publicado";
import { carregarValoresCanonicosCampos } from "@/lib/bpm/campos-configuraveis-server";
import { avaliarGrupo } from "@/lib/bpm/regras/avaliador";
import { montarContextoAvaliacaoDoCard } from "@/lib/bpm/regras/contexto";
import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";

type Card = Parameters<typeof montarContextoAvaliacaoDoCard>[0];

function condicaoValida(json: string, nome: string) {
  try {
    return grupoCondicaoSchema.parse(JSON.parse(json));
  } catch {
    throw new Error(`CONFIGURACAO_INVALIDA:Condição inválida em ${nome}.`);
  }
}

function valorAutomatico(valorPadrao: string, agora: Date): string | null {
  if (valorPadrao === "{{agora.instante}}") return agora.toISOString();
  if (valorPadrao === "{{agora.data}}") {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(agora);
  }
  return null;
}

/** Aplica padrões temporais e requisitos DURING_STAGE publicados ao salvar campos. */
export async function prepararSalvamentoConfigurado(params: {
  card: Card;
  valoresSubmetidos: Record<string, string>;
  client: Prisma.TransactionClient;
  agora?: Date;
}): Promise<Record<string, string>> {
  const { card, client } = params;
  const agora = params.agora ?? new Date();
  const [publicadosPorEtapa, etapas, requisitos] = await Promise.all([
    camposPublicadosPorEtapa([card.etapaId], client),
    client.bpmEtapa.findMany({ where: { pipelineId: card.pipelineId, ativo: true }, select: { id: true } }),
    client.bpmRequisito.findMany({
      where: { pipelineId: card.pipelineId, ativo: true, fase: "DURING_STAGE", OR: [{ etapaId: card.etapaId }, { etapaId: null }] },
      include: { campo: { select: { id: true, nome: true, ativo: true } } },
      orderBy: [{ ordem: "asc" }, { chave: "asc" }],
    }),
  ]);
  const publicados = publicadosPorEtapa.get(card.etapaId) ?? new Set<string>();
  const configs = await client.bpmCampoEtapaConfig.findMany({
    where: { etapaId: card.etapaId, visivel: true, campoId: { in: [...publicados] }, campo: { ativo: true } },
    include: { campo: { select: { id: true, nome: true, tipo: true, opcoesJson: true } } },
  });
  const possuiAutomacao = configs.some((config) => config.condicaoObrigatoriedadeJson
    && (config.valorPadrao === "{{agora.data}}" || config.valorPadrao === "{{agora.instante}}"));
  if (!possuiAutomacao && requisitos.length === 0) return params.valoresSubmetidos;

  const publicadosPipeline = await camposPublicadosPorEtapa(etapas.map((etapa) => etapa.id), client);
  const idsPublicados = new Set([...publicadosPipeline.values()].flatMap((ids) => [...ids]));
  const campos = await client.bpmCampo.findMany({
    where: { id: { in: [...idsPublicados] }, ativo: true,
      OR: [{ pipelineId: card.pipelineId }, { pipelinesAssociados: { some: { pipelineId: card.pipelineId } } }],
    },
    select: { id: true, nome: true, escopo: true, fonteEntidade: true, fonteAtributo: true, entidadeGlobal: true },
  });
  const contexto = await montarContextoAvaliacaoDoCard(card, client);
  const canonicos = await carregarValoresCanonicosCampos(card.id, campos, client);
  contexto.camposDinamicos = {
    ...Object.fromEntries(campos.map((campo) => [campo.id, null])),
    ...contexto.camposDinamicos,
    ...canonicos,
    ...params.valoresSubmetidos,
  };
  const valores = { ...params.valoresSubmetidos };

  for (const config of configs) {
    if (!config.condicaoObrigatoriedadeJson || !config.valorPadrao) continue;
    const automatico = valorAutomatico(config.valorPadrao, agora);
    if (automatico === null || String(contexto.camposDinamicos[config.campoId] ?? "").trim()) continue;
    if (!avaliarGrupo(condicaoValida(config.condicaoObrigatoriedadeJson, config.campo.nome), contexto)) continue;
    const validacao = validarValoresCamposBpm([config.campo], { [config.campoId]: automatico });
    if (!validacao.success) throw new Error(`CAMPO_INVALIDO:${validacao.error}`);
    valores[config.campoId] = validacao.valores[config.campoId];
    contexto.camposDinamicos[config.campoId] = valores[config.campoId];
  }

  const pendencias: string[] = [];
  for (const requisito of requisitos) {
    if (requisito.condicaoJson
      && !avaliarGrupo(condicaoValida(requisito.condicaoJson, requisito.chave), contexto)) continue;
    if (requisito.alvoTipo === "REGRA") {
      if (!requisito.condicaoJson) throw new Error(`CONFIGURACAO_INVALIDA:Regra ${requisito.chave} sem condição.`);
      pendencias.push(requisito.mensagem);
      continue;
    }
    if (requisito.alvoTipo !== "CAMPO" || !requisito.campoId) continue;
    if (!requisito.campo?.ativo || !idsPublicados.has(requisito.campoId)) {
      throw new Error(`CONFIGURACAO_INVALIDA:Campo não publicado no requisito ${requisito.chave}.`);
    }
    if (!String(contexto.camposDinamicos[requisito.campoId] ?? "").trim()) {
      pendencias.push(requisito.campo.nome);
    }
  }
  if (pendencias.length) throw new Error(`REQUISITOS_PENDENTES:Campos/requisitos pendentes (${[...new Set(pendencias)].join(", ")}).`);
  return valores;
}
