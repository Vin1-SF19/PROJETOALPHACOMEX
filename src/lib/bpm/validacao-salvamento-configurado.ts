import "server-only";

import type { Prisma } from "@prisma/client";

import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";
import { camposPublicadosPorEtapa } from "@/lib/bpm/campos-formulario-publicado";
import { carregarValoresCanonicosCampos } from "@/lib/bpm/campos-configuraveis-server";
import { avaliarGrupo } from "@/lib/bpm/regras/avaliador";
import { montarContextoAvaliacaoDoCard } from "@/lib/bpm/regras/contexto";
import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";
import { FINANCIAL_FIELD_KEYS as K } from "@/lib/bpm/pipeline-financeiro";
import { calcularNovoContrato, pendenciasValidacaoNovoContrato } from "@/lib/bpm/novo-contrato-financeiro";
import { CHAVES_CAMPOS } from "@/lib/bpm/financeiro-config.client";
import { extrairPathnamePrivadoAnexoBpm } from "@/lib/bpm/anexos-storage";
import { cnpjEhValido } from "@/lib/format-cnpj";

const DADOS_PARA_ELABORAR = [
  [K.CNPJ, "CNPJ"], [K.RAZAO_SOCIAL, "Razão Social"], [K.RUA, "Rua"],
  [K.NUMERO, "Número"], [K.BAIRRO, "Bairro"], [K.CEP, "CEP"],
  [K.MUNICIPIO, "Município"], [K.ESTADO, "Estado"], [K.EMAIL, "E-mail"],
  [K.REGIME_CLIENTE, "Regime tributário do cliente"], [K.SERVICO, "Serviço contratado"],
  [K.VALOR_BRUTO, "Valor bruto do contrato"], [K.FORMA_PAGAMENTO, "Forma de pagamento"],
  [K.CONDICAO, "Condição negociada"],
] as const;

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

