import "server-only";

import db from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  listarCamposObrigatoriosFaltantes,
  type CampoObrigatorioBpm,
  type OrigemMovimentacaoBpm,
} from "@/lib/bpm/requisitos-etapa";
import {
  campoBpmPossuiFonteMestre,
  resolverValorEfetivoCampoBpm,
  type DadosMestresCampoBpm,
} from "@/lib/bpm/valor-efetivo-campo";
import { carregarValoresCanonicosCampos } from "@/lib/bpm/campos-configuraveis-server";
import { resolverMapeamentosCampo, type MapeamentoCampo } from "@/lib/bpm/campos-configuraveis";
import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";
import { avaliarGrupo } from "@/lib/bpm/regras/avaliador";
import { montarContextoAvaliacaoDoCard } from "@/lib/bpm/regras/contexto";
import type { ContextoAvaliacao } from "@/lib/bpm/regras/types";

type ClienteRequisitosEtapa = Pick<
  typeof db,
  | "bpmCampo"
  | "bpmCampoObrigatorioEtapa"
  | "bpmCampoOcultoEtapa"
  | "bpmCardCampoValor"
  | "bpmCard"
  | "bpmCampoMapeamento"
  | "contratoComercial"
  | "servicosComerciais"
  | "businessProcess"
>;

type ClienteTransicaoBpm = typeof db | Prisma.TransactionClient;

/**
 * Consulta a única definição canônica para origem→destino. A ausência da
 * aresta é uma decisão negativa: transições são fail-closed.
 */
export async function verificarTransicaoPermitidaBpm(
  etapaOrigemId: string,
  etapaDestinoId: string,
  origemMovimentacao: OrigemMovimentacaoBpm,
  client: ClienteTransicaoBpm = db,
): Promise<{ permitida: boolean; motivo?: string }> {
  if (etapaOrigemId === etapaDestinoId) return { permitida: true };

  const transicao = await client.bpmTransicaoEtapa.findUnique({
    where: { etapaOrigemId_etapaDestinoId: { etapaOrigemId, etapaDestinoId } },
    select: { permitida: true, origem: true },
  });
  if (!transicao) {
    return { permitida: false, motivo: "Esta transição não está definida no pipeline." };
  }

  if (!transicao.permitida) {
    return { permitida: false, motivo: "Esta transição foi desativada pelo administrador." };
  }
  if (transicao.origem !== "AMBOS" && transicao.origem !== origemMovimentacao) {
    return {
      permitida: false,
      motivo: transicao.origem === "MANUAL"
        ? "Esta transição só é permitida por ação manual do usuário."
        : "Esta transição só é permitida pelo Motor de Automações.",
    };
  }
  return { permitida: true };
}

export type CampoAplicavelEtapaBpm = {
  id: string;
  pipelineId: string;
  etapaId: string | null;
  nome: string;
  tipo: string;
  opcoesJson: string | null;
  obrigatorio: boolean;
  obrigatorioEntrada?: boolean;
  obrigatorioSaida?: boolean;
  ordem: number;
  grupo?: string | null;
  ativo?: boolean;
  escopo?: string;
  valorPadrao?: string | null;
  fonteEntidade?: string | null;
  fonteAtributo?: string | null;
  entidadeGlobal?: string | null;
  visivel?: boolean;
  editavel?: boolean;
  somenteLeitura?: boolean;
  configVersao?: number;
  mapeamentoModo?: string | null;
  campoOrigemId?: string | null;
  condicaoVisibilidadeJson?: string | null;
  condicaoObrigatoriedadeJson?: string | null;
  valor: string | null;
};

export type PerfilAcessoCampoBpm = "ADMIN" | "RESPONSAVEL" | "MEMBRO";

type ConfiguracaoAcessoCampo = {
  visivel: boolean;
  editavel: boolean;
  somenteLeitura: boolean;
  obrigatorio: boolean;
};

