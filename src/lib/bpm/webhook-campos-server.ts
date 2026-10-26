import "server-only";

import db from "@/lib/prisma";
import { etapaEhAgendarReuniao, destinoEhReuniaoAgendada } from "@/lib/bpm/agendar-reuniao";
import { camposPublicadosPorEtapa } from "@/lib/bpm/campos-formulario-publicado";
import { etapaEhNovosLeads } from "@/lib/bpm/novos-leads";
import { requisitoAplicaAoMover } from "@/lib/bpm/requisitos-etapa";

export type CampoObrigatorioWebhook = {
  id: string;
  nome: string;
  tipo: string;
  condicional: boolean;
  editavelViaWebhook: boolean;
  opcoes: string[];
};

export type GrupoCamposWebhook = {
  etapaDestino: "AGENDAR_REUNIAO" | "REUNIAO_AGENDADA";
  titulo: string;
  aviso: string | null;
  campos: CampoObrigatorioWebhook[];
  outrosRequisitos: string[];
};

function opcoesDoCampo(campo: { opcoes: { rotulo: string }[]; opcoesJson: string | null }): string[] {
  if (campo.opcoes.length) return campo.opcoes.map((opcao) => opcao.rotulo);
  try {
    const opcoes: unknown = JSON.parse(campo.opcoesJson ?? "[]");
    return Array.isArray(opcoes) ? opcoes.filter((valor): valor is string => typeof valor === "string") : [];
  } catch { return []; }
}

/** Catálogo administrativo: condições são sinalizadas, pois a avaliação depende de cada card. */
export async function listarCamposObrigatoriosWebhook(pipelineId: string): Promise<GrupoCamposWebhook[]> {
  const etapas = await db.bpmEtapa.findMany({
    where: { pipelineId, ativo: true }, select: { id: true, nome: true },
  });
  const etapaIds = etapas.map((etapa) => etapa.id);
  const [campos, requisitos, transicoes, publicados] = await Promise.all([
    db.bpmCampo.findMany({
      where: {
        ativo: true,
        OR: [{ pipelineId }, { pipelinesAssociados: { some: { pipelineId } } }],
        componentesFormulario: { some: { secao: { formulario: { ativo: true, etapaId: { in: etapaIds } } } } },
      },
      select: {
        id: true, nome: true, tipo: true, editavel: true, somenteLeitura: true, opcoesJson: true,
        opcoes: { where: { ativo: true }, orderBy: [{ ordem: "asc" }, { id: "asc" }], select: { rotulo: true } },
        etapaConfiguracoes: { where: { etapaId: { in: etapaIds } }, select: {
          etapaId: true, visivel: true, obrigatorio: true, obrigatorioSaida: true, obrigatorioEntrada: true,
          condicaoObrigatoriedadeJson: true, condicaoVisibilidadeJson: true, editavel: true, somenteLeitura: true,
        } },
      },
    }),
    db.bpmRequisito.findMany({
      where: { pipelineId, ativo: true },
      select: { etapaId: true, transicaoId: true, campoId: true, fase: true, condicaoJson: true, alvoTipo: true, mensagem: true },
    }),
    db.bpmTransicaoEtapa.findMany({
      where: { etapaOrigemId: { in: etapaIds }, etapaDestinoId: { in: etapaIds } },
      select: { id: true, etapaOrigemId: true, etapaDestinoId: true, permitida: true, origem: true },
    }),
    camposPublicadosPorEtapa(etapaIds),
  ]);

  const grupos = [
    { etapaDestino: "AGENDAR_REUNIAO" as const, titulo: "Novo Lead → Agendar reunião", origem: etapaEhNovosLeads, destino: etapaEhAgendarReuniao },
    { etapaDestino: "REUNIAO_AGENDADA" as const, titulo: "Agendar reunião → Reunião Agendada", origem: etapaEhAgendarReuniao, destino: destinoEhReuniaoAgendada },
  ];
  const idsPublicados = new Set([...publicados.values()].flatMap((ids) => [...ids]));

  return grupos.map((grupo) => {
    const origens = etapas.filter((etapa) => grupo.origem(etapa.nome));
    const destinos = etapas.filter((etapa) => grupo.destino(etapa.nome));
    if (origens.length !== 1 || destinos.length !== 1) {
      return { etapaDestino: grupo.etapaDestino, titulo: grupo.titulo,
        aviso: "Configure uma única etapa ativa para a origem e o destino desta operação.", campos: [], outrosRequisitos: [] };
    }
    const origemId = origens[0].id;
    const destinoId = destinos[0].id;
    const transicao = transicoes.find((item) => item.etapaOrigemId === origemId && item.etapaDestinoId === destinoId);
    const aplicaveis = requisitos.filter((requisito) => requisitoAplicaAoMover(requisito, transicao?.id ?? "", origemId, destinoId));
    const camposObrigatorios = campos.flatMap((campo): CampoObrigatorioWebhook[] => {
      // Requisitos explícitos só se aplicam a campos ativos publicados no pipeline.
      if (!idsPublicados.has(campo.id)) return [];
      const requisitosCampo = aplicaveis.filter((requisito) => requisito.alvoTipo === "CAMPO" && requisito.campoId === campo.id);
      const configuracoes = campo.etapaConfiguracoes.filter((config) => config.visivel
        && publicados.get(config.etapaId)?.has(campo.id)
        && (config.etapaId === origemId
          ? config.obrigatorio || config.obrigatorioSaida || Boolean(config.condicaoObrigatoriedadeJson)
          : config.etapaId === destinoId && config.obrigatorioEntrada));
      if (!requisitosCampo.length && !configuracoes.length) return [];
      const obrigatorioSempre = requisitosCampo.some((requisito) => !requisito.condicaoJson)
        || configuracoes.some((config) => !config.condicaoVisibilidadeJson
          && (config.etapaId === origemId ? config.obrigatorio || config.obrigatorioSaida : config.obrigatorioEntrada));
      const configEdicao = campo.etapaConfiguracoes.find((config) => config.etapaId === destinoId)
        ?? campo.etapaConfiguracoes.find((config) => config.etapaId === origemId);
      return [{
        id: campo.id, nome: campo.nome, tipo: campo.tipo, condicional: !obrigatorioSempre,
        editavelViaWebhook: Boolean(configEdicao && campo.editavel && !campo.somenteLeitura
          && configEdicao.editavel && !configEdicao.somenteLeitura
          && (publicados.get(origemId)?.has(campo.id) || publicados.get(destinoId)?.has(campo.id))),
        opcoes: opcoesDoCampo(campo),
      }];
    }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    return {
      etapaDestino: grupo.etapaDestino, titulo: grupo.titulo,
      aviso: transicao?.permitida && ["AUTOMACAO", "AMBOS"].includes(transicao.origem)
        ? null : "Esta transição ainda não está permitida para integração na configuração do pipeline.",
      campos: camposObrigatorios,
      outrosRequisitos: [...new Set(aplicaveis.filter((requisito) => requisito.alvoTipo !== "CAMPO")
        .map((requisito) => `${requisito.mensagem}${requisito.condicaoJson ? " (condicional)" : ""}`))],
    };
  });
}
