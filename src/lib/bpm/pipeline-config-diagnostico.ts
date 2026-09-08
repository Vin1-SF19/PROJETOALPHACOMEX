import db from "@/lib/prisma";

export const TABELAS_CANONICAS_CONFIG_PIPELINE = [
  "BpmCampoEtapaConfig",
  "BpmCardEstado",
  "BpmEtapaFormulario",
  "BpmFormularioComponente",
  "BpmFormularioSecao",
  "BpmPipelineConfigAuditoria",
  "BpmRequisito",
  "BpmSlaConfig",
  "BpmTransicaoExecucao",
] as const;

type EtapaDiagnostico = {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  ehInicial: boolean;
  ehFinal: boolean;
};

type TransicaoDiagnostico = {
  etapaOrigemId: string;
  etapaDestinoId: string;
  permitida: boolean;
};

type CampoDiagnostico = {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  fonteEntidade: string | null;
  fonteAtributo: string | null;
  opcoesJson: string | null;
  pipelineId: string;
  opcoes: Array<{ ativo: boolean }>;
  etapaConfiguracoes: Array<{ etapaId: string }>;
  pipelinesAssociados: Array<{ pipelineId: string }>;
};

type SlaDiagnostico = {
  ativa: boolean;
  etapaId: string | null;
  servicoId: number | null;
  tipoProcesso: string | null;
  tipoTarefa: string | null;
  inicioMomento: string;
  prioridade: number;
};

export type SnapshotDiagnosticoPipeline = {
  id: string;
  nome: string;
  updatedAt: Date | string;
  etapas: EtapaDiagnostico[];
  transicoes: TransicaoDiagnostico[];
  campos: CampoDiagnostico[];
  slas: SlaDiagnostico[];
};

export type DiagnosticoPipeline = {
  pipeline: { id: string; nome: string; versao: string };
  schema: {
    compativel: boolean;
    tabelasEsperadas: number;
    tabelasPresentes: number;
    tabelasAusentes: string[];
  };
  etapas: {
    totalAtivas: number;
    iniciais: string[];
    finais: string[];
    inacessiveis: string[];
  };
  transicoes: {
    esperadas: number;
    configuradas: number;
    permitidas: number;
    bloqueadas: number;
    ausentes: number;
    fluxoTotalmenteAberto: boolean;
  };
  campos: {
    total: number;
    ativos: number;
    configuracoesPorEtapa: number;
    compartilhados: number;
    selecoesAtivasSemFonteOuCatalogo: string[];
  };
  sla: { total: number; ativos: number; sobreposicoes: number };
  saude: { status: "SAUDAVEL" | "ATENCAO" | "CRITICO"; alertas: string[] };
};

type ClienteDiagnostico = Pick<typeof db, "bpmPipeline" | "bpmCampo" | "$queryRawUnsafe">;

function possuiOpcoesLegadas(opcoesJson: string | null): boolean {
  if (!opcoesJson) return false;
  try {
    const valor = JSON.parse(opcoesJson);
    return Array.isArray(valor) && valor.length > 0;
  } catch {
    return false;
  }
}

function chaveSla(sla: SlaDiagnostico): string {
  return [sla.etapaId, sla.servicoId, sla.tipoProcesso, sla.tipoTarefa, sla.inicioMomento]
    .map((valor) => valor ?? "*")
    .join("|");
}