function resolverConfiguracaoAcessoCampo(
  campo: {
    visivel?: boolean;
    editavel?: boolean;
    somenteLeitura?: boolean;
    obrigatorio: boolean;
    acessos?: Array<ConfiguracaoAcessoCampo & { perfil: string }>;
  },
  configEtapa: ConfiguracaoAcessoCampo | undefined,
  perfilAcesso: PerfilAcessoCampoBpm | undefined,
) {
  const acesso = perfilAcesso
    ? campo.acessos?.find((item) => item.perfil === perfilAcesso)
    : undefined;
  const visivel = campo.visivel !== false
    && configEtapa?.visivel !== false
    && acesso?.visivel !== false;
  const somenteLeitura = campo.somenteLeitura === true
    || configEtapa?.somenteLeitura === true
    || acesso?.somenteLeitura === true;
  const editavel = visivel
    && campo.editavel !== false
    && configEtapa?.editavel !== false
    && acesso?.editavel !== false
    && !somenteLeitura;
  return {
    visivel,
    editavel,
    somenteLeitura,
    // BpmCampoAcesso controla apresentação/autorização, jamais requisito de negócio.
    obrigatorio: configEtapa?.obrigatorio ?? campo.obrigatorio,
  };
}

export async function carregarCamposAplicaveisEtapa(
  pipelineId: string,
  etapaId: string,
  client: ClienteRequisitosEtapa = db,
  perfilAcesso?: PerfilAcessoCampoBpm,
): Promise<Array<Omit<CampoAplicavelEtapaBpm, "valor">>> {
  const selectCampo = {
    id: true,
    pipelineId: true,
    etapaId: true,
    nome: true,
    tipo: true,
    opcoesJson: true,
    obrigatorio: true,
    ordem: true,
    ativo: true,
    escopo: true,
    valorPadrao: true,
    fonteEntidade: true,
    fonteAtributo: true,
    entidadeGlobal: true,
    visivel: true,
    editavel: true,
    somenteLeitura: true,
    configVersao: true,
    opcoes: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: { chave: true, rotulo: true } },
    pipelinesAssociados: { select: { pipelineId: true } },
    etapaConfiguracoes: { select: {
      etapaId: true,
      visivel: true,
      editavel: true,
      somenteLeitura: true,
      obrigatorio: true,
      obrigatorioEntrada: true,
      obrigatorioSaida: true,
      ordem: true,
      grupo: true,
      valorPadrao: true,
      condicaoVisibilidadeJson: true,
      condicaoObrigatoriedadeJson: true,
    } },
    acessos: { select: { perfil: true, visivel: true, editavel: true, somenteLeitura: true, obrigatorio: true } },
  } as const;

  const [diretos, associados, ocultos] = await Promise.all([
    // etapaId: null é "todas as etapas" (rótulo exibido no admin de pipeline,
    // AdminPipelineClient.tsx) — precisa entrar aqui junto com os campos da
    // etapa específica, não só os de etapaId igual.
    client.bpmCampo.findMany({
      where: {
        ativo: true,
        OR: [
          { pipelineId, OR: [{ etapaId }, { etapaId: null }] },
          { pipelinesAssociados: { some: { pipelineId } } },
        ],
      },
      select: selectCampo,
    }),
    client.bpmCampoObrigatorioEtapa.findMany({
      where: { etapaId, campo: { pipelineId, ativo: true } },
      select: { campo: { select: selectCampo } },
    }),
    client.bpmCampoOcultoEtapa.findMany({
      where: { etapaId, campo: { pipelineId } },
      select: { campoId: true },
    }),
  ]);
  const idsOcultos = new Set(ocultos.map((item) => item.campoId));

  const porId = new Map<
    string,
    Omit<CampoAplicavelEtapaBpm, "valor">
  >();
  for (const campo of diretos) {
    if (idsOcultos.has(campo.id)) continue;
    const configsEtapa = campo.etapaConfiguracoes ?? [];
    const opcoes = campo.opcoes ?? [];
    const configEtapa = configsEtapa.find((config) => config.etapaId === etapaId);
    if (configsEtapa.length > 0 && !configEtapa) continue;
    const acesso = resolverConfiguracaoAcessoCampo(campo, configEtapa, perfilAcesso);
    if (!acesso.visivel) continue;
    porId.set(campo.id, {
      id: campo.id,
      pipelineId: campo.pipelineId,
      etapaId: campo.etapaId,
      nome: campo.nome,
      tipo: campo.tipo,
      opcoesJson: opcoes.length ? JSON.stringify(opcoes.map((opcao) => opcao.rotulo)) : campo.opcoesJson,
      obrigatorio: acesso.obrigatorio,
      obrigatorioEntrada: configEtapa?.obrigatorioEntrada ?? false,
      obrigatorioSaida: configEtapa?.obrigatorioSaida ?? false,
      ordem: configEtapa?.ordem ?? campo.ordem,
      grupo: configEtapa?.grupo ?? null,
      ativo: campo.ativo ?? true,
      escopo: campo.escopo ?? "CARD",
      valorPadrao: configEtapa?.valorPadrao ?? campo.valorPadrao ?? null,
      fonteEntidade: campo.fonteEntidade ?? null,
      fonteAtributo: campo.fonteAtributo ?? null,
      entidadeGlobal: campo.entidadeGlobal ?? null,
      visivel: acesso.visivel,
      editavel: acesso.editavel,
      somenteLeitura: acesso.somenteLeitura,
      configVersao: campo.configVersao ?? 1,
      condicaoVisibilidadeJson: configEtapa?.condicaoVisibilidadeJson ?? null,
      condicaoObrigatoriedadeJson: configEtapa?.condicaoObrigatoriedadeJson ?? null,
    });
  }
  for (const item of associados) {
    if (idsOcultos.has(item.campo.id)) continue;
    const campo = item.campo;
    const configsEtapa = campo.etapaConfiguracoes ?? [];
    const opcoes = campo.opcoes ?? [];
    const configEtapa = configsEtapa.find((config) => config.etapaId === etapaId);
    const acesso = resolverConfiguracaoAcessoCampo(campo, configEtapa, perfilAcesso);
    if (!acesso.visivel) continue;
    porId.set(campo.id, {
      id: campo.id,
      pipelineId: campo.pipelineId,
      etapaId: campo.etapaId,
      nome: campo.nome,
      tipo: campo.tipo,
      opcoesJson: opcoes.length ? JSON.stringify(opcoes.map((opcao) => opcao.rotulo)) : campo.opcoesJson,
      // BpmCampoObrigatorioEtapa continua sendo o fallback para cadastros
      // legados. Quando a etapa já possui a configuração nova, ela é a fonte
      // autoritativa da obrigatoriedade e não pode ser sobrescrita pelo vínculo
      // legado que permaneceu no banco após a migração.
      obrigatorio: configEtapa ? acesso.obrigatorio : true,
      obrigatorioEntrada: configEtapa?.obrigatorioEntrada ?? false,
      obrigatorioSaida: configEtapa?.obrigatorioSaida ?? false,
      ordem: configEtapa?.ordem ?? campo.ordem,
      grupo: configEtapa?.grupo ?? null,
      ativo: campo.ativo ?? true,
      escopo: campo.escopo ?? "CARD",
      valorPadrao: configEtapa?.valorPadrao ?? campo.valorPadrao ?? null,
      fonteEntidade: campo.fonteEntidade ?? null,
      fonteAtributo: campo.fonteAtributo ?? null,
      entidadeGlobal: campo.entidadeGlobal ?? null,
      visivel: acesso.visivel,
      editavel: acesso.editavel,
      somenteLeitura: acesso.somenteLeitura,
      configVersao: campo.configVersao ?? 1,
      condicaoVisibilidadeJson: configEtapa?.condicaoVisibilidadeJson ?? null,
      condicaoObrigatoriedadeJson: configEtapa?.condicaoObrigatoriedadeJson ?? null,
    });
  }

  const campos = [...porId.values()].sort(
    (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome),
  );
  return campos;
}