/** Aplica padrões temporais ao autosave; requisitos da etapa são avaliados ao avançar. */
export async function prepararSalvamentoConfigurado(params: {
  card: Card;
  valoresSubmetidos: Record<string, string>;
  client: Prisma.TransactionClient;
  agora?: Date;
  atorId?: number;
}): Promise<Record<string, string>> {
  const { card, client } = params;
  const agora = params.agora ?? new Date();
  const [publicadosPorEtapa, etapas] = await Promise.all([
    camposPublicadosPorEtapa([card.etapaId], client),
    client.bpmEtapa.findMany({ where: { pipelineId: card.pipelineId, ativo: true }, select: { id: true } }),
  ]);
  const publicados = publicadosPorEtapa.get(card.etapaId) ?? new Set<string>();
  const configs = await client.bpmCampoEtapaConfig.findMany({
    where: { etapaId: card.etapaId, visivel: true, campoId: { in: [...publicados] }, campo: { ativo: true } },
    include: { campo: { select: { id: true, nome: true, chave: true, tipo: true, opcoesJson: true } } },
  });
  const statusAssinatura = configs.find((config) => config.campo.chave === "alpha.financeiro.status.contrato.assinatura");
  const camposFinanceiros = new Map(configs.filter((config) => config.campo.chave).map((config) => [config.campo.chave, config.campoId]));
  let valoresSubmetidos = params.valoresSubmetidos;
  if (camposFinanceiros.has(K.VALOR_BRUTO)) {
    const atuais = await client.bpmCardCampoValor.findMany({
      where: { cardId: card.id, campoId: { in: [...camposFinanceiros.values()] } },
      select: { campoId: true, valor: true },
    });
    const porId = { ...Object.fromEntries(atuais.map((item) => [item.campoId, item.valor])), ...params.valoresSubmetidos };
    const valores = Object.fromEntries([...camposFinanceiros].map(([chave, id]) => [chave, porId[id] ?? ""]));
    const invalidos = pendenciasValidacaoNovoContrato(valores);
    if (invalidos.length) throw new Error(`CAMPO_INVALIDO:${invalidos.join(", ")}`);
    const calculo = calcularNovoContrato(valores);
    const alterouEntrada = [K.VALOR_BRUTO, K.REGIME_CLIENTE, K.REGIME_PRESTADOR, K.IRRF_APLICAVEL,
      K.ALIQUOTA_IRRF, K.CSRF_APLICAVEL, K.ALIQUOTA_CSRF, K.VENCIMENTO, K.DADOS_PAGAMENTO]
      .some((chave) => {
        const id = camposFinanceiros.get(chave);
        return id && Object.hasOwn(params.valoresSubmetidos, id) && params.valoresSubmetidos[id] !== (atuais.find((item) => item.campoId === id)?.valor ?? "");
      });
    if (alterouEntrada) {
      const resultado = { ...valoresSubmetidos };
      for (const [chave, valor] of Object.entries(calculo.resultados)) {
        const id = camposFinanceiros.get(chave);
        if (id) resultado[id] = valor ?? "";
      }
      for (const [indicador, aliquota] of [[K.IRRF_APLICAVEL, K.ALIQUOTA_IRRF], [K.CSRF_APLICAVEL, K.ALIQUOTA_CSRF]]) {
        const id = camposFinanceiros.get(aliquota);
        if (id && valores[indicador] === "Não") resultado[id] = "";
      }
      const memoriaId = camposFinanceiros.get(K.MEMORIA_CALCULO);
      if (memoriaId && resultado[memoriaId]) {
        const memoria = JSON.parse(resultado[memoriaId]);
        resultado[memoriaId] = JSON.stringify({ ...memoria, calculadoEm: agora.toISOString(), confirmadoPorId: params.atorId ?? null });
      }
      valoresSubmetidos = resultado;
    }
  }
  const possuiAutomacao = configs.some((config) => config.condicaoObrigatoriedadeJson
    && (config.valorPadrao === "{{agora.data}}" || config.valorPadrao === "{{agora.instante}}"));
  const possuiContratoElaborado = configs.some((config) => config.campo.chave === CHAVES_CAMPOS.CONTRATO_ELABORADO);
  if (!possuiAutomacao && !statusAssinatura && !possuiContratoElaborado) return valoresSubmetidos;

  const publicadosPipeline = await camposPublicadosPorEtapa(etapas.map((etapa) => etapa.id), client);
  const idsPublicados = new Set([...publicadosPipeline.values()].flatMap((ids) => [...ids]));
  const campos = await client.bpmCampo.findMany({
    where: { id: { in: [...idsPublicados] }, ativo: true,
      OR: [{ pipelineId: card.pipelineId }, { pipelinesAssociados: { some: { pipelineId: card.pipelineId } } }],
    },
    select: { id: true, nome: true, chave: true, tipo: true, opcoesJson: true, escopo: true, fonteEntidade: true, fonteAtributo: true, entidadeGlobal: true },
  });
  const contexto = await montarContextoAvaliacaoDoCard(card, client);
  const valoresPersistidos = { ...contexto.camposDinamicos };
  // Datas de eventos já registrados são imutáveis mesmo que um cliente envie
  // manualmente outro valor num salvamento posterior.
  for (const chave of [CHAVES_CAMPOS.DATA_ELABORACAO, CHAVES_CAMPOS.DATA_ENVIO]) {
    const id = campos.find((campo) => campo.chave === chave)?.id;
    const persistido = id ? String(contexto.camposDinamicos?.[id] ?? "").trim() : "";
    if (id && persistido && Object.hasOwn(valoresSubmetidos, id)) {
      valoresSubmetidos = { ...valoresSubmetidos, [id]: persistido };
    }
  }
  const canonicos = await carregarValoresCanonicosCampos(card.id, campos, client);
  contexto.camposDinamicos = {
    ...Object.fromEntries(campos.map((campo) => [campo.id, null])),
    ...contexto.camposDinamicos,
    ...canonicos,
    ...valoresSubmetidos,
  };
  const valores = { ...valoresSubmetidos };

  // As identidades estáveis ligam a validação aos campos publicados, inclusive
  // os conferidos na etapa anterior. Os rótulos vêm do cadastro atual.
  const porChave = new Map(campos.filter((campo) => campo.chave).map((campo) => [campo.chave, campo]));
  const campoElaborado = configs.find((config) => config.campo.chave === CHAVES_CAMPOS.CONTRATO_ELABORADO);
  if (campoElaborado) {
    const valorDe = (chave: string) => {
      const id = porChave.get(chave)?.id;
      return id ? String(contexto.camposDinamicos?.[id] ?? "").trim() : "";
    };
    const campoEnviado = porChave.get(CHAVES_CAMPOS.CONTRATO_ENVIADO);
    const elaborado = valorDe(CHAVES_CAMPOS.CONTRATO_ELABORADO) === "Sim";
    const enviado = valorDe(CHAVES_CAMPOS.CONTRATO_ENVIADO) === "Sim";
    const pendencias: string[] = [];
    if (enviado && !elaborado) pendencias.push(campoElaborado.campo.nome);
    if (elaborado) {
      for (const [chave, rotulo] of DADOS_PARA_ELABORAR) {
        const campo = porChave.get(chave);
        const valor = valorDe(chave);
        if (!valor) { pendencias.push(campo?.nome ?? rotulo); continue; }
        if (campo && !validarValoresCamposBpm([{ ...campo, tipo: campo.tipo, opcoesJson: campo.opcoesJson }], { [campo.id]: valor }).success) {
          pendencias.push(campo.nome);
        }
      }
      const valorBruto = valorDe(K.VALOR_BRUTO).replace(",", ".");
      if (valorBruto && (!/^\d+(?:\.\d{1,2})?$/.test(valorBruto) || Number(valorBruto) <= 0)) {
        pendencias.push(porChave.get(K.VALOR_BRUTO)?.nome ?? "Valor bruto do contrato");
      }
      const porChaveValores = Object.fromEntries(DADOS_PARA_ELABORAR.map(([chave]) => [chave, valorDe(chave)]));
      if (valorDe(K.CNPJ) && !cnpjEhValido(valorDe(K.CNPJ))) pendencias.push(porChave.get(K.CNPJ)?.nome ?? "CNPJ");
      for (const motivo of pendenciasValidacaoNovoContrato(porChaveValores)) {
        const chave = motivo.startsWith("CEP") ? K.CEP : motivo.startsWith("Estado") ? K.ESTADO : K.VALOR_BRUTO;
        pendencias.push(porChave.get(chave)?.nome ?? motivo);
      }
      if (valorDe(K.EMAIL) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valorDe(K.EMAIL))) pendencias.push(porChave.get(K.EMAIL)?.nome ?? "E-mail");
    }
    if (enviado) {
      const link = porChave.get(CHAVES_CAMPOS.LINK_CONTRATO);
      const referencia = valorDe(CHAVES_CAMPOS.LINK_CONTRATO);
      if (!referencia || (link && !validarValoresCamposBpm([{ ...link, tipo: link.tipo, opcoesJson: link.opcoesJson }], { [link.id]: referencia }).success)) {
        pendencias.push(link?.nome ?? "Link/arquivo do contrato");
      } else if (link && !/^https:\/\//i.test(referencia)) {
        const anexo = await client.bpmCardAnexo.findFirst({
          where: { id: referencia, cardId: card.id, campoId: link.id }, select: { id: true },
        });
        if (!anexo) pendencias.push(link.nome);
      }
      if (!campoEnviado) pendencias.push("Contrato enviado para assinatura");
    }
    if (pendencias.length) throw new Error(`REQUISITOS_PENDENTES:${[...new Set(pendencias)].join(", ")}`);
  }

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

  if (campoElaborado) {
    const pendenciasDatas: string[] = [];
    for (const [indicador, chaveData, rotulo] of [
      [CHAVES_CAMPOS.CONTRATO_ELABORADO, CHAVES_CAMPOS.DATA_ELABORACAO, "Data de elaboração"],
      [CHAVES_CAMPOS.CONTRATO_ENVIADO, CHAVES_CAMPOS.DATA_ENVIO, "Data do envio"],
    ]) {
      const idIndicador = porChave.get(indicador)?.id;
      const campoData = porChave.get(chaveData);
      if (idIndicador && String(contexto.camposDinamicos?.[idIndicador] ?? "").trim() === "Sim") {
        const valor = campoData ? String(contexto.camposDinamicos?.[campoData.id] ?? "").trim() : "";
        if (!valor || (campoData && !validarValoresCamposBpm([campoData], { [campoData.id]: valor }).success)) {
          pendenciasDatas.push(campoData?.nome ?? rotulo);
        }
      }
    }
    if (pendenciasDatas.length) throw new Error(`REQUISITOS_PENDENTES:${pendenciasDatas.join(", ")}`);
  }

  const valoresContexto = contexto.camposDinamicos ?? {};
  if (statusAssinatura) {
    const statusAtual = String(valoresContexto[statusAssinatura.campoId] ?? "").trim();
    const campoData = porChave.get(CHAVES_CAMPOS.DATA_ASSINATURA);
    const campoAnexo = porChave.get(CHAVES_CAMPOS.ANEXO_ASSINADO);
    const campoContrato = porChave.get(CHAVES_CAMPOS.STATUS_CONTRATO);
    const pendencias: string[] = [];
    let anexoValido = false;
    const statusContratoAtual = campoContrato ? String(valoresContexto[campoContrato.id] ?? "") : "";
    if (statusAtual === "Assinado" && campoContrato && Object.hasOwn(valoresSubmetidos, campoContrato.id)
      && statusContratoAtual !== "Assinado" && statusContratoAtual !== "CONTRATO CONCLUÍDO") {
      pendencias.push(campoContrato.nome);
    }
    if (statusAtual === "Assinado" || statusContratoAtual === "Assinado" || statusContratoAtual === "CONTRATO CONCLUÍDO") {
      if (statusAtual !== "Assinado") pendencias.push(statusAssinatura.campo.nome);
      const data = campoData ? String(valoresContexto[campoData.id] ?? "").trim() : "";
      if (!campoData || !data || !validarValoresCamposBpm([campoData], { [campoData.id]: data }).success) {
        pendencias.push(campoData?.nome ?? "Data da assinatura");
      }
      const anexoId = campoAnexo ? String(valoresContexto[campoAnexo.id] ?? "").trim() : "";
      const anexo = anexoId && campoAnexo ? await client.bpmCardAnexo.findFirst({
        where: { id: anexoId, cardId: card.id, campoId: campoAnexo.id }, select: { url: true },
      }) : null;
      anexoValido = Boolean(anexo?.url && extrairPathnamePrivadoAnexoBpm(anexo.url));
      if (!anexoValido) pendencias.push(campoAnexo?.nome ?? "Contrato assinado/anexo");
    }
    if (pendencias.length) throw new Error(`REQUISITOS_PENDENTES:${[...new Set(pendencias)].join(", ")}`);
    const assinaturaAnterior = await client.bpmCardHistorico.findFirst({
      where: { cardId: card.id, acao: "CONTRATO_CONCLUIDO" }, select: { id: true },
    });
    if (assinaturaAnterior) {
      const camposProtegidos = [statusAssinatura.campoId, campoData?.id, campoAnexo?.id, campoContrato?.id].filter((id): id is string => Boolean(id));
      if (camposProtegidos.some((id) => Object.hasOwn(valoresSubmetidos, id)
        && String(valoresContexto[id] ?? "") !== String(valoresPersistidos[id] ?? ""))) {
        throw new Error("REQUISITOS_PENDENTES:Assinatura já confirmada; alterações exigem um procedimento auditado.");
      }
    }
  }
  return valores;
}