export function analisarDiagnosticoPipeline(
  snapshot: SnapshotDiagnosticoPipeline,
  tabelasPresentes: readonly string[],
): DiagnosticoPipeline {
  const tabelas = new Set(tabelasPresentes);
  const tabelasAusentes = TABELAS_CANONICAS_CONFIG_PIPELINE.filter((nome) => !tabelas.has(nome));
  const etapasAtivas = snapshot.etapas.filter((etapa) => etapa.ativo).sort((a, b) => a.ordem - b.ordem);
  const idsAtivos = new Set(etapasAtivas.map((etapa) => etapa.id));
  const iniciais = etapasAtivas.filter((etapa) => etapa.ehInicial);
  const finais = etapasAtivas.filter((etapa) => etapa.ehFinal);
  const transicoesAtivas = snapshot.transicoes.filter(
    (transicao) => idsAtivos.has(transicao.etapaOrigemId) && idsAtivos.has(transicao.etapaDestinoId),
  );
  const pares = new Set(transicoesAtivas.map((item) => `${item.etapaOrigemId}:${item.etapaDestinoId}`));
  const esperadas = etapasAtivas.length * Math.max(0, etapasAtivas.length - 1);
  const configuradas = pares.size;
  const permitidas = transicoesAtivas.filter((item) => item.permitida).length;

  const visitadas = new Set<string>(iniciais.map((etapa) => etapa.id));
  const fila = [...visitadas];
  while (fila.length > 0) {
    const origemId = fila.shift()!;
    for (const transicao of transicoesAtivas) {
      if (transicao.etapaOrigemId !== origemId || !transicao.permitida || visitadas.has(transicao.etapaDestinoId)) continue;
      visitadas.add(transicao.etapaDestinoId);
      fila.push(transicao.etapaDestinoId);
    }
  }
  const inacessiveis = etapasAtivas.filter((etapa) => !visitadas.has(etapa.id)).map((etapa) => etapa.nome);

  const selecoesInvalidas = snapshot.campos
    .filter((campo) => campo.ativo && ["selecao", "multiselecao"].includes(campo.tipo.toLocaleLowerCase("pt-BR")))
    .filter((campo) => {
      const temFonte = Boolean(campo.fonteEntidade && campo.fonteAtributo);
      const temCatalogo = campo.opcoes.some((opcao) => opcao.ativo) || possuiOpcoesLegadas(campo.opcoesJson);
      return !temFonte && !temCatalogo;
    })
    .map((campo) => campo.nome)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const slasAtivos = snapshot.slas.filter((sla) => sla.ativa);
  const frequenciaSla = new Map<string, number>();
  for (const sla of slasAtivos) frequenciaSla.set(chaveSla(sla), (frequenciaSla.get(chaveSla(sla)) ?? 0) + 1);
  const sobreposicoes = [...frequenciaSla.values()].reduce((total, quantidade) => total + Math.max(0, quantidade - 1), 0);

  const alertas: string[] = [];
  if (tabelasAusentes.length) alertas.push(`Schema incompatível: ${tabelasAusentes.length} tabela(s) canônica(s) ausente(s).`);
  if (iniciais.length !== 1) alertas.push(`O pipeline precisa de uma etapa inicial ativa; encontrado: ${iniciais.length}.`);
  if (finais.length === 0) alertas.push("O pipeline não possui etapa final ativa.");
  if (configuradas < esperadas) alertas.push(`Há ${esperadas - configuradas} aresta(s) sem configuração explícita.`);
  if (inacessiveis.length) alertas.push(`Há ${inacessiveis.length} etapa(s) inacessível(is) a partir da inicial.`);
  if (selecoesInvalidas.length) alertas.push(`Há ${selecoesInvalidas.length} seleção(ões) ativa(s) sem fonte ou catálogo.`);
  if (sobreposicoes) alertas.push(`Há ${sobreposicoes} configuração(ões) de SLA sobreposta(s).`);

  const critico = tabelasAusentes.length > 0 || iniciais.length !== 1 || finais.length === 0;
  return {
    pipeline: { id: snapshot.id, nome: snapshot.nome, versao: new Date(snapshot.updatedAt).toISOString() },
    schema: {
      compativel: tabelasAusentes.length === 0,
      tabelasEsperadas: TABELAS_CANONICAS_CONFIG_PIPELINE.length,
      tabelasPresentes: TABELAS_CANONICAS_CONFIG_PIPELINE.length - tabelasAusentes.length,
      tabelasAusentes: [...tabelasAusentes],
    },
    etapas: {
      totalAtivas: etapasAtivas.length,
      iniciais: iniciais.map((etapa) => etapa.nome),
      finais: finais.map((etapa) => etapa.nome),
      inacessiveis,
    },
    transicoes: {
      esperadas,
      configuradas,
      permitidas,
      bloqueadas: transicoesAtivas.length - permitidas,
      ausentes: Math.max(0, esperadas - configuradas),
      fluxoTotalmenteAberto: esperadas > 0 && permitidas === esperadas,
    },
    campos: {
      total: snapshot.campos.length,
      ativos: snapshot.campos.filter((campo) => campo.ativo).length,
      configuracoesPorEtapa: snapshot.campos.reduce((total, campo) => total + campo.etapaConfiguracoes.length, 0),
      compartilhados: snapshot.campos.filter(
        (campo) => campo.pipelineId !== snapshot.id || campo.pipelinesAssociados.some((item) => item.pipelineId !== snapshot.id),
      ).length,
      selecoesAtivasSemFonteOuCatalogo: selecoesInvalidas,
    },
    sla: { total: snapshot.slas.length, ativos: slasAtivos.length, sobreposicoes },
    saude: { status: critico ? "CRITICO" : alertas.length ? "ATENCAO" : "SAUDAVEL", alertas },
  };
}