export async function carregarCamposAplicaveisCardEtapa(
  cardId: string,
  pipelineId: string,
  etapaId: string,
  client: ClienteRequisitosEtapa = db,
  perfilAcesso?: PerfilAcessoCampoBpm,
): Promise<CampoAplicavelEtapaBpm[]> {
  let campos = await carregarCamposAplicaveisEtapa(pipelineId, etapaId, client, perfilAcesso);
  if (campos.length === 0) return [];

  const possuiCondicao = campos.some((campo) => campo.condicaoVisibilidadeJson || campo.condicaoObrigatoriedadeJson);
  if (possuiCondicao) {
    const card = await client.bpmCard.findUnique({
      where: { id: cardId },
      select: {
        id: true, pipelineId: true, etapaId: true, responsavelId: true, servico: true,
        tipoProcesso: true, status: true, createdAt: true, updatedAt: true, concluidoEm: true,
        primeiraVisualizacaoEm: true, proximoContatoEm: true, dataReuniao: true,
        statusPosFechamento: true, empresaId: true,
      },
    });
    const contexto = card
      ? await montarContextoAvaliacaoDoCard(card, client as typeof db)
      : ({ card: {}, camposDinamicos: {} } satisfies ContextoAvaliacao);
    const avaliar = (json: string | null | undefined, fallback: boolean) => {
      if (!json?.trim()) return fallback;
      try {
        const parsed = grupoCondicaoSchema.safeParse(JSON.parse(json));
        return parsed.success ? avaliarGrupo(parsed.data, contexto) : false;
      } catch {
        return false;
      }
    };
    campos = campos
      .filter((campo) => avaliar(campo.condicaoVisibilidadeJson, true))
      .map((campo) => ({
        ...campo,
        obrigatorio: campo.obrigatorio || avaliar(campo.condicaoObrigatoriedadeJson, false),
      }));
    if (campos.length === 0) return [];
  }

  const mapeamentoDelegate = (client as Partial<ClienteRequisitosEtapa>).bpmCampoMapeamento;
  const mapeamentos = mapeamentoDelegate
    ? await mapeamentoDelegate.findMany({
        where: { ativo: true, campoDestinoId: { in: campos.map((campo) => campo.id) } },
        select: {
          campoOrigemId: true,
          campoDestinoId: true,
          modo: true,
          ativo: true,
          campoOrigem: { select: { id: true, escopo: true, fonteEntidade: true, fonteAtributo: true, entidadeGlobal: true } },
        },
      })
    : [];
  const idsValores = [...new Set([
    ...campos.map((campo) => campo.id),
    ...mapeamentos.map((item) => item.campoOrigemId),
  ])];

  const valores = await client.bpmCardCampoValor.findMany({
    where: { cardId, campoId: { in: idsValores } },
    select: { campoId: true, valor: true },
  });
  const valorPorCampo = new Map(
    valores.map((valor) => [valor.campoId, valor.valor]),
  );
  const fontesCanonicas = [
    ...campos.map((campo) => ({
      id: campo.id,
      escopo: campo.escopo ?? "CARD",
      fonteEntidade: campo.fonteEntidade ?? null,
      fonteAtributo: campo.fonteAtributo ?? null,
      entidadeGlobal: campo.entidadeGlobal ?? null,
    })),
    ...mapeamentos.map((item) => item.campoOrigem),
  ];
  const valoresCanonicos = await carregarValoresCanonicosCampos(cardId, fontesCanonicas, client as typeof db);
  const resolvidos = resolverMapeamentosCampo({
    valores: Object.fromEntries([...valorPorCampo.entries()].map(([id, valor]) => [id, valor ?? ""])),
    valoresCanonicos,
    mapeamentos: mapeamentos as MapeamentoCampo[],
  });
  const precisaDadosMestres = campos.some((campo) =>
    campoBpmPossuiFonteMestre(campo.nome)
    && !valorPorCampo.get(campo.id)?.trim()
  );
  const cardComEmpresa = precisaDadosMestres
    ? await client.bpmCard.findUnique({
        where: { id: cardId },
        select: {
          empresa: {
            select: {
              cnpj: true,
              razaoSocial: true,
              nomeFantasia: true,
              pessoas: {
                where: { ativo: true },
                select: {
                  principal: true,
                  pessoa: {
                    select: {
                      nome: true,
                      celular: true,
                      email: true,
                      telefoneExtra: true,
                    },
                  },
                },
                orderBy: [{ principal: "desc" }, { criadoEm: "asc" }],
                take: 2,
              },
            },
          },
        },
      })
    : null;
  let dadosMestres: DadosMestresCampoBpm | null = null;
  if (cardComEmpresa) {
    const principais = cardComEmpresa.empresa.pessoas.filter((vinculo) => vinculo.principal);
    // Um contato só é semanticamente inequívoco quando há exatamente um
    // principal ou apenas uma pessoa ativa. Com múltiplos contatos sem dono,
    // não escolhemos silenciosamente um valor arbitrário.
    const contato = principais.length === 1
      ? principais[0]
      : cardComEmpresa.empresa.pessoas.length === 1
        ? cardComEmpresa.empresa.pessoas[0]
        : null;
    dadosMestres = {
      empresa: {
        cnpj: cardComEmpresa.empresa.cnpj,
        razaoSocial: cardComEmpresa.empresa.razaoSocial,
        nomeFantasia: cardComEmpresa.empresa.nomeFantasia,
      },
      contatoPrincipal: contato?.pessoa ?? null,
    };
  }

  return campos.map((campo) => {
    const valorPersistido = valorPorCampo.get(campo.id) ?? null;
    const mapeamento = mapeamentos.find((item) => item.campoDestinoId === campo.id);
    const valorNovoContrato = campo.escopo === "GLOBAL"
      ? (valoresCanonicos[campo.id] || null)
      : (resolvidos.efetivos[campo.id] || valorPersistido || campo.valorPadrao || null);
    const valor = campo.escopo === "CARD" && !mapeamento && !valorPersistido
      ? resolverValorEfetivoCampoBpm({ nomeCampo: campo.nome, valorPersistido: valorNovoContrato, dadosMestres })
      : valorNovoContrato;
    return {
      ...campo,
      valor,
      mapeamentoModo: mapeamento?.modo ?? null,
      campoOrigemId: mapeamento?.campoOrigemId ?? null,
      somenteLeitura: campo.somenteLeitura || (campo.escopo === "GLOBAL" && Boolean(campo.fonteEntidade)) || resolvidos.somenteLeitura.has(campo.id),
      editavel: campo.editavel && !(campo.escopo === "GLOBAL" && Boolean(campo.fonteEntidade)) && !resolvidos.somenteLeitura.has(campo.id),
    };
  });
}