export async function diagnosticarConfiguracaoPipeline(
  pipelineId: string,
  client: ClienteDiagnostico = db,
): Promise<DiagnosticoPipeline | null> {
  const id = pipelineId.trim();
  if (!id || id.length > 120) throw new Error("Identificador de pipeline inválido.");

  const [pipeline, campos, tabelas] = await Promise.all([
    client.bpmPipeline.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        updatedAt: true,
        etapas: {
          select: { id: true, nome: true, ordem: true, ativo: true, ehInicial: true, ehFinal: true },
          orderBy: { ordem: "asc" },
        },
        transicoesEtapa: {
          select: { etapaOrigemId: true, etapaDestinoId: true, permitida: true },
        },
        slaConfigs: {
          select: {
            ativa: true,
            etapaId: true,
            servicoId: true,
            tipoProcesso: true,
            tipoTarefa: true,
            inicioMomento: true,
            prioridade: true,
          },
        },
      },
    }),
    client.bpmCampo.findMany({
      where: { OR: [{ pipelineId: id }, { pipelinesAssociados: { some: { pipelineId: id } } }] },
      select: {
        id: true,
        nome: true,
        tipo: true,
        ativo: true,
        fonteEntidade: true,
        fonteAtributo: true,
        opcoesJson: true,
        pipelineId: true,
        opcoes: { select: { ativo: true } },
        etapaConfiguracoes: { where: { etapa: { pipelineId: id } }, select: { etapaId: true } },
        pipelinesAssociados: { select: { pipelineId: true } },
      },
    }),
    client.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${TABELAS_CANONICAS_CONFIG_PIPELINE.map(() => "?").join(", ")})`,
      ...TABELAS_CANONICAS_CONFIG_PIPELINE,
    ),
  ]);

  if (!pipeline) return null;
  return analisarDiagnosticoPipeline(
    { ...pipeline, transicoes: pipeline.transicoesEtapa, campos, slas: pipeline.slaConfigs },
    tabelas.map((tabela) => tabela.name),
  );
}

export function formatarDiagnosticoPipeline(diagnostico: DiagnosticoPipeline): string {
  const linhas = [
    `Pipeline: ${diagnostico.pipeline.nome} (${diagnostico.pipeline.id})`,
    `Versão: ${diagnostico.pipeline.versao}`,
    `Saúde: ${diagnostico.saude.status}`,
    `Schema: ${diagnostico.schema.compativel ? "compatível" : "incompatível"} (${diagnostico.schema.tabelasPresentes}/${diagnostico.schema.tabelasEsperadas})`,
    `Etapas: ${diagnostico.etapas.totalAtivas} ativas | inicial: ${diagnostico.etapas.iniciais.join(", ") || "ausente"} | finais: ${diagnostico.etapas.finais.join(", ") || "ausentes"}`,
    `Transições: ${diagnostico.transicoes.configuradas}/${diagnostico.transicoes.esperadas} configuradas | ${diagnostico.transicoes.permitidas} permitidas | ${diagnostico.transicoes.bloqueadas} bloqueadas`,
    `Campos: ${diagnostico.campos.ativos}/${diagnostico.campos.total} ativos | ${diagnostico.campos.configuracoesPorEtapa} configurações por etapa | ${diagnostico.campos.compartilhados} compartilhados`,
    `SLA: ${diagnostico.sla.ativos}/${diagnostico.sla.total} ativos | ${diagnostico.sla.sobreposicoes} sobreposições`,
  ];
  if (diagnostico.saude.alertas.length) linhas.push("Alertas:", ...diagnostico.saude.alertas.map((alerta) => `- ${alerta}`));
  return linhas.join("\n");
}