/**
 * Calcula apenas os snapshots COPIAR ainda não materializados. O chamador deve
 * persistir o retorno dentro da mesma transação que cria/atualiza/move o card.
 */
export async function carregarSnapshotsCopiaCamposCard(
  cardId: string,
  pipelineId: string,
  etapaId: string,
  client: ClienteRequisitosEtapa = db,
): Promise<Record<string, string>> {
  const campos = await carregarCamposAplicaveisCardEtapa(cardId, pipelineId, etapaId, client);
  const candidatos = campos.filter((campo) => campo.mapeamentoModo === "COPIAR" && campo.valor?.trim());
  if (!candidatos.length) return {};
  const existentes = await client.bpmCardCampoValor.findMany({
    where: { cardId, campoId: { in: candidatos.map((campo) => campo.id) } },
    select: { campoId: true },
  });
  const preenchidos = new Set(existentes.map((item) => item.campoId));
  return Object.fromEntries(
    candidatos
      .filter((campo) => !preenchidos.has(campo.id))
      .map((campo) => [campo.id, campo.valor as string]),
  );
}

export async function carregarCamposObrigatoriosEtapa(
  pipelineId: string,
  etapaId: string,
  client: ClienteRequisitosEtapa = db,
): Promise<CampoObrigatorioBpm[]> {
  const campos = await carregarCamposAplicaveisEtapa(pipelineId, etapaId, client);
  return campos
    .filter((campo) => campo.obrigatorio)
    .map(({ id, nome }) => ({ id, nome }));
}

export async function carregarCamposFaltantesCardEtapa(
  cardId: string,
  pipelineId: string,
  etapaId: string,
  client: ClienteRequisitosEtapa = db,
): Promise<CampoObrigatorioBpm[]> {
  const campos = (await carregarCamposAplicaveisCardEtapa(
    cardId,
    pipelineId,
    etapaId,
    client,
  )).filter((campo) => campo.obrigatorio);
  return listarCamposObrigatoriosFaltantes(
    campos,
    Object.fromEntries(campos.map((campo) => [campo.id, campo.valor])),
  );
}
